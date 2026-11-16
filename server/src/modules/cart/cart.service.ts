import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler.middleware';

export interface CartSyncItemInput {
  productId: string;
  quantity: number;
  shopId?: string;
  variantId?: string;
}

export class CartService {
  /**
   * Sync buyer's local cart items to persistent server database.
   * Supports both authenticated users and anonymous device sessions (anon_...).
   * Preserves original createdAt timestamps so abandoned cart detection is accurate.
   */
  async syncCart(userId: string, items: CartSyncItemInput[], deviceActorId?: string | null) {
    if (!Array.isArray(items)) {
      throw new AppError('Items array required', 400);
    }

    const requestedProductIds = items
      .map((i) => i.productId)
      .filter((id): id is string => typeof id === 'string' && id.trim().length > 0);

    // Filter incoming items to only those whose product actually exists in database
    const validProducts = requestedProductIds.length > 0
      ? await prisma.product.findMany({
          where: { id: { in: requestedProductIds } },
          select: { id: true, shopId: true },
        })
      : [];

    const validProductMap = new Map(validProducts.map((p) => [p.id, p]));
    const validItems = items.filter((item) => validProductMap.has(item.productId));

    const currentItems = await prisma.cartItem.findMany({
      where: { userId },
    });

    const currentMap = new Map<string, typeof currentItems[0]>();
    currentItems.forEach((ci) => {
      currentMap.set(ci.productId, ci);
    });

    const incomingValidProductIds = new Set(validItems.map((i) => i.productId));

    // Remove deleted items
    const toDeleteIds = currentItems
      .filter((ci) => !incomingValidProductIds.has(ci.productId))
      .map((ci) => ci.id);

    if (toDeleteIds.length > 0) {
      await prisma.cartItem.deleteMany({
        where: { id: { in: toDeleteIds } },
      });
    }

    // If a logged-in user syncs, remove redundant anonymous cart entries from the same device
    if (!userId.startsWith('anon_') && deviceActorId && deviceActorId !== userId && validItems.length > 0) {
      await prisma.cartItem.deleteMany({
        where: { userId: deviceActorId },
      }).catch(() => {});
    }

    // Upsert items that exist in database
    for (const item of validItems) {
      const productInfo = validProductMap.get(item.productId);
      const existing = currentMap.get(item.productId);
      const safeQty = Math.max(1, parseInt(String(item.quantity), 10) || 1);
      const targetShopId = item.shopId || productInfo?.shopId || existing?.shopId || null;

      if (existing) {
        // Update quantity and shopId if changed, keep createdAt intact!
        await prisma.cartItem.update({
          where: { id: existing.id },
          data: {
            quantity: safeQty,
            shopId: targetShopId,
            variantId: item.variantId || existing.variantId || null,
          },
        });
      } else {
        // Create new item
        await prisma.cartItem.create({
          data: {
            userId,
            productId: item.productId,
            shopId: targetShopId,
            variantId: item.variantId || null,
            quantity: safeQty,
          },
        });
      }
    }

    return this.getCart(userId, deviceActorId);
  }

