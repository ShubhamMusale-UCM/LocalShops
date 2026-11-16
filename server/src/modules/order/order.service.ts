import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler.middleware';
import { cacheDelete, cacheDeletePattern } from '../../config/redis';
import { nanoid } from 'nanoid';
import { sendOrderConfirmationEmail } from '../../utils/emailService';
import { createRazorpayRefund } from '../../config/razorpay';
import walletService, { WALLET_CONFIG } from '../wallet/wallet.service';
import notificationService from '../notification/notification.service';
import { recordAuditLog } from '../../utils/auditLogger';
import { persistImagesArray } from '../../utils/imageProcessor';
import cartService from '../cart/cart.service';
import { scheduleBookingReminder, cancelBookingReminder } from '../../jobs/bookingReminder.job';

let archivedTablesInitialized = false;

async function ensureArchivedOrdersTables(): Promise<void> {
  if (archivedTablesInitialized) return;
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS user_archived_orders (
        user_id TEXT NOT NULL,
        order_id TEXT NOT NULL,
        archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (user_id, order_id)
      );
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS shop_archived_orders (
        shop_id TEXT NOT NULL,
        order_id TEXT NOT NULL,
        archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (shop_id, order_id)
      );
    `);
    archivedTablesInitialized = true;
  } catch (err) {
    console.error('Failed to initialize archived orders tables:', err);
  }
}

/**
 * Shared atomic stock deduction helper for both createOrder auto-confirm
 * and manual seller confirmOrderTx (SEL-1).
 */
export async function deductOrderStockTx(
  tx: any,
  items: Array<{ productId: string; quantity: number }>
) {
  for (const item of items) {
    const product = await tx.product.findUnique({ where: { id: item.productId } });
    if (product && typeof product.quantity === 'number') {
      const newQuantity = Math.max(0, product.quantity - item.quantity);
      await tx.product.update({
        where: { id: item.productId },
        data: {
          quantity: newQuantity,
          inStock: newQuantity > 0,
        },
      });
    }
  }
}

function isTimeWithinWindow(currentHHMM: string, startHHMM: string, endHHMM: string): boolean {
  if (startHHMM <= endHHMM) {
    return currentHHMM >= startHHMM && currentHHMM <= endHHMM;
  }
  return currentHHMM >= startHHMM || currentHHMM <= endHHMM;
}

const WEEKDAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function isDayWithinWorkingDays(nowIst: Date, workingDays?: string | string[] | null): boolean {
  if (!workingDays) return true;
  const raw = Array.isArray(workingDays) ? workingDays.join(',') : String(workingDays);
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed || trimmed === 'mon - sun' || trimmed === 'all days' || trimmed === 'daily' || trimmed === '24/7') {
    return true;
  }

  const todayIdx = nowIst.getDay(); // 0=Sun..6=Sat
  const todayShort = WEEKDAY_NAMES[todayIdx];

  // Range format: "Mon - Sat" or "Mon - Fri"
  const rangeMatch = trimmed.match(/^([a-z]{3})\s*[-–to]+\s*([a-z]{3})$/);
  if (rangeMatch) {
    const startIdx = WEEKDAY_NAMES.indexOf(rangeMatch[1]);
    const endIdx = WEEKDAY_NAMES.indexOf(rangeMatch[2]);
    if (startIdx >= 0 && endIdx >= 0) {
      if (startIdx <= endIdx) {
        return todayIdx >= startIdx && todayIdx <= endIdx;
      }
      return todayIdx >= startIdx || todayIdx <= endIdx;
    }
  }

  // Comma or space-separated list: "Mon, Tue, Wed, Fri"
  const tokens = trimmed.split(/[,\s/]+/).map((t) => t.slice(0, 3)).filter(Boolean);
  if (tokens.length > 0 && tokens.some((t) => WEEKDAY_NAMES.includes(t))) {
    return tokens.includes(todayShort);
  }

  return true;
}

const toStatusHistory = (value: unknown): any[] => (Array.isArray(value) ? value : []);

const formatDeliveryAddress = (deliveryAddress?: any): string | null => {
  if (!deliveryAddress || typeof deliveryAddress !== 'object') {
    return null;
  }

  const parts = [
    deliveryAddress.address,
    deliveryAddress.landmark,
    deliveryAddress.city,
    deliveryAddress.pincode,
  ]
    .filter((item) => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim());

  if (!parts.length) {
    return null;
  }

  return parts.join(', ');
};

export class OrderService {
  /**
   * Create a new order
   */
  async createOrder(userId: string, data: {
    shopId: string;
    items: { productId: string; quantity: number; price?: number; name?: string; campaignId?: string }[];
    deliveryType: string;
    deliveryAddress?: any;
    paymentMethod: string;
    notes?: string;
    couponCode?: string;
    coinsToUse?: number;
  }, deviceActorId?: string) {
    // Verify shop exists and is open
    const shop = await prisma.shop.findUnique({ where: { id: data.shopId } });
    if (!shop) throw new AppError('Shop not found.', 404);
    if (!shop.isActive) throw new AppError('Shop is not active.', 400);
    if (!shop.isOpen) throw new AppError('Shop is currently marked closed by the merchant.', 400);

    // Fetch extended shop settings for custom schedule & booking configuration
    let extSettings: Record<string, any> = {};
    try {
      const extRows = await prisma.$queryRawUnsafe<Array<{ settings: any }>>(
        `SELECT settings FROM shop_extended_settings WHERE shop_id = $1`,
        data.shopId
      );
      if (extRows && extRows[0] && extRows[0].settings) {
        extSettings = extRows[0].settings;
      }
    } catch (_) {}

    // Check scheduled holiday / closed dates & working days
    const nowIst = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const todayDateStr = `${nowIst.getFullYear()}-${String(nowIst.getMonth() + 1).padStart(2, '0')}-${String(nowIst.getDate()).padStart(2, '0')}`; // YYYY-MM-DD in IST
    let closedDatesList: string[] = [];
    if (Array.isArray(extSettings.closedDates)) {
      closedDatesList = extSettings.closedDates;
    } else if (typeof extSettings.closedDates === 'string') {
      closedDatesList = extSettings.closedDates.split(',').map((s: string) => s.trim()).filter(Boolean);
    }
    if (closedDatesList.includes(todayDateStr)) {
      throw new AppError(`Shop is closed today (${todayDateStr}) for scheduled holiday. Orders cannot be placed.`, 400);
    }

    if (extSettings.workingDays && !isDayWithinWorkingDays(nowIst, extSettings.workingDays)) {
      const dayLabel = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][nowIst.getDay()];
      const workingLabel = Array.isArray(extSettings.workingDays) ? extSettings.workingDays.join(', ') : extSettings.workingDays;
      throw new AppError(`Shop is closed today (${dayLabel}). Working days: ${workingLabel}.`, 400);
    }

    // Check order acceptance timing window
    const currentHHMM = `${String(nowIst.getHours()).padStart(2, '0')}:${String(nowIst.getMinutes()).padStart(2, '0')}`;
    if (extSettings.orderTimingType === 'custom_window' && extSettings.orderAcceptanceStart && extSettings.orderAcceptanceEnd) {
      if (!isTimeWithinWindow(currentHHMM, extSettings.orderAcceptanceStart, extSettings.orderAcceptanceEnd)) {
        throw new AppError(`Order booking is currently closed. Orders accepted between ${extSettings.orderAcceptanceStart} and ${extSettings.orderAcceptanceEnd}.`, 400);
      }
    } else if (extSettings.orderTimingType === 'store_hours' && (extSettings.openingTime || extSettings.closingTime)) {
      const openT = extSettings.openingTime || '09:00';
      const closeT = extSettings.closingTime || '21:00';
      if (!isTimeWithinWindow(currentHHMM, openT, closeT)) {
        throw new AppError(`Order booking is currently closed. Store hours are ${openT} to ${closeT}.`, 400);
      }
    }

    // Determine delivery type
    const effectiveDeliveryType = data.deliveryType === 'DELIVERY' ? 'DELIVERY' : 'PICKUP';

    // Verify all products exist, are in stock, and belong to the shop
    const productIds = data.items.map(i => i.productId);
        const now = new Date();
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, shopId: data.shopId, isActive: true },
      include: {
        flashSales: {
          where: { isActive: true, startTime: { lte: now }, endTime: { gte: now } }
        },
        promotedListings: {
          where: { isActive: true, startDate: { lte: now }, endDate: { gte: now } },
          select: { id: true }
        }
      }
    });

    if (products.length !== data.items.length) {
      throw new AppError('Some products are unavailable or do not belong to this shop.', 400);
    }

    const outOfStock = products.filter(p => !p.inStock || (typeof p.quantity === 'number' && p.quantity <= 0));
    if (outOfStock.length > 0) {
      throw new AppError(`Out of stock: ${outOfStock.map(p => p.name).join(', ')}`, 400);
    }

    const insufficientStock = data.items.filter(item => {
      const p = products.find(prod => prod.id === item.productId);
      return p && typeof p.quantity === 'number' && p.quantity < item.quantity;
    });
    if (insufficientStock.length > 0) {
      const names = insufficientStock.map(item => {
        const p = products.find(prod => prod.id === item.productId)!;
        return `${p.name} (only ${p.quantity} left)`;
      });
      throw new AppError(`Insufficient stock for: ${names.join(', ')}`, 400);
    }

    const defaultBookingAmount = typeof extSettings.defaultBookingAmount === 'number' && extSettings.defaultBookingAmount >= 0
      ? extSettings.defaultBookingAmount
      : 0;

    // Calculate totals using actual DB prices (not client-submitted prices) and booking amount
    let subtotal = 0;
    let totalBookingAmount = 0;
    const orderItems = data.items.map(item => {
      const product = products.find(p => p.id === item.productId)!;
      let actualPrice = product.price;
      if (product.flashSales && product.flashSales.length > 0) {
        const fs = product.flashSales[0];
        actualPrice = +(product.price * (1 - fs.discount / 100)).toFixed(2);
      }
      const itemTotal = +(actualPrice * item.quantity).toFixed(2);
      subtotal += itemTotal;

      // Product-level booking token (>0) or shop-wide default
      const rawProdBooking = typeof product.bookingAmount === 'number' ? product.bookingAmount : 0;
      const effectiveUnitBooking = rawProdBooking > 0 ? rawProdBooking : defaultBookingAmount;
      const itemBookingAmount = Math.min(effectiveUnitBooking, actualPrice);

      const itemHoldDuration =
        typeof (product as any).holdDurationMinutes === 'number' && (product as any).holdDurationMinutes >= 15
          ? (product as any).holdDurationMinutes
          : 180;

      totalBookingAmount += +(itemBookingAmount * item.quantity).toFixed(2);

      return {
        productId: item.productId,
        quantity: item.quantity,
        price: actualPrice,
        total: itemTotal,
        bookingAmount: itemBookingAmount,
        holdDurationMinutes: itemHoldDuration,
      };
    });

    const maxOrderHoldMinutes = Math.max(...orderItems.map((i) => i.holdDurationMinutes), 180);

    subtotal = +(subtotal.toFixed(2));
    totalBookingAmount = +(totalBookingAmount.toFixed(2));

    // Calculate delivery fee
    let deliveryFee = 0; // Booking platform, no delivery fee

    // Coupon / Abandoned cart voucher discount
    let discount = 0;
    let appliedVoucherCode: string | null = null;
    if (data.couponCode) {
      const voucherResult = await cartService.validateAndApplyVoucher(data.couponCode, userId, data.shopId, subtotal, deviceActorId);
      if (voucherResult.valid) {
        discount = voucherResult.discountAmount;
        appliedVoucherCode = voucherResult.code;
      }
    }

    const total = Math.max(0, +( (subtotal + deliveryFee - discount).toFixed(2) ));
    const effectiveBookingAmount = Math.min(totalBookingAmount, total);
    const orderNumber = `CLS${Date.now().toString(36).toUpperCase()}${nanoid(4).toUpperCase()}`;
    const orderCampaignId =
      data.items.find(i => i.campaignId)?.campaignId ||
      products.find(p => p.promotedListings && p.promotedListings.length > 0)?.promotedListings?.[0]?.id;

    // ============= WALLET COIN USAGE =============
    let coinsUsed = 0;
    let coinsCredited = 0;
    if (data.coinsToUse && data.coinsToUse > 0) {
      const wallet = await walletService.getOrCreateBuyerWallet(userId);
      const maxUsable = walletService.calculateMaxCoinUsage(wallet.balance, total);
      coinsUsed = Math.min(data.coinsToUse, maxUsable);
      coinsUsed = Math.floor(coinsUsed * 100) / 100; // Round to 2 decimal places
      if (coinsUsed > 0) {
        coinsCredited = coinsUsed; // Same amount goes to seller ad wallet
      }
    }

    const balanceAmount = Math.max(0, +( (total - effectiveBookingAmount - coinsUsed).toFixed(2) ));

    // Check if shop has autoConfirmBookings enabled (SEL-1: Prisma model ShopSettings with fallback to extSettings)
    const shopSettings = await prisma.shopSettings.findUnique({ where: { shopId: data.shopId } }).catch(() => null);
    const isAutoConfirm = shopSettings ? shopSettings.autoConfirmBookings : Boolean(extSettings.autoConfirmBookings);

    // ============= PICKUP SCHEDULE & CAPACITY (SEL-2) =============
    let pickupSlotStart: Date | null = null;
    let pickupSlotEnd: Date | null = null;

    if (effectiveDeliveryType === 'PICKUP') {
      if (data.pickupSlotStart) {
        pickupSlotStart = new Date(data.pickupSlotStart);
        if (isNaN(pickupSlotStart.getTime())) {
          throw new AppError('Invalid pickupSlotStart datetime format.', 400);
        }

        const slotDur = Math.max(15, Number(shopSettings?.slotDurationMin) || 30);
        pickupSlotEnd = data.pickupSlotEnd
          ? new Date(data.pickupSlotEnd)
          : new Date(pickupSlotStart.getTime() + slotDur * 60000);

        // Advance notice validation
        const advNotice = Math.max(0, Number(shopSettings?.advanceNoticeMin) || 15);
        if (pickupSlotStart.getTime() < Date.now() + advNotice * 60000 - 60000) {
          throw new AppError(`Pickup slot requires at least ${advNotice} minutes advance notice.`, 400);
        }

        // Closure validation
        const slotDateStr = pickupSlotStart.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
        const closure = await prisma.shopClosure.findUnique({
          where: { shopId_date: { shopId: data.shopId, date: slotDateStr } },
        });
        if (closure) {
          throw new AppError(`Shop is closed on ${slotDateStr}: ${closure.reason || 'Closed for holiday'}`, 400);
        }
      } else if (shopSettings?.allowWalkIns === false) {
        throw new AppError('This shop requires selecting a scheduled pickup slot. Walk-in visits are not accepted.', 400);
      }
    }

    const initialStatus = isAutoConfirm ? 'CONFIRMED' : 'PLACED';
    const initialStatusHistory = [
      {
        status: 'PLACED',
        note: 'Order placed',
        updatedAt: new Date().toISOString(),
        updatedBy: userId,
      },
      ...(isAutoConfirm
        ? [
            {
              status: 'CONFIRMED',
              note: 'Auto-confirmed by merchant booking settings',
              updatedAt: new Date().toISOString(),
              updatedBy: 'SYSTEM_AUTO_CONFIRM',
            },
          ]
        : []),
    ];

    // Create order with items in a transaction
    const order = await prisma.$transaction(async (tx) => {
      // Re-verify atomically within tx (SEL-1)
      const txSettings = await tx.shopSettings.findUnique({ where: { shopId: data.shopId } }).catch(() => null);
      const isAutoConfirmTx = txSettings ? txSettings.autoConfirmBookings : isAutoConfirm;

      // Atomic Slot Capacity Lock (SEL-2)
      if (pickupSlotStart) {
        const maxCapacity = Math.max(1, Number(shopSettings?.maxPerSlot) || 2);
        const bookedResult = await tx.$queryRawUnsafe<Array<{ booked: number }>>(`
          INSERT INTO shop_slot_counters (shop_id, slot_start, booked)
          VALUES ($1, $2, 1)
          ON CONFLICT (shop_id, slot_start)
          DO UPDATE SET booked = shop_slot_counters.booked + 1
          WHERE shop_slot_counters.booked < $3
          RETURNING booked;
        `, data.shopId, pickupSlotStart, maxCapacity);

        if (!bookedResult || bookedResult.length === 0) {
          throw new AppError('Selected pickup slot is already fully booked. Please choose another time slot.', 400);
        }
      }

      const newOrder = await tx.order.create({
        data: {
          orderNumber,
          userId,
          shopId: data.shopId,
          status: isAutoConfirmTx ? 'CONFIRMED' : 'PLACED',
          statusHistory: initialStatusHistory as any,
          subtotal,
          deliveryFee,
          discount,
          total,
          bookingAmount: effectiveBookingAmount,
          balanceAmount: balanceAmount,
          holdDurationMinutes: maxOrderHoldMinutes,
          pickupSlotStart,
          pickupSlotEnd,
          isDelivery: effectiveDeliveryType === 'DELIVERY',
          deliveryAddress: formatDeliveryAddress(data.deliveryAddress),
          deliveryLatitude:
            typeof data.deliveryAddress?.latitude === 'number'
              ? data.deliveryAddress.latitude
              : null,
          deliveryLongitude:
            typeof data.deliveryAddress?.longitude === 'number'
              ? data.deliveryAddress.longitude
              : null,
          paymentMethod: data.paymentMethod as any,
          paymentStatus: 'PENDING',
          coinsUsed,
          coinsCredited,
          buyerNote: data.notes || null,
          adCampaignId: orderCampaignId || null,
          items: { create: orderItems },
        },
        include: {
          items: true,
          shop: { select: { id: true, name: true, phone: true } },
        },
      });

      // Deduct stock immediately if auto-confirmed (atomic stock reservation via shared helper)
      if (isAutoConfirmTx) {
        await deductOrderStockTx(tx, orderItems);
      }

      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      // Update product order counts and ProductDailyAnalytics
      for (const item of orderItems) {
        await tx.product.update({
          where: { id: item.productId },
          data: { orderCount: { increment: item.quantity } },
        });
        await tx.productDailyAnalytics.upsert({
          where: { productId_date: { productId: item.productId, date: today } },
          update: {
            ordersCount: { increment: 1 },
            unitsSold: { increment: item.quantity },
            revenue: { increment: item.total },
          },
          create: {
            productId: item.productId,
            shopId: data.shopId,
            date: today,
            ordersCount: 1,
            unitsSold: item.quantity,
            revenue: item.total,
          },
        });
      }

      // Update shop order count
      await tx.shop.update({
        where: { id: data.shopId },
        data: { totalOrders: { increment: 1 } },
      });

        // Update PromotedListing revenue and conversions for each attributed item
        // We process attributions per campaign to handle multiple different campaigns in one order correctly
        const campaignTotals = new Map<string, { revenue: number, conversions: number }>();
        for (const item of orderItems) {
          // orderItems doesn't have campaignId, we need to look at data.items
          const originalItem = data.items.find(i => i.productId === item.productId);
          const product = products.find(p => p.id === item.productId);
          
          // SECURITY FIX: Only attribute if the client's campaignId exactly matches the database's active campaignId for this product
          const activeCampaign = (originalItem?.campaignId && product?.promotedListings?.find(l => l.id === originalItem.campaignId))
            || product?.promotedListings?.[0];
          if (activeCampaign) {
            const current = campaignTotals.get(activeCampaign.id) || { revenue: 0, conversions: 0 };
            campaignTotals.set(activeCampaign.id, {
              revenue: current.revenue + item.total,
              conversions: current.conversions + item.quantity
            });
          }
        }

        for (const [campaignId, stats] of campaignTotals.entries()) {
          await tx.promotedListing.update({
            where: { id: campaignId },
            data: { 
              revenue: { increment: stats.revenue },
              conversions: { increment: stats.conversions }
            }
          });

          await tx.adDailyMetricRollup.upsert({
            where: {
              promotedListingId_date_hour: {
                promotedListingId: campaignId,
                date: today,
                hour: 0,
              }
            },
            update: {
              conversions: { increment: stats.conversions },
              revenue: { increment: stats.revenue },
            },
            create: {
              promotedListingId: campaignId,
              date: today,
              hour: 0,
              impressions: 0,
              clicks: 0,
              spend: 0,
              views: 0,
              cartAdds: 0,
              conversions: stats.conversions,
              revenue: stats.revenue,
              uniqueReach: 0,
            }
          });
        }

      // Real-time ShopAnalytics update (reusing today)
      await tx.shopAnalytics.upsert({
        where: { shopId_date: { shopId: data.shopId, date: today } },
        update: { orders: { increment: 1 }, revenue: { increment: total } },
        create: { shopId: data.shopId, date: today, views: 0, uniqueViews: 0, orders: 1, revenue: total, calls: 0, whatsappClicks: 0, directions: 0 }
      });

      // ============= WALLET TRANSACTIONS =============
      if (coinsUsed > 0) {
        // 1. Debit buyer wallet
        const buyerWallet = await tx.buyerWallet.findUnique({ where: { userId } });
        if (!buyerWallet || buyerWallet.balance < coinsUsed) {
          throw new Error('Insufficient wallet balance for coin usage.');
        }
        const newBuyerBalance = buyerWallet.balance - coinsUsed;
        await tx.buyerWallet.update({
          where: { userId },
          data: {
            balance: { decrement: coinsUsed },
            spent: { increment: coinsUsed },
          },
        });
        await tx.walletTransaction.create({
          data: {
            walletId: buyerWallet.id,
            type: 'BOOKING_DEBIT',
            amount: coinsUsed,
            direction: 'DEBIT',
            balanceAfter: newBuyerBalance,
            description: `Coins used on order #${orderNumber}`,
            referenceId: newOrder.id,
            referenceType: 'ORDER',
          },
        });
      }

      return newOrder;
    });

    // Mark applied cart recovery voucher as redeemed
    if (appliedVoucherCode) {
      await cartService.markVoucherRedeemed(appliedVoucherCode, order.id).catch(err => {
        console.error('Failed to mark cart voucher redeemed:', err);
      });
    }

    // Clean up purchased items from user's persistent CartItem records
    const purchasedProductIds = data.items.map(i => i.productId);
    await prisma.cartItem.deleteMany({
      where: {
        userId,
        productId: { in: purchasedProductIds },
      },
    }).catch(err => {
      console.warn('Failed to clean up cart items post-checkout:', err);
    });

    // Send confirmation email (non-blocking)
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user?.email) {
      sendOrderConfirmationEmail(user.email, orderNumber, total).catch(() => { });
    }

    // Invalidate Redis caches for real-time fresh analytics
    await Promise.all([
      cacheDelete(`shop:${data.shopId}:ads`),
      cacheDeletePattern(`shop:${data.shopId}:analytics*`),
      cacheDelete(`shop:${data.shopId}:daily-metrics`),
    ]).catch(() => {});

    // Notify seller and customer in real-time
    try {
      const { orderSocket } = require('../../app');
      if (orderSocket) {
        orderSocket.notifyShopNewOrder(data.shopId, { ...order, autoConfirmed: isAutoConfirm });
        if (isAutoConfirm) {
          orderSocket.notifyCustomerOrderUpdate(
            order.id,
            'CONFIRMED',
            'Auto-confirmed by merchant booking settings'
          );
        }
        orderSocket.getIO().to(`shop:${data.shopId}`).emit('shop:ad-analytics-updated', {
          shopId: data.shopId,
          timestamp: new Date(),
        });
      }
    } catch (e) {
      console.warn('Socket emit failed for new order:', e);
    }

    // Push notification to buyer for auto-confirmed hold (SEL-1)
    if (isAutoConfirm && !userId.startsWith('anon_')) {
      notificationService.createNotification(userId, {
        title: 'Booking Confirmed! 🎉',
        body: `Your booking #${orderNumber} at ${order.shop?.name || 'the shop'} has been auto-confirmed and reserved.`,
        type: 'ORDER_UPDATE',
        data: { orderId: order.id, status: 'CONFIRMED' },
      }).catch(() => {});
    }

    // Schedule booking reminder 15m before pickup slot (SEL-3)
    if (order.pickupSlotStart) {
      scheduleBookingReminder(order.id, new Date(order.pickupSlotStart)).catch(() => {});
    }

    return order;
  }

  /**
   * Get user's orders
   */
  async getUserOrders(userId: string, params: { status?: string; page?: number; limit?: number }) {
    const { status, page = 1, limit = 20 } = params;

    let archivedIds: string[] = [];
    try {
      await ensureArchivedOrdersTables();
      const rows = await prisma.$queryRawUnsafe<Array<{ order_id: string }>>(
        `SELECT order_id FROM user_archived_orders WHERE user_id = $1`,
        userId
      );
      if (Array.isArray(rows)) {
        archivedIds = rows.map((r) => r.order_id);
      }
    } catch (_) {}

    const where: any = { userId };
    if (status) where.status = status;
    if (archivedIds.length > 0) {
      where.id = { notIn: archivedIds };
    }

    const [rawOrders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          items: {
            include: {
              product: { select: { id: true, name: true, images: true, price: true, mrp: true, bookingAmount: true } },
            },
          },
          shop: { select: { id: true, name: true, slug: true, phone: true } },
          returnRequests: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.order.count({ where }),
    ]);

    const orders = rawOrders.map(o => ({
      ...o,
      items: (o.items || []).map(item => ({
        ...item,
        product: item.product ? {
          ...item.product,
          images: Array.isArray(item.product.images) ? item.product.images.slice(0, 1) : [],
        } : item.product,
      })),
    }));

    return { orders, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  /**
   * Get order by ID (for buyer or shop owner)
   */
  async getOrderById(orderId: string, userId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, images: true, price: true } },
          },
        },
        shop: { select: { id: true, name: true, phone: true, ownerId: true, address: true } },
        user: { select: { id: true, name: true, phone: true } },
        returnRequests: true,
      },
    });

    if (!order) throw new AppError('Order not found.', 404);

    // Only buyer or shop owner can view
    if (order.userId !== userId && order.shop.ownerId !== userId) {
      throw new AppError('Not authorized.', 403);
    }

    return order;
  }

  /**
   * Get orders for a specific shop (seller view)
   */
  async getShopOrders(shopId: string, ownerId: string, params: { status?: string; page?: number; limit?: number }) {
    const shop = await prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) throw new AppError('Shop not found.', 404);
    if (shop.ownerId !== ownerId) throw new AppError('Not authorized.', 403);

    const { status, page = 1, limit = 20 } = params;

    let archivedIds: string[] = [];
    try {
      await ensureArchivedOrdersTables();
      const rows = await prisma.$queryRawUnsafe<Array<{ order_id: string }>>(
        `SELECT order_id FROM shop_archived_orders WHERE shop_id = $1`,
        shopId
      );
      archivedIds = (rows || []).map((r) => r.order_id);
    } catch (e) {
      console.error('Failed to read shop_archived_orders:', e);
    }

    const where: any = { shopId };
    if (status) where.status = status;
    if (archivedIds.length > 0) {
      where.id = { notIn: archivedIds };
    }

    const [rawOrders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          items: {
            include: {
              product: { select: { id: true, name: true, images: true, price: true, mrp: true, bookingAmount: true } },
            },
          },
          user: { select: { id: true, name: true, phone: true } },
          returnRequests: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.order.count({ where }),
    ]);

    const orders = rawOrders.map(o => ({
      ...o,
      items: (o.items || []).map(item => ({
        ...item,
        product: item.product ? {
          ...item.product,
          images: Array.isArray(item.product.images) ? item.product.images.slice(0, 1) : [],
        } : item.product,
      })),
    }));

    return { orders, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  /**
   * Update order status
   */
  async updateOrderStatus(orderId: string, userId: string, status: string, note?: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { shop: { select: { ownerId: true } } },
    });

    if (!order) throw new AppError('Order not found.', 404);

    // Only shop owner or admin can update status
    if (order.shop.ownerId !== userId) {
      throw new AppError('Not authorized to update this order.', 403);
    }

    // Validate status transition
    const validTransitions: Record<string, string[]> = {
      PLACED: ['CONFIRMED', 'CANCELLED'],
      CONFIRMED: ['PREPARING', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'],
      PREPARING: ['READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'],
      READY_FOR_PICKUP: ['DELIVERED', 'CANCELLED'],
      OUT_FOR_DELIVERY: ['DELIVERED', 'CANCELLED'],
      DELIVERED: ['REFUNDED'],
      CANCELLED: [],
      REFUNDED: [],
    };

    const allowed = validTransitions[order.status] || [];
    if (!allowed.includes(status)) {
      throw new AppError(`Cannot change status from ${order.status} to ${status}.`, 400);
    }

    const updateData: any = {
      status,
      statusHistory: [...toStatusHistory(order.statusHistory), {
        status,
        note: note || (status === 'CANCELLED' ? 'Declined by seller' : undefined),
        cancelledBy: status === 'CANCELLED' ? 'SELLER' : undefined,
        updatedAt: new Date().toISOString(),
        updatedBy: userId,
      }],
    };

    if (status === 'DELIVERED') {
      updateData.deliveredAt = new Date();
      if (order.paymentMethod === 'COD') {
        updateData.paymentStatus = 'COMPLETED';
      }
    }

    // Referral activation: when an order is delivered, check if this buyer
    // was referred and this is their first delivered order — activate the referral.
    let referralActivation = null;

    if (status === 'CANCELLED') {
      if (order.paymentStatus === 'COMPLETED') {
        updateData.paymentStatus = 'REFUND_PENDING';
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: updateData,
        include: { items: true, shop: { select: { name: true } } },
      });

      // Deduct stock when confirming (shared helper SEL-1)
      if (status === 'CONFIRMED' && order.status === 'PLACED') {
        await deductOrderStockTx(tx, updatedOrder.items);
      }

      // Restore stock when cancelling an already confirmed order
      if (status === 'CANCELLED' && ['CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY'].includes(order.status)) {
        for (const item of updatedOrder.items) {
          const product = await tx.product.findUnique({ where: { id: item.productId } });
          if (product && typeof product.quantity === 'number') {
            const newQuantity = product.quantity + item.quantity;
            await tx.product.update({
              where: { id: item.productId },
              data: {
                quantity: newQuantity,
                inStock: newQuantity > 0
              }
            });
          }
        }
      }

      // Release slot capacity when cancelling (SEL-2)
      if (status === 'CANCELLED' && order.pickupSlotStart) {
        await tx.$executeRawUnsafe(`
          UPDATE shop_slot_counters
          SET booked = GREATEST(0, booked - 1)
          WHERE shop_id = $1 AND slot_start = $2;
        `, order.shopId, order.pickupSlotStart);
      }

      if (status === 'CANCELLED' && order.status !== 'CANCELLED') {
        const orderDate = new Date(order.createdAt);
        orderDate.setUTCHours(0, 0, 0, 0);

        // Decrement product orderCounts, ProductDailyAnalytics, and shop totalOrders
        for (const item of updatedOrder.items) {
          await tx.product.updateMany({
            where: { id: item.productId, orderCount: { gt: 0 } },
            data: { orderCount: { decrement: item.quantity } },
          });
          await tx.productDailyAnalytics.updateMany({
            where: { productId: item.productId, date: orderDate },
            data: {
              ordersCount: { decrement: 1 },
              unitsSold: { decrement: item.quantity },
              revenue: { decrement: item.total },
            },
          });
        }
        await tx.shop.updateMany({
          where: { id: order.shopId, totalOrders: { gt: 0 } },
          data: { totalOrders: { decrement: 1 } },
        });

        await tx.shopAnalytics.upsert({
          where: { shopId_date: { shopId: order.shopId, date: orderDate } },
          update: { orders: { decrement: 1 }, revenue: { decrement: order.total } },
          create: { shopId: order.shopId, date: orderDate, views: 0, uniqueViews: 0, orders: 0, revenue: 0, calls: 0, whatsappClicks: 0, directions: 0 }
        });

        // REVERSE AD ATTRIBUTION (PromotedListing + AdDailyMetricRollup)
        if (updatedOrder.adCampaignId) {
          const reversedConversions = updatedOrder.items.reduce((sum, item) => sum + item.quantity, 0);
          const reversedRevenue = updatedOrder.items.reduce((sum, item) => sum + item.total, 0);
          
          await tx.promotedListing.updateMany({
            where: { id: updatedOrder.adCampaignId },
            data: {
              revenue: { decrement: reversedRevenue },
              conversions: { decrement: reversedConversions }
            }
          });

          await tx.adDailyMetricRollup.updateMany({
            where: {
              promotedListingId: updatedOrder.adCampaignId,
              date: orderDate,
              hour: 0,
            },
            data: {
              conversions: { decrement: reversedConversions },
              revenue: { decrement: reversedRevenue },
            }
          });
        }
      }

      return updatedOrder;
    });

    // Post-delivery: activate referral rewards and credit seller ad wallet BEFORE cache invalidation
    if (status === 'DELIVERED') {
      await this.processDeliveryReferral(order.userId).catch(() => {});
      
      if (order.coinsCredited > 0) {
        await walletService.creditSellerAdWallet(
          order.shopId,
          order.coinsCredited,
          `Ad credit from delivered order #${order.orderNumber}`,
          orderId,
          'ORDER'
        ).catch((err) => console.error('Failed to credit seller ad wallet on delivery:', err));
      }
    }

    // Always invalidate shop analytics & ads cache on any status change (PLACED -> CONFIRMED -> DELIVERED -> CANCELLED)
    try {
      if (
        (status === 'CONFIRMED' && order.status === 'PLACED') ||
        (status === 'CANCELLED' && ['CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY'].includes(order.status))
      ) {
        for (const item of updated.items) {
          await cacheDelete(`product:${item.productId}`);
        }
      }
      await Promise.all([
        cacheDeletePattern(`shop:${updated.shopId}*`),
        cacheDelete(`shop:${updated.shopId}:ads`),
      ]);
    } catch (err) {
      console.error('Failed to invalidate cache on order status update:', err);
    }

    // Cancel scheduled booking reminder if cancelled (SEL-3)
    if (status === 'CANCELLED') {
      cancelBookingReminder(orderId).catch(() => {});
    }

    // Notify buyer and seller in real-time
    try {
      const { orderSocket } = require('../../app');
      if (orderSocket) {
        orderSocket.notifyCustomerOrderUpdate(orderId, status, note);
        orderSocket.notifySellerOrderUpdate(updated.shopId, orderId, status, note);
        orderSocket.getIO().to(`shop:${updated.shopId}`).emit('shop:ad-analytics-updated', {
          shopId: updated.shopId,
          timestamp: new Date(),
        });
      }
    } catch (e) {
      console.warn('Socket emit failed for order update:', e);
    }

    // Push notification to buyer for confirmed order (SEL-1)
    if (status === 'CONFIRMED' && !order.userId.startsWith('anon_')) {
      notificationService.createNotification(order.userId, {
        title: 'Booking Confirmed! 🎉',
        body: `Your booking #${order.orderNumber} at ${updated.shop?.name || 'the shop'} has been confirmed.`,
        type: 'ORDER_UPDATE',
        data: { orderId: order.id, status: 'CONFIRMED' },
      }).catch(() => {});
    }

    // ============= REFUND COINS ON CANCELLATION =============
    if (status === 'CANCELLED' && order.coinsUsed > 0) {
      try {
        // 1. Refund buyer wallet
        const wallet = await prisma.buyerWallet.findUnique({ where: { userId: order.userId } });
        if (wallet) {
          await walletService.creditBuyerWallet(
            order.userId,
            order.coinsUsed,
            'BOOKING_REFUND',
            `Coins refunded from cancelled order #${order.orderNumber}`,
            orderId,
            'ORDER',
          );
        }
      } catch (walletError) {
        console.error('Wallet refund error on order status cancellation:', walletError);
      }
    }

    await recordAuditLog({
      actorId: userId,
      actorRole: 'SELLER',
      action: `ORDER_STATUS_${status}`,
      entityType: 'ORDER',
      entityId: orderId,
      metadata: {
        shopId: order.shopId,
        previousStatus: order.status,
        newStatus: status,
        note: note || null,
      },
    });

    return updated;
  }

  /**
   * Post-delivery processing: activates referral rewards if applicable.
   * Called after order status is set to DELIVERED.
   */
  private async processDeliveryReferral(userId: string) {
    try {
      const result = await walletService.activateReferralIfEligible(userId);
      if (result && result.amountCredited > 0) {
        // Send push notification to referrer
        await notificationService.createNotification(result.referrerId, {
          title: '🎉 Referral Reward!',
          body: `You earned ₹${result.amountCredited} coins! Your friend completed their first booking.`,
          type: 'REFERRAL_REWARD',
          relatedId: userId,
        });
      }
      return result;
    } catch (error) {
      // Non-blocking: don't fail the order update if referral processing errors
      console.error('Referral activation error:', error);
      return null;
    }
  }

  /**
   * Cancel order (by buyer)
   */
  async cancelOrder(orderId: string, userId: string, reason?: string) {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new AppError('Order not found.', 404);
    if (order.userId !== userId) throw new AppError('Not authorized.', 403);

    const cancellableStatuses = ['PLACED', 'CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP'];
    if (!cancellableStatuses.includes(order.status)) {
      throw new AppError('Order cannot be cancelled at this stage.', 400);
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'CANCELLED',
          ...(order.paymentStatus === 'COMPLETED' ? { paymentStatus: 'REFUND_PENDING' } : {}),
          statusHistory: [...toStatusHistory(order.statusHistory), {
            status: 'CANCELLED',
            note: reason || 'Cancelled by buyer',
            cancelledBy: 'BUYER',
            updatedAt: new Date().toISOString(),
            updatedBy: userId,
          }],
        },
        include: { items: true },
      });

      // Restore stock if stock was already deducted (CONFIRMED, PREPARING, READY_FOR_PICKUP)
      if (['CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP'].includes(order.status)) {
        for (const item of updatedOrder.items) {
          const product = await tx.product.findUnique({ where: { id: item.productId } });
          if (product && typeof (product as any).quantity === 'number') {
            const newQuantity = (product as any).quantity + item.quantity;
            await tx.product.update({
              where: { id: item.productId },
              data: {
                quantity: newQuantity,
                inStock: newQuantity > 0
              }
            });
          }
        }
      }

      // Release slot capacity when cancelling (SEL-2)
      if (status === 'CANCELLED' && order.pickupSlotStart) {
        await tx.$executeRawUnsafe(`
          UPDATE shop_slot_counters
          SET booked = GREATEST(0, booked - 1)
          WHERE shop_id = $1 AND slot_start = $2;
        `, order.shopId, order.pickupSlotStart);
      }

      // Real-time ShopAnalytics and ProductDailyAnalytics update (decrement)
      const today = new Date(order.createdAt);
      today.setUTCHours(0, 0, 0, 0);

      // Decrement product orderCounts, ProductDailyAnalytics, and shop totalOrders
      for (const item of updatedOrder.items) {
        await tx.product.updateMany({
          where: { id: item.productId, orderCount: { gt: 0 } },
          data: { orderCount: { decrement: item.quantity } },
        });
        await tx.productDailyAnalytics.updateMany({
          where: { productId: item.productId, date: today },
          data: {
            ordersCount: { decrement: 1 },
            unitsSold: { decrement: item.quantity },
            revenue: { decrement: item.total },
          },
        });
      }
      await tx.shop.updateMany({
        where: { id: order.shopId, totalOrders: { gt: 0 } },
        data: { totalOrders: { decrement: 1 } },
      });

      await tx.shopAnalytics.upsert({
        where: { shopId_date: { shopId: order.shopId, date: today } },
        update: { orders: { decrement: 1 }, revenue: { decrement: order.total } },
        create: { shopId: order.shopId, date: today, views: 0, uniqueViews: 0, orders: 0, revenue: 0, calls: 0, whatsappClicks: 0, directions: 0 }
      });

      // Reverse Ad Attribution if order was attributed to a campaign
      if (updatedOrder.adCampaignId) {
        const reversedConversions = updatedOrder.items.reduce((sum, item) => sum + item.quantity, 0);
        const reversedRevenue = updatedOrder.items.reduce((sum, item) => sum + item.total, 0);

        await tx.promotedListing.updateMany({
          where: { id: updatedOrder.adCampaignId },
          data: {
            revenue: { decrement: reversedRevenue },
            conversions: { decrement: reversedConversions }
          }
        });

        await tx.adDailyMetricRollup.updateMany({
          where: {
            promotedListingId: updatedOrder.adCampaignId,
            date: today,
            hour: 0,
          },
          data: {
            conversions: { decrement: reversedConversions },
            revenue: { decrement: reversedRevenue },
          }
        });
      }

      return updatedOrder;
    });

    // ============= REFUND COINS ON CANCELLATION =============
    if (order.coinsUsed > 0) {
      try {
        // 1. Refund buyer wallet
        const wallet = await prisma.buyerWallet.findUnique({ where: { userId } });
        if (wallet) {
          // Restore with same expiry (90 days from now)
          await walletService.creditBuyerWallet(
            userId,
            order.coinsUsed,
            'BOOKING_REFUND',
            `Coins refunded from cancelled order #${order.orderNumber}`,
            orderId,
            'ORDER',
          );
        }
      } catch (walletError) {
        // Non-blocking: log but don't fail the cancellation
        console.error('Wallet refund error on order cancellation:', walletError);
      }
    }

    // Always invalidate shop analytics & ads cache when buyer cancels order (including PLACED status)
    try {
      if (['CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP'].includes(order.status)) {
        for (const item of result.items) {
          await cacheDelete(`product:${item.productId}`);
        }
      }
      await Promise.all([
        cacheDeletePattern(`shop:${result.shopId}*`),
        cacheDelete(`shop:${result.shopId}:ads`),
      ]);
    } catch (err) {
      console.error('Failed to invalidate cache on order cancellation:', err);
    }

    // Cancel scheduled booking reminder (SEL-3)
    cancelBookingReminder(orderId).catch(() => {});

    // Notify seller in real-time
    try {
      const { orderSocket } = require('../../app');
      if (orderSocket) {
        orderSocket.notifySellerOrderUpdate(result.shopId, orderId, 'CANCELLED', reason || 'Cancelled by buyer');
        orderSocket.notifyCustomerOrderUpdate(orderId, 'CANCELLED', reason || 'Cancelled by buyer');
        orderSocket.getIO().to(`shop:${result.shopId}`).emit('shop:ad-analytics-updated', {
          shopId: result.shopId,
          timestamp: new Date(),
        });
      }
    } catch (e) {
      console.warn('Socket emit failed for order cancellation:', e);
    }

    // Trigger Razorpay Refund if applicable
    if (order.razorpayPaymentId && (order.paymentStatus === 'COMPLETED' || order.paymentStatus === 'PAID')) {
      try {
        await createRazorpayRefund(order.razorpayPaymentId, order.total, { orderId });
        await prisma.order.update({
          where: { id: orderId },
          data: { paymentStatus: 'REFUNDED' },
        });
      } catch (error: any) {
        console.error(`Refund failed for order ${orderId}: ${error.message || error.description}`);
        // We log the error but don't throw because the cancellation is already committed.
        // In a real production system, this would go to a DLQ for retry.
      }
    }

    return result;
  }

  /**
   * Request a return for an order
   */
  async requestReturn(orderId: string, userId: string, data: { reason: string; description?: string; photos?: string[] }) {
    const order = await prisma.order.findUnique({ where: { id: orderId, userId } });
    if (!order) throw new AppError('Order not found', 404);
    if (order.status !== 'DELIVERED') throw new AppError('Can only return delivered orders', 400);
    
    // Check if return exists
    const existing = await prisma.returnRequest.findFirst({ where: { orderId } });
    if (existing) throw new AppError('Return request already exists for this order', 400);

    const persistedPhotos = Array.isArray(data.photos) && data.photos.length > 0
      ? await persistImagesArray(data.photos, 'returns')
      : [];

    const returnReq = await prisma.returnRequest.create({
      data: {
        orderId,
        userId,
        reason: data.reason,
        description: data.description,
        photos: persistedPhotos,
        refundAmount: order.total
      }
    });

    return returnReq;
  }

  /**
   * Update a return request status (for sellers)
   */
  async updateReturnStatus(returnId: string, userId: string, status: 'APPROVED' | 'REJECTED' | 'REFUNDED', note?: string) {
    const returnReq = await prisma.returnRequest.findUnique({
      where: { id: returnId },
      include: { order: { include: { shop: true } } }
    });

    if (!returnReq) throw new AppError('Return request not found', 404);
    
    // Validate if the user is the owner of the shop or admin
    if (returnReq.order.shop.ownerId !== userId) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user?.role !== 'ADMIN') throw new AppError('Unauthorized to update this return', 403);
    }

    const updated = await prisma.returnRequest.update({
      where: { id: returnId },
      data: {
        status,
        sellerNote: note
      }
    });

    if (status === 'REFUNDED') {
      const history = toStatusHistory(returnReq.order.statusHistory);
      history.push({
        status: 'REFUNDED',
        note: note || 'Refund processed',
        updatedAt: new Date().toISOString(),
        updatedBy: userId,
      });

      // Trigger actual Razorpay Refund if applicable
      if (returnReq.order.razorpayPaymentId) {
        try {
          await createRazorpayRefund(
            returnReq.order.razorpayPaymentId,
            returnReq.refundAmount,
            { returnId: returnReq.id }
          );
        } catch (error: any) {
          throw new AppError(`Razorpay refund failed: ${error.message || error.description}`, 500);
        }
      }

      await prisma.order.update({
        where: { id: returnReq.orderId },
        data: {
          status: 'REFUNDED',
          paymentStatus: 'REFUNDED',
          statusHistory: history,
        }
      });

      await Promise.all([
        cacheDeletePattern(`shop:${returnReq.order.shopId}*`),
        cacheDelete(`shop:${returnReq.order.shopId}:ads`),
      ]).catch(() => {});

      // Reverse seller ad wallet credit if coins were credited
      if (returnReq.order.coinsCredited > 0) {
        walletService.debitSellerAdWallet(
          returnReq.order.shopId,
          returnReq.order.coinsCredited,
          `Ad credit reversed from refunded order #${returnReq.order.orderNumber}`,
          returnReq.order.id,
          'ORDER'
        ).catch((err) => console.error('Failed to reverse ad credit on return refund:', err));
      }
    }

    await recordAuditLog({
      actorId: userId,
      actorRole: 'SELLER',
      action: `RETURN_STATUS_${status}`,
      entityType: 'ORDER',
      entityId: returnReq.orderId,
      metadata: {
        returnId,
        shopId: returnReq.order.shopId,
        previousStatus: returnReq.status,
        newStatus: status,
        note: note || null,
      },
    });

    return updated;
  }

  /**
   * Archive / clear cancelled and refunded orders for a buyer
   */
  async clearCancelledOrders(userId: string) {
    await ensureArchivedOrdersTables();

    const cancelledOrders = await prisma.order.findMany({
      where: {
        userId,
        status: { in: ['CANCELLED', 'REFUNDED'] },
      },
      select: { id: true },
    });

    const archivedIds = cancelledOrders.map((o) => o.id);
    if (archivedIds.length > 0) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO user_archived_orders (user_id, order_id, archived_at)
         SELECT $1, unnest($2::text[]), NOW()
         ON CONFLICT (user_id, order_id) DO NOTHING`,
        userId,
        archivedIds
      );
    }

    return {
      success: true,
      clearedCount: archivedIds.length,
      archivedIds,
    };
  }

  /**
   * Archive a single rejected/cancelled order for a shop (seller view)
   */
  async archiveShopOrder(shopId: string, ownerId: string, orderId: string) {
    const shop = await prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) throw new AppError('Shop not found.', 404);
    if (shop.ownerId !== ownerId) throw new AppError('Not authorized.', 403);

    await ensureArchivedOrdersTables();

    await prisma.$executeRawUnsafe(
      `INSERT INTO shop_archived_orders (shop_id, order_id, archived_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (shop_id, order_id) DO NOTHING`,
      shopId,
      orderId
    );

    await recordAuditLog({
      actorId: ownerId,
      actorRole: 'SELLER',
      action: 'ORDER_ARCHIVED_BY_SHOP',
      entityType: 'SHOP',
      entityId: shopId,
      metadata: { orderId },
    });

    return { success: true, archivedOrderId: orderId };
  }

  /**
   * Archive / clear all cancelled and refunded orders for a shop (seller view)
   */
  async clearShopRejectedOrders(shopId: string, ownerId: string) {
    const shop = await prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) throw new AppError('Shop not found.', 404);
    if (shop.ownerId !== ownerId) throw new AppError('Not authorized.', 403);

    await ensureArchivedOrdersTables();

    const rejectedOrders = await prisma.order.findMany({
      where: {
        shopId,
        status: { in: ['CANCELLED', 'REFUNDED'] },
      },
      select: { id: true },
    });

    const archivedIds = rejectedOrders.map((o) => o.id);
    if (archivedIds.length > 0) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO shop_archived_orders (shop_id, order_id, archived_at)
         SELECT $1, unnest($2::text[]), NOW()
         ON CONFLICT (shop_id, order_id) DO NOTHING`,
        shopId,
        archivedIds
      );
    }

    await recordAuditLog({
      actorId: ownerId,
      actorRole: 'SELLER',
      action: 'REJECTED_ORDERS_CLEARED_BY_SHOP',
      entityType: 'SHOP',
      entityId: shopId,
      metadata: { clearedCount: archivedIds.length },
    });

    return {
      success: true,
      clearedCount: archivedIds.length,
      archivedIds,
    };
  }
}

export default new OrderService();
