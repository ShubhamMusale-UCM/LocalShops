import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler.middleware';
import { cacheDeletePattern } from '../../config/redis';
import { getOrderSocket } from '../../websockets/orderUpdates.ws';

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

    // Filter incoming items to only those whose product actually exists in database and is active
    const validProducts = requestedProductIds.length > 0
      ? await prisma.product.findMany({
          where: { id: { in: requestedProductIds }, isActive: true },
          select: { id: true, shopId: true },
        })
      : [];

    const validProductMap = new Map(validProducts.map((p) => [p.id, p]));
    const validItems = items.filter((item) => validProductMap.has(item.productId));

    const actorIds = Array.from(new Set([userId, deviceActorId].filter((id): id is string => Boolean(id && typeof id === 'string'))));

    // If incoming cart is completely empty, wipe cart items for all actor IDs immediately
    if (validItems.length === 0) {
      const priorItems = await prisma.cartItem.findMany({
        where: { userId: { in: actorIds } },
        select: { shopId: true },
      });
      await prisma.cartItem.deleteMany({
        where: { userId: { in: actorIds } },
      });
      const emptyAffected = new Set<string>();
      priorItems.forEach((i) => { if (i.shopId) emptyAffected.add(i.shopId); });
      for (const sid of emptyAffected) {
        cacheDeletePattern(`shop:${sid}:analytics*`).catch(() => {});
        try {
          const socket = getOrderSocket();
          if (socket) {
            socket.getIO().to(`shop:${sid}`).emit('shop:ad-analytics-updated', { shopId: sid, timestamp: new Date() });
          }
        } catch (_) {}
      }
      return { items: [], count: 0, vouchers: [] };
    }

    const currentItems = await prisma.cartItem.findMany({
      where: { userId: { in: actorIds } },
    });

    const currentMap = new Map<string, typeof currentItems[0]>();
    currentItems.forEach((ci) => {
      if (ci.userId === userId || !currentMap.has(ci.productId)) {
        currentMap.set(ci.productId, ci);
      }
    });

    const incomingValidProductIds = new Set(validItems.map((i) => i.productId));

    // Remove deleted items across all actor IDs (userId AND deviceActorId)
    await prisma.cartItem.deleteMany({
      where: {
        userId: { in: actorIds },
        productId: { notIn: Array.from(incomingValidProductIds) },
      },
    });

    // If a logged-in user syncs, remove redundant anonymous cart entries from the same device
    if (!userId.startsWith('anon_') && deviceActorId && deviceActorId !== userId) {
      await prisma.cartItem.deleteMany({
        where: { userId: deviceActorId },
      }).catch(() => {});
    }

    // Upsert items that exist in database under primary userId
    for (const item of validItems) {
      const productInfo = validProductMap.get(item.productId);
      const existing = currentMap.get(item.productId);
      const safeQty = Math.max(1, parseInt(String(item.quantity), 10) || 1);
      const targetShopId = item.shopId || productInfo?.shopId || existing?.shopId || null;

      if (existing && existing.userId === userId) {
        // Update quantity and shopId if changed, touch updatedAt
        await prisma.cartItem.update({
          where: { id: existing.id },
          data: {
            quantity: safeQty,
            shopId: targetShopId,
            variantId: item.variantId || existing.variantId || null,
            updatedAt: new Date(),
          },
        });
      } else {
        // Create new item under primary userId
        await prisma.cartItem.create({
          data: {
            userId,
            productId: item.productId,
            shopId: targetShopId,
            variantId: item.variantId || null,
            quantity: safeQty,
            updatedAt: new Date(),
          },
        });
      }
    }

    // Invalidate analytics cache and emit socket updates for affected shops
    const affectedShopIds = new Set<string>();
    validProducts.forEach((p) => { if (p.shopId) affectedShopIds.add(p.shopId); });
    currentItems.forEach((ci) => { if (ci.shopId) affectedShopIds.add(ci.shopId); });
    for (const sid of affectedShopIds) {
      cacheDeletePattern(`shop:${sid}:analytics*`).catch(() => {});
      try {
        const socket = getOrderSocket();
        if (socket) {
          socket.getIO().to(`shop:${sid}`).emit('shop:ad-analytics-updated', {
            shopId: sid,
            timestamp: new Date(),
          });
        }
      } catch (_) {}
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
            allowPrebook: true,
            prebookEtaDays: true,
            prebookNote: true,
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
   * Clear user's cart (all or by shopId) across user and device sessions
   */
  async clearCart(userId: string, shopId?: string, deviceActorId?: string | null) {
    const actorIds = Array.from(new Set([userId, deviceActorId].filter((id): id is string => Boolean(id && typeof id === 'string'))));
    const where: any = { userId: { in: actorIds } };
    if (shopId) {
      where.shopId = shopId;
    }
    const priorItems = await prisma.cartItem.findMany({
      where,
      select: { shopId: true },
    });
    await prisma.cartItem.deleteMany({ where });

    const affectedShops = new Set<string>();
    if (shopId) affectedShops.add(shopId);
    priorItems.forEach((i) => { if (i.shopId) affectedShops.add(i.shopId); });

    for (const sid of affectedShops) {
      cacheDeletePattern(`shop:${sid}:analytics*`).catch(() => {});
      try {
        const socket = getOrderSocket();
        if (socket) {
          socket.getIO().to(`shop:${sid}`).emit('shop:ad-analytics-updated', {
            shopId: sid,
            timestamp: new Date(),
          });
        }
      } catch (_) {}
    }

    return { success: true };
  }

  /**
   * Get active abandoned cart / targeted cart vouchers available for this buyer or anonymous device
   */
  async getUserVouchers(
    userId: string,
    shopId?: string,
    deviceActorId?: string | null,
    cartProductIds?: string[]
  ) {
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

    const vouchers = await prisma.cartVoucher.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    if (vouchers.length === 0) {
      return [];
    }

    // Resolve product names and details for product-locked vouchers
    const productIdsToFetch = vouchers.map((v) => v.productId).filter(Boolean) as string[];
    const productMap = new Map<string, { id: string; name: string; price: number }>();
    if (productIdsToFetch.length > 0) {
      const prods = await prisma.product.findMany({
        where: { id: { in: productIdsToFetch } },
        select: { id: true, name: true, price: true },
      });
      prods.forEach((p) => productMap.set(p.id, p));
    }

    // If cartProductIds was explicitly supplied by client, use it;
    // Otherwise check persistent CartItem table in DB
    let activeProductIds = cartProductIds;
    if (!activeProductIds || activeProductIds.length === 0) {
      const dbCartItems = await prisma.cartItem.findMany({
        where: { userId: { in: actorIds } },
        select: { productId: true },
      });
      activeProductIds = dbCartItems.map((i) => i.productId);
    }

    // Filter: If a voucher targets a specific product, only return it if that product is currently in the cart!
    const validVouchers = vouchers.filter((v) => {
      if (!v.productId) return true; // General shop voucher
      if (activeProductIds && activeProductIds.length > 0) {
        return activeProductIds.includes(v.productId);
      }
      return false; // Product-specific voucher cannot be shown if targeted product is not in cart
    });

    return validVouchers.map((v) => ({
      ...v,
      productName: v.productId ? productMap.get(v.productId)?.name || null : null,
      product: v.productId ? productMap.get(v.productId) || null : null,
    }));
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
    deviceActorId?: string | null,
    cartItems?: { productId: string; quantity?: number; price?: number }[]
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
    let targetProductName: string | null = null;

    if (voucher.productId) {
      const targetProduct = await prisma.product.findUnique({
        where: { id: voucher.productId },
        select: { id: true, name: true, price: true },
      });
      targetProductName = targetProduct?.name || 'the targeted item';

      // 1. Check in passed cartItems (from live client cart or order items payload)
      let matchedItem: { productId: string; quantity: number; price: number } | null = null;

      if (cartItems && Array.isArray(cartItems) && cartItems.length > 0) {
        const found = cartItems.find((i) => String(i.productId) === String(voucher.productId));
        if (found) {
          matchedItem = {
            productId: String(found.productId),
            quantity: Math.max(1, Number(found.quantity) || 1),
            price: Number(found.price) || Number(targetProduct?.price) || 0,
          };
        }
      }

      // 2. If not matched in passed items, check persistent database cart items
      if (!matchedItem) {
        const actorIds = Array.from(new Set([userId, deviceActorId, voucher.userId].filter(Boolean) as string[]));
        const dbCartItem = await prisma.cartItem.findFirst({
          where: {
            userId: { in: actorIds },
            productId: voucher.productId,
          },
          include: {
            product: { select: { price: true, name: true } },
          },
        });

        if (dbCartItem) {
          matchedItem = {
            productId: dbCartItem.productId,
            quantity: Math.max(1, Number(dbCartItem.quantity) || 1),
            price: Number(dbCartItem.product?.price) || Number(targetProduct?.price) || 0,
          };
        }
      }

      if (!matchedItem) {
        throw new AppError(
          `This exclusive coupon is only valid for "${targetProductName}" and cannot be applied to other items in your cart`,
          400
        );
      }

      // Calculate discount ONLY on the eligible product's line total, NOT the whole subtotal!
      const productLineTotal = matchedItem.price * matchedItem.quantity;
      eligibleBaseAmount = Math.min(subtotal, productLineTotal);
    }

    const rawDiscount = (eligibleBaseAmount * voucher.discountPercent) / 100;
    const discountAmount = voucher.maxDiscount ? Math.min(rawDiscount, voucher.maxDiscount) : rawDiscount;
    const effectiveDiscount = +(discountAmount.toFixed(2));

    return {
      valid: true,
      code: voucher.code,
      productId: voucher.productId || null,
      productName: targetProductName,
      discountPercent: voucher.discountPercent,
      maxDiscount: voucher.maxDiscount || null,
      discountAmount: effectiveDiscount,
      voucherId: voucher.id,
      eligibleAmount: eligibleBaseAmount,
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
