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

    const currentItems = await prisma.cartItem.findMany({
      where: { userId },
    });

    const currentMap = new Map<string, typeof currentItems[0]>();
    currentItems.forEach((ci) => {
      currentMap.set(ci.productId, ci);
    });

    const incomingProductIds = new Set(items.map((i) => i.productId));

    // Remove deleted items
    const toDeleteIds = currentItems
      .filter((ci) => !incomingProductIds.has(ci.productId))
      .map((ci) => ci.id);

    if (toDeleteIds.length > 0) {
      await prisma.cartItem.deleteMany({
        where: { id: { in: toDeleteIds } },
      });
    }

    // Upsert items
    for (const item of items) {
      const existing = currentMap.get(item.productId);
      const safeQty = Math.max(1, parseInt(String(item.quantity), 10) || 1);

      if (existing) {
        // Update quantity and shopId if changed, keep createdAt intact!
        await prisma.cartItem.update({
          where: { id: existing.id },
          data: {
            quantity: safeQty,
            shopId: item.shopId || existing.shopId,
            variantId: item.variantId || existing.variantId,
          },
        });
      } else {
        // Create new item
        await prisma.cartItem.create({
          data: {
            userId,
            productId: item.productId,
            shopId: item.shopId,
            variantId: item.variantId,
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