  /**
   * Fetch user's persistent cart with product and voucher details.
   */
  async getCart(userId: string, deviceActorId?: string | null) {
    const items = await prisma.cartItem.findMany({
      where: { userId },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            price: true,
            mrp: true,
            discount: true,
            bookingAmount: true,
            holdDurationMinutes: true,
            images: true,
            inStock: true,
            quantity: true,
            isActive: true,
            shopId: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const activeVouchers = await this.getUserVouchers(userId, undefined, deviceActorId);

    return {
      items,
      count: items.reduce((acc, i) => acc + i.quantity, 0),
      vouchers: activeVouchers,
    };
  }

  /**
   * Clear user's cart (all or by shopId)
   */
  async clearCart(userId: string, shopId?: string) {
    const where: any = { userId };
    if (shopId) {
      where.shopId = shopId;
    }
    await prisma.cartItem.deleteMany({ where });
    return { success: true };
  }

  /**
   * Get active abandoned cart / targeted cart vouchers available for this buyer or anonymous device
   */
  async getUserVouchers(userId: string, shopId?: string, deviceActorId?: string | null) {
    const now = new Date();
    const actorIds = Array.from(new Set([userId, deviceActorId].filter(Boolean) as string[]));
    const where: any = {
      userId: { in: actorIds },
      isUsed: false,
      expiresAt: { gte: now },
    };
    if (shopId) {
      where.shopId = shopId;
    }

    return prisma.cartVoucher.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Validate and calculate discount for a targeted voucher code.
   * Locked to the targeted user/device AND shop AND (if set) requires the targeted product to be in cart.
   */
  async validateAndApplyVoucher(
    code: string,
    userId: string,
    shopId: string,
    subtotal: number,
    deviceActorId?: string | null
  ) {
    if (!code || !code.trim()) {
      throw new AppError('Voucher code required', 400);
    }

    const cleanCode = code.trim().toUpperCase();
    const voucher = await prisma.cartVoucher.findUnique({
      where: { code: cleanCode },
    });

    if (!voucher) {
      throw new AppError('Invalid voucher code', 400);
    }

    if (voucher.isUsed) {
      throw new AppError('This voucher code has already been redeemed', 400);
    }

    if (new Date() > voucher.expiresAt) {
      throw new AppError('This exclusive discount voucher has expired', 400);
    }

    // STRICT USER/DEVICE LIMITATION: Only the targeted buyer or device who had the product in cart can redeem it
    const isOwner = voucher.userId === userId || Boolean(deviceActorId && voucher.userId === deviceActorId);
    if (!isOwner) {
      throw new AppError(
        'This exclusive voucher code was issued for another account and cannot be redeemed on this profile',
        403
      );
    }

    // SHOP LIMITATION: Must match the shop that issued the recovery discount
    if (voucher.shopId !== shopId) {
      throw new AppError('This voucher code is only valid for purchases from the issuing shop', 400);
    }

    // PRODUCT-IN-CART CHECK: If voucher targets a specific product, verify user currently has it in cart
    let eligibleBaseAmount = subtotal;
    if (voucher.productId) {
      const actorIds = Array.from(new Set([userId, deviceActorId, voucher.userId].filter(Boolean) as string[]));
      const matchingCartItem = await prisma.cartItem.findFirst({
        where: {
          userId: { in: actorIds },
          productId: voucher.productId,
        },
        include: {
          product: { select: { price: true } },
        },
      });

      if (!matchingCartItem) {
        throw new AppError(
          'This exclusive discount is only valid while the targeted product is in your cart',
          400
        );
      }

      if (matchingCartItem.product?.price) {
        const productLineTotal = matchingCartItem.product.price * matchingCartItem.quantity;
        eligibleBaseAmount = Math.min(subtotal, productLineTotal);
      }
    }

    const rawDiscount = (eligibleBaseAmount * voucher.discountPercent) / 100;
    const discountAmount = voucher.maxDiscount ? Math.min(rawDiscount, voucher.maxDiscount) : rawDiscount;
    const effectiveDiscount = +(discountAmount.toFixed(2));

    return {
      valid: true,
      code: voucher.code,
      productId: voucher.productId || null,
      discountPercent: voucher.discountPercent,
      discountAmount: effectiveDiscount,
      voucherId: voucher.id,
    };
  }

  /**
   * Mark voucher redeemed upon successful order placement
   */
  async markVoucherRedeemed(voucherCode: string, orderId: string) {
    await prisma.cartVoucher.updateMany({
      where: { code: voucherCode.toUpperCase(), isUsed: false },
      data: {
        isUsed: true,
        orderId,
        usedAt: new Date(),
      },
    });
  }
}

export default new CartService();
