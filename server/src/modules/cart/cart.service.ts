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
   * Preserves original createdAt timestamps so abandoned cart detection is accurate.
   */
  async syncCart(userId: string, items: CartSyncItemInput[]) {
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

    return this.getCart(userId);
  }

  /**
   * Fetch user's persistent cart with product and shop details.
   */
  async getCart(userId: string) {
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

    const activeVouchers = await this.getUserVouchers(userId);

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
   * Get active abandoned cart vouchers available for this buyer
   */
  async getUserVouchers(userId: string, shopId?: string) {
    const now = new Date();
    const where: any = {
      userId,
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
   * Validate and calculate discount for a targeted voucher code
   */
  async validateAndApplyVoucher(code: string, userId: string, shopId: string, subtotal: number) {
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

    // STRICT USER LIMITATION: Only the targeted buyer who abandoned the cart can redeem it
    if (voucher.userId !== userId) {
      throw new AppError('This exclusive voucher code was issued for another account and cannot be redeemed on this profile', 403);
    }

    // SHOP LIMITATION: Must match the shop that issued the recovery discount
    if (voucher.shopId !== shopId) {
      throw new AppError('This voucher code is only valid for purchases from the issuing shop', 400);
    }

    const rawDiscount = (subtotal * voucher.discountPercent) / 100;
    const discountAmount = voucher.maxDiscount ? Math.min(rawDiscount, voucher.maxDiscount) : rawDiscount;
    const effectiveDiscount = +(discountAmount.toFixed(2));

    return {
      valid: true,
      code: voucher.code,
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
