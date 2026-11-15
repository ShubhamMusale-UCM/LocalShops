import prisma from '../../config/database';
import redis from '../../config/redis';
import { AppError } from '../../middleware/errorHandler.middleware';
import { persistBase64Image } from '../../utils/imageProcessor';
import { recordAuditLog } from '../../utils/auditLogger';

const DEFAULT_CATEGORIES_ORDER = [
  'electronics',
  'furniture',
  'automotive',
  'clothing',
  'footwear',
  'jewelry',
  'stationery',
  'sports',
  'grocery',
  'services',
  'other',
  'new-arrivals',
];

let categoryVisitsTableReady = false;
let alertPrefsTableReady = false;

async function ensureCategoryVisitsTable(): Promise<void> {
  if (categoryVisitsTableReady) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS user_category_visits (
      user_id TEXT NOT NULL,
      category TEXT NOT NULL,
      visit_count INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, category)
    );
  `);
  categoryVisitsTableReady = true;
}

async function ensureAlertPrefsTable(): Promise<void> {
  if (alertPrefsTableReady) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS user_alert_preferences (
      user_id TEXT PRIMARY KEY,
      sms_alerts BOOLEAN NOT NULL DEFAULT TRUE,
      hold_countdown BOOLEAN NOT NULL DEFAULT TRUE,
      flash_sales BOOLEAN NOT NULL DEFAULT FALSE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  alertPrefsTableReady = true;
}

export class UserService {
  async getUserById(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        shops: { where: { isActive: true }, select: { id: true, name: true, slug: true } },
        _count: { select: { orders: true, reviews: true, savedShops: true } },
        addressBook: true,
      },
    });
    if (!user) throw new AppError('User not found.', 404);
    return user;
  }

  async updateUser(userId: string, data: {
    name?: string; email?: string; avatar?: string;
    fcmToken?: string; latitude?: number; longitude?: number;
    address?: string; city?: string; pincode?: string;
  }) {
    const nextData = { ...data };
    if (nextData.avatar) {
      nextData.avatar = await persistBase64Image(nextData.avatar, 'avatars', 400, 82);
    }
    return prisma.user.update({ where: { id: userId }, data: nextData });
  }

  async upgradeToSeller(userId: string) {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { role: 'SELLER' },
    });
    
    // Check if shop already exists
    const existingShop = await prisma.shop.findFirst({ where: { ownerId: userId } });
    if (!existingShop) {
       await prisma.shop.create({
          data: {
             ownerId: userId,
             name: user.name ? `${user.name}'s Shop` : 'My Store',
             slug: `shop-${userId}-${Date.now()}`,
             description: 'Welcome to my shop!',
             category: 'General',
             phone: user.phone || '0000000000',
             address: user.address || '123 Local Street',
             city: user.city || 'City',
             state: 'State',
             pincode: user.pincode || '000000',
             latitude: user.latitude || 0,
             longitude: user.longitude || 0,
             operatingHours: { "monday": "9 AM - 6 PM" }
          }
       });
    }

    return user;
  }

  async updateLocation(userId: string, latitude: number, longitude: number, address?: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { latitude, longitude, address },
    });
  }

  async getReferralInfo(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { referralCode: true },
    });
    if (!user) throw new AppError('User not found.', 404);

    const earnings = await prisma.referralEarning.findMany({
      where: { referrerId: userId },
      orderBy: { createdAt: 'desc' },
    });

    const totalEarnings = earnings.reduce((sum, e) => sum + e.amount, 0);
    const pendingEarnings = earnings.filter(e => !e.isPaid).reduce((sum, e) => sum + e.amount, 0);

    return {
      referralCode: user.referralCode,
      totalReferrals: earnings.length,
      totalEarnings,
      pendingEarnings,
      earnings,
    };
  }
  async createSupportTicket(userId: string, data: { subject: string; description: string; orderId?: string }) {
    return prisma.supportTicket.create({
      data: {
        userId,
        subject: data.subject,
        description: data.description,
        orderId: data.orderId,
      }
    });
  }

  async getSupportTickets(userId: string) {
    return prisma.supportTicket.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
  }

  private buildRankedCategories(counts: Record<string, number>): string[] {
    const allKnown = new Set<string>([
      ...DEFAULT_CATEGORIES_ORDER,
      ...Object.keys(counts).filter((k) => k && k !== 'all'),
    ]);
    const list = Array.from(allKnown);
    list.sort((a, b) => {
      const countDiff = (counts[b] || 0) - (counts[a] || 0);
      if (countDiff !== 0) return countDiff;
      const idxA = DEFAULT_CATEGORIES_ORDER.indexOf(a);
      const idxB = DEFAULT_CATEGORIES_ORDER.indexOf(b);
      if (idxA === -1 && idxB === -1) return a.localeCompare(b);
      if (idxA === -1) return 1;
      if (idxB === -1) return -1;
      return idxA - idxB;
    });
    return ['all', ...list];
  }

  async getCategoryVisits(userId: string): Promise<{ counts: Record<string, number>; rankedCategories: string[] }> {
    const counts: Record<string, number> = {};
    const redisKey = `user:category_visits:${userId}`;

    try {
      const cached = await redis.hgetall(redisKey);
      if (cached && Object.keys(cached).length > 0) {
        for (const [cat, val] of Object.entries(cached)) {
          const parsed = parseInt(val, 10);
          if (!isNaN(parsed) && parsed > 0 && cat !== 'all') {
            counts[cat.toLowerCase()] = parsed;
          }
        }
        return {
          counts,
          rankedCategories: this.buildRankedCategories(counts),
        };
      }
    } catch (_) {}

    try {
      await ensureCategoryVisitsTable();
      const rows = await prisma.$queryRawUnsafe<Array<{ category: string; visit_count: number }>>(
        `SELECT category, visit_count FROM user_category_visits WHERE user_id = $1`,
        userId
      );
      for (const row of rows) {
        const cat = String(row.category || '').toLowerCase();
        const cnt = Number(row.visit_count || 0);
        if (cat && cat !== 'all' && cnt > 0) {
          counts[cat] = cnt;
        }
      }
      if (Object.keys(counts).length > 0) {
        try {
          await redis.hset(redisKey, counts as any);
        } catch (_) {}
      }
    } catch (_) {}

    return {
      counts,
      rankedCategories: this.buildRankedCategories(counts),
    };
  }

  async recordCategoryVisit(userId: string, rawCategory: string): Promise<{
    category: string;
    count: number;
    counts: Record<string, number>;
    rankedCategories: string[];
  }> {
    const category = String(rawCategory || '').trim().toLowerCase();
    if (!category || category === 'all') {
      const current = await this.getCategoryVisits(userId);
      return {
        category: 'all',
        count: 0,
        counts: current.counts,
        rankedCategories: current.rankedCategories,
      };
    }

    let updatedCount = 1;
    try {
      await ensureCategoryVisitsTable();
      const rows = await prisma.$queryRawUnsafe<Array<{ visit_count: number }>>(
        `INSERT INTO user_category_visits (user_id, category, visit_count, updated_at)
         VALUES ($1, $2, 1, NOW())
         ON CONFLICT (user_id, category)
         DO UPDATE SET visit_count = user_category_visits.visit_count + 1, updated_at = NOW()
         RETURNING visit_count`,
        userId,
        category
      );
      if (rows && rows[0]) {
        updatedCount = Number(rows[0].visit_count);
      }
    } catch (_) {}

    const redisKey = `user:category_visits:${userId}`;
    try {
      if (updatedCount > 1) {
        await redis.hset(redisKey, category, String(updatedCount));
      } else {
        updatedCount = await redis.hincrby(redisKey, category, 1);
      }
    } catch (_) {}

    const current = await this.getCategoryVisits(userId);
    current.counts[category] = Math.max(current.counts[category] || 0, updatedCount);
    current.rankedCategories = this.buildRankedCategories(current.counts);

    return {
      category,
      count: current.counts[category],
      counts: current.counts,
      rankedCategories: current.rankedCategories,
    };
  }

  async getAlertPreferences(userId: string): Promise<{ sms: boolean; holdCountdown: boolean; flashSales: boolean }> {
    try {
      await ensureAlertPrefsTable();
      const rows = await prisma.$queryRawUnsafe<Array<{
        sms_alerts: boolean;
        hold_countdown: boolean;
        flash_sales: boolean;
      }>>(
        `SELECT sms_alerts, hold_countdown, flash_sales FROM user_alert_preferences WHERE user_id = $1`,
        userId
      );
      if (rows && rows[0]) {
        return {
          sms: Boolean(rows[0].sms_alerts),
          holdCountdown: Boolean(rows[0].hold_countdown),
          flashSales: Boolean(rows[0].flash_sales),
        };
      }
    } catch (_) {}
    return { sms: true, holdCountdown: true, flashSales: false };
  }

  async updateAlertPreferences(
    userId: string,
    prefs: { sms?: boolean; holdCountdown?: boolean; flashSales?: boolean }
  ): Promise<{ sms: boolean; holdCountdown: boolean; flashSales: boolean }> {
    const current = await this.getAlertPreferences(userId);
    const next = {
      sms: typeof prefs.sms === 'boolean' ? prefs.sms : current.sms,
      holdCountdown: typeof prefs.holdCountdown === 'boolean' ? prefs.holdCountdown : current.holdCountdown,
      flashSales: typeof prefs.flashSales === 'boolean' ? prefs.flashSales : current.flashSales,
    };
    try {
      await ensureAlertPrefsTable();
      await prisma.$executeRawUnsafe(
        `INSERT INTO user_alert_preferences (user_id, sms_alerts, hold_countdown, flash_sales, updated_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (user_id)
         DO UPDATE SET sms_alerts = $2, hold_countdown = $3, flash_sales = $4, updated_at = NOW()`,
        userId,
        next.sms,
        next.holdCountdown,
        next.flashSales
      );
    } catch (_) {}
    return next;
  }

  async requestAccountDeletion(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        shops: {
          select: { id: true, name: true },
        },
      },
    });

    if (!user) throw new AppError('User not found.', 404);

    if (user.shops && user.shops.length > 0) {
      const shopIds = user.shops.map(s => s.id);
      const activeShopOrders = await prisma.order.count({
        where: {
          shopId: { in: shopIds },
          status: { in: ['PLACED', 'CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP'] },
        },
      });
      if (activeShopOrders > 0) {
        throw new AppError(
          `Cannot request account deletion while you have ${activeShopOrders} active order(s) awaiting fulfillment in your shops. Please fulfill or resolve them first.`,
          400
        );
      }
    }

    const activeBuyerOrders = await prisma.order.count({
      where: {
        userId,
        status: { in: ['PLACED', 'CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP'] },
      },
    });
    if (activeBuyerOrders > 0) {
      throw new AppError(
        `Cannot request account deletion while you have ${activeBuyerOrders} active order(s) in progress. Please await delivery or cancel them before proceeding.`,
        400
      );
    }

    const deletionRequestedAt = new Date();
    const scheduledDeletionDate = new Date(deletionRequestedAt.getTime() + 14 * 24 * 60 * 60 * 1000);

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        deletionStatus: 'PENDING_DELETION',
        deletionRequestedAt,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        deletionStatus: true,
        deletionRequestedAt: true,
      },
    });

    await recordAuditLog({
      action: 'ACCOUNT_DELETION_REQUESTED',
      actorId: userId,
      actorRole: user.role,
      entityType: 'USER',
      entityId: userId,
      metadata: {
        requestedAt: deletionRequestedAt.toISOString(),
        scheduledDeletionDate: scheduledDeletionDate.toISOString(),
        gracePeriodDays: 14,
      },
    });

    return {
      status: 'PENDING_DELETION',
      deletionRequestedAt,
      scheduledDeletionDate,
      gracePeriodDays: 14,
      message: 'Account scheduled for permanent anonymization in 14 days. You can cancel anytime before this date by selecting Cancel Deletion.',
    };
  }

  async cancelAccountDeletion(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError('User not found.', 404);

    if (user.deletionStatus !== 'PENDING_DELETION') {
      return {
        message: 'No pending account deletion request found.',
        deletionStatus: user.deletionStatus || 'ACTIVE',
      };
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        deletionStatus: null,
        deletionRequestedAt: null,
      },
    });

    await recordAuditLog({
      action: 'ACCOUNT_DELETION_CANCELLED',
      actorId: userId,
      actorRole: user.role,
      entityType: 'USER',
      entityId: userId,
      metadata: { cancelledAt: new Date().toISOString() },
    });

    return {
      message: 'Account deletion request successfully cancelled. Your account remains active.',
      deletionStatus: 'ACTIVE',
    };
  }

  async exportUserData(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        role: true,
        referralCode: true,
        referredBy: true,
        address: true,
        city: true,
        pincode: true,
        createdAt: true,
        updatedAt: true,
        deletionStatus: true,
        deletionRequestedAt: true,
        addressBook: true,
        orders: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            total: true,
            items: true,
            createdAt: true,
            shop: {
              select: { id: true, name: true, city: true },
            },
          },
        },
        reviews: {
          select: {
            id: true,
            rating: true,
            comment: true,
            createdAt: true,
            productId: true,
          },
        },
        wishlist: {
          select: {
            id: true,
            productId: true,
            createdAt: true,
          },
        },
        supportTickets: {
          select: {
            id: true,
            subject: true,
            description: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });

    if (!user) throw new AppError('User not found.', 404);

    const alertPreferences = await this.getAlertPreferences(userId);

    return {
      exportMetadata: {
        exportVersion: '1.0',
        exportedAt: new Date().toISOString(),
        legalNotice: 'CityLocalShop User Data Export prepared in accordance with Digital Personal Data Protection (DPDP) Act 2023.',
      },
      profile: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role,
        referralCode: user.referralCode,
        referredBy: user.referredBy,
        location: {
          address: user.address,
          city: user.city,
          pincode: user.pincode,
        },
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        deletionStatus: user.deletionStatus,
        deletionRequestedAt: user.deletionRequestedAt,
      },
      alertPreferences,
      savedAddresses: user.addressBook,
      orderHistory: user.orders,
      productReviews: user.reviews,
      wishlist: user.wishlist,
      supportTickets: user.supportTickets,
    };
  }

  async processPendingDeletions() {
    const cutoffDate = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const usersToDelete = await prisma.user.findMany({
      where: {
        deletionStatus: 'PENDING_DELETION',
        deletionRequestedAt: { lte: cutoffDate },
      },
    });

    const results = [];
    for (const u of usersToDelete) {
      try {
        const anonymizedPhone = `deleted_${u.id.replace(/-/g, '').slice(0, 10)}_${Date.now()}`;
        const anonymizedEmail = `deleted_${u.id.replace(/-/g, '').slice(0, 10)}@anonymized.citylocalshop.in`;

        await prisma.wishlist.deleteMany({ where: { userId: u.id } });
        await prisma.savedShop.deleteMany({ where: { userId: u.id } });
        await prisma.notification.deleteMany({ where: { userId: u.id } });
        await prisma.addressBook.deleteMany({ where: { userId: u.id } });
        await prisma.userSearchHistory.deleteMany({ where: { userId: u.id } });

        await prisma.user.update({
          where: { id: u.id },
          data: {
            name: 'Deleted User',
            phone: anonymizedPhone,
            email: anonymizedEmail,
            avatar: null,
            fcmToken: null,
            address: null,
            latitude: null,
            longitude: null,
            isActive: false,
            deletionStatus: 'DELETED',
          },
        });

        await recordAuditLog({
          action: 'ACCOUNT_DELETION_EXECUTED',
          actorId: 'SYSTEM_JOB',
          actorRole: 'SYSTEM',
          entityType: 'USER',
          entityId: u.id,
          metadata: { anonymizedAt: new Date().toISOString() },
        });

        results.push({ id: u.id, status: 'DELETED' });
      } catch (err: any) {
        results.push({ id: u.id, status: 'ERROR', error: err.message });
      }
    }
    return results;
  }
}

export default new UserService();
