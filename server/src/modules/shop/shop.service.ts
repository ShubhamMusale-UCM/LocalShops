import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler.middleware';
import { getBoundingBox, haversineDistance } from '../../utils/geoUtils';
import redis, { cacheGet, cacheSet, cacheDeletePattern } from '../../config/redis';
import slugify from 'slugify';
import { nanoid } from 'nanoid';
import { NotificationService } from '../notification/notification.service';
import { persistBase64Image, persistImagesArray } from '../../utils/imageProcessor';
import {
  encryptSensitiveField,
  decryptSensitiveField,
  maskAccountNumber,
  maskPanNumber,
} from '../../utils/cryptoVault';
import { recordAuditLog, getEntityAuditLogs } from '../../utils/auditLogger';

const notificationService = new NotificationService();

const ENCRYPTED_SETTINGS_KEYS = new Set(['accountNumber', 'ifscCode', 'panNumber', 'upiId']);

export const PUBLIC_SHOP_SETTINGS_KEYS = new Set([
  'openingTime',
  'closingTime',
  'workingDays',
  'orderAcceptanceStart',
  'orderAcceptanceEnd',
  'orderTimingType',
  'closedDates',
  'defaultBookingAmount',
  'allowWalkIns',
  'slotDuration',
  'advanceNotice',
  'abandonedCartRecoveryEnabled',
  'abandonedCartDiscountPercent',
  'abandonedCartHours',
]);

export const PRIVATE_SHOP_SETTINGS_KEYS = new Set([
  'bankName',
  'accountHolder',
  'accountNumber',
  'accountNumberMasked',
  'ifscCode',
  'upiId',
  'razorpayAccountId',
  'panNumber',
  'panNumberMasked',
  'gstNumber',
  'fssaiNumber',
  'legalEntityName',
  'grievanceOfficerName',
  'grievanceEmail',
  'grievancePhone',
]);

const PRISMA_SHOP_UPDATE_KEYS = new Set([
  'name',
  'description',
  'logo',
  'coverImage',
  'photos',
  'phone',
  'whatsapp',
  'email',
  'website',
  'address',
  'landmark',
  'city',
  'state',
  'pincode',
  'latitude',
  'longitude',
  'category',
  'subCategories',
  'gstNumber',
  'operatingHours',
  'isOpen',
  'razorpayAccountId',
  'deliveryEnabled',
  'deliveryRadius',
  'minOrderDelivery',
]);

const EXTENDED_SHOP_SETTINGS_KEYS = new Set([
  'fssaiNumber',
  'panNumber',
  'legalEntityName',
  'grievanceOfficerName',
  'grievanceEmail',
  'grievancePhone',
  'bankName',
  'accountHolder',
  'accountNumber',
  'ifscCode',
  'upiId',
  'openingTime',
  'closingTime',
  'workingDays',
  'orderAcceptanceStart',
  'orderAcceptanceEnd',
  'orderTimingType',
  'closedDates',
  'defaultBookingAmount',
  'autoConfirmBookings',
  'slotDuration',
  'maxPerSlot',
  'allowWalkIns',
  'advanceNotice',
  'soundAlerts',
  'bookingAlerts',
  'dailyDigest',
  'abandonedCartRecoveryEnabled',
  'abandonedCartDiscountPercent',
  'abandonedCartHours',
]);

export class ShopService {
  private extTableInitialized = false;

  private async ensureExtendedSettingsTable() {
    if (this.extTableInitialized) return;
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS shop_extended_settings (
        shop_id TEXT PRIMARY KEY,
        settings JSONB NOT NULL DEFAULT '{}'::jsonb,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    this.extTableInitialized = true;
  }

  private decryptSettingsRow(raw: Record<string, any>): Record<string, any> {
    if (!raw || typeof raw !== 'object') return {};
    const out: Record<string, any> = { ...raw };
    for (const k of ENCRYPTED_SETTINGS_KEYS) {
      if (out[k]) {
        out[k] = decryptSensitiveField(out[k]);
      }
    }
    if (out.accountNumber) {
      out.accountNumberMasked = maskAccountNumber(out.accountNumber);
    }
    if (out.panNumber) {
      out.panNumberMasked = maskPanNumber(out.panNumber);
    }
    return out;
  }

  private pickPublicSettings(settings: Record<string, any>): Record<string, any> {
    const pub: Record<string, any> = {};
    for (const k of PUBLIC_SHOP_SETTINGS_KEYS) {
      if (settings[k] !== undefined) pub[k] = settings[k];
    }
    return pub;
  }

  async getExtendedShopSettings(shopId: string): Promise<Record<string, any>> {
    let settings: Record<string, any> = {};
    try {
      await this.ensureExtendedSettingsTable();
      const rows = await prisma.$queryRawUnsafe<Array<{ settings: any }>>(
        `SELECT settings FROM shop_extended_settings WHERE shop_id = $1 LIMIT 1`,
        shopId
      );
      if (rows && rows.length > 0 && rows[0].settings && typeof rows[0].settings === 'object') {
        settings = this.decryptSettingsRow(rows[0].settings);
      }
    } catch (e) {
      console.error('Failed to read shop_extended_settings:', e);
    }

    try {
      const [dbSettings, dbClosures] = await Promise.all([
        prisma.shopSettings.findUnique({ where: { shopId } }),
        prisma.shopClosure.findMany({ where: { shopId }, select: { date: true }, orderBy: { date: 'asc' } }),
      ]);

      if (dbSettings) {
        if (dbSettings.defaultBookingAmount !== undefined) settings.defaultBookingAmount = dbSettings.defaultBookingAmount;
        if (dbSettings.openingTime) settings.openingTime = dbSettings.openingTime;
        if (dbSettings.closingTime) settings.closingTime = dbSettings.closingTime;
        if (dbSettings.workingDays && Array.isArray(dbSettings.workingDays)) {
          settings.workingDays = dbSettings.workingDays;
        }
        if (dbSettings.autoConfirmBookings !== undefined) settings.autoConfirmBookings = dbSettings.autoConfirmBookings;
        if (dbSettings.slotDurationMin !== undefined) settings.slotDuration = `${dbSettings.slotDurationMin}m`;
        if (dbSettings.advanceNoticeMin !== undefined) settings.advanceNotice = `${dbSettings.advanceNoticeMin}m`;
        if (dbSettings.allowWalkIns !== undefined) settings.allowWalkIns = dbSettings.allowWalkIns;
        if (dbSettings.maxPerSlot !== undefined) settings.maxPerSlot = dbSettings.maxPerSlot;
        if (dbSettings.notificationToggles && typeof dbSettings.notificationToggles === 'object') {
          const nt = dbSettings.notificationToggles as any;
          if (nt.dailyDigest !== undefined) settings.dailyDigest = nt.dailyDigest;
          if (nt.soundAlerts !== undefined) settings.soundAlerts = nt.soundAlerts;
          if (nt.bookingAlerts !== undefined) settings.bookingAlerts = nt.bookingAlerts;
        }
      }

      if (dbClosures && dbClosures.length > 0) {
        settings.closedDates = dbClosures.map((c) => c.date);
      }
    } catch (e) {
      console.error('Failed to merge ShopSettings in getExtendedShopSettings:', e);
    }

    return settings;
  }

  async getExtendedShopSettingsBatch(shopIds: string[]): Promise<Map<string, Record<string, any>>> {
    const map = new Map<string, Record<string, any>>();
    if (!shopIds.length) return map;
    try {
      await this.ensureExtendedSettingsTable();
      const rows = await prisma.$queryRawUnsafe<Array<{ shop_id: string; settings: any }>>(
        `SELECT shop_id, settings FROM shop_extended_settings WHERE shop_id = ANY($1::text[])`,
        shopIds
      );
      for (const r of rows || []) {
        if (r.settings && typeof r.settings === 'object') {
          map.set(r.shop_id, this.decryptSettingsRow(r.settings));
        }
      }
    } catch (e) {
      console.error('Failed to batch-read shop_extended_settings:', e);
    }

    try {
      const [dbSettingsList, dbClosuresList] = await Promise.all([
        prisma.shopSettings.findMany({ where: { shopId: { in: shopIds } } }),
        prisma.shopClosure.findMany({ where: { shopId: { in: shopIds } }, select: { shopId: true, date: true }, orderBy: { date: 'asc' } }),
      ]);

      const closuresByShop = new Map<string, string[]>();
      dbClosuresList.forEach((c) => {
        if (!closuresByShop.has(c.shopId)) closuresByShop.set(c.shopId, []);
        closuresByShop.get(c.shopId)!.push(c.date);
      });

      for (const dbSettings of dbSettingsList) {
        const existing = map.get(dbSettings.shopId) || {};
        if (dbSettings.defaultBookingAmount !== undefined) existing.defaultBookingAmount = dbSettings.defaultBookingAmount;
        if (dbSettings.openingTime) existing.openingTime = dbSettings.openingTime;
        if (dbSettings.closingTime) existing.closingTime = dbSettings.closingTime;
        if (dbSettings.workingDays && Array.isArray(dbSettings.workingDays)) {
          existing.workingDays = dbSettings.workingDays;
        }
        if (dbSettings.autoConfirmBookings !== undefined) existing.autoConfirmBookings = dbSettings.autoConfirmBookings;
        if (dbSettings.slotDurationMin !== undefined) existing.slotDuration = `${dbSettings.slotDurationMin}m`;
        if (dbSettings.advanceNoticeMin !== undefined) existing.advanceNotice = `${dbSettings.advanceNoticeMin}m`;
        if (dbSettings.allowWalkIns !== undefined) existing.allowWalkIns = dbSettings.allowWalkIns;
        if (dbSettings.maxPerSlot !== undefined) existing.maxPerSlot = dbSettings.maxPerSlot;
        if (dbSettings.notificationToggles && typeof dbSettings.notificationToggles === 'object') {
          const nt = dbSettings.notificationToggles as any;
          if (nt.dailyDigest !== undefined) existing.dailyDigest = nt.dailyDigest;
          if (nt.soundAlerts !== undefined) existing.soundAlerts = nt.soundAlerts;
          if (nt.bookingAlerts !== undefined) existing.bookingAlerts = nt.bookingAlerts;
        }
        if (closuresByShop.has(dbSettings.shopId)) {
          existing.closedDates = closuresByShop.get(dbSettings.shopId);
        }
        map.set(dbSettings.shopId, existing);
      }
    } catch (e) {
      console.error('Failed to merge ShopSettings in getExtendedShopSettingsBatch:', e);
    }

    return map;
  }

  async saveExtendedShopSettings(shopId: string, patch: Record<string, any>): Promise<Record<string, any>> {
    await this.ensureExtendedSettingsTable();
    const current = await this.getExtendedShopSettings(shopId);
    const mergedPlain = { ...current, ...patch };
    delete mergedPlain.accountNumberMasked;
    delete mergedPlain.panNumberMasked;

    // Encrypt sensitive banking & PAN fields at rest in PostgreSQL
    const toStore: Record<string, any> = { ...mergedPlain };
    for (const k of ENCRYPTED_SETTINGS_KEYS) {
      if (toStore[k]) {
        toStore[k] = encryptSensitiveField(String(toStore[k]));
      }
    }

    await prisma.$executeRawUnsafe(
      `INSERT INTO shop_extended_settings (shop_id, settings, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (shop_id) DO UPDATE SET
         settings = EXCLUDED.settings,
         updated_at = NOW()`,
      shopId,
      JSON.stringify(toStore)
    );

    // Sync to typed Prisma model ShopSettings (SEL-1)
    let slotDurationMin = 30;
    if (typeof mergedPlain.slotDuration === 'number') slotDurationMin = mergedPlain.slotDuration;
    else if (typeof mergedPlain.slotDuration === 'string') {
      const match = mergedPlain.slotDuration.match(/\d+/);
      if (match) slotDurationMin = parseInt(match[0], 10);
    }

    const maxPerSlot = parseInt(mergedPlain.maxPerSlot, 10) || 2;
    let advanceNoticeMin = 15;
    if (typeof mergedPlain.advanceNotice === 'number') advanceNoticeMin = mergedPlain.advanceNotice;
    else if (typeof mergedPlain.advanceNotice === 'string') {
      const match = mergedPlain.advanceNotice.match(/\d+/);
      if (match) advanceNoticeMin = parseInt(match[0], 10);
    }

    let workingDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    if (Array.isArray(mergedPlain.workingDays)) {
      workingDays = mergedPlain.workingDays;
    } else if (typeof mergedPlain.workingDays === 'string') {
      if (mergedPlain.workingDays.includes('-')) {
        workingDays = [mergedPlain.workingDays.trim()];
      } else {
        workingDays = mergedPlain.workingDays.split(',').map(d => d.trim()).filter(Boolean);
      }
    }

    await prisma.shopSettings.upsert({
      where: { shopId },
      update: {
        autoConfirmBookings: Boolean(mergedPlain.autoConfirmBookings),
        slotDurationMin,
        maxPerSlot,
        allowWalkIns: mergedPlain.allowWalkIns !== false,
        advanceNoticeMin,
        openingTime: mergedPlain.openingTime || '09:00',
        closingTime: mergedPlain.closingTime || '21:00',
        workingDays,
        defaultBookingAmount: Number(mergedPlain.defaultBookingAmount || 0),
        notificationToggles: {
          dailyDigest: Boolean(mergedPlain.dailyDigest),
          soundAlerts: Boolean(mergedPlain.soundAlerts),
          bookingAlerts: Boolean(mergedPlain.bookingAlerts),
        },
      },
      create: {
        shopId,
        autoConfirmBookings: Boolean(mergedPlain.autoConfirmBookings),
        slotDurationMin,
        maxPerSlot,
        allowWalkIns: mergedPlain.allowWalkIns !== false,
        advanceNoticeMin,
        openingTime: mergedPlain.openingTime || '09:00',
        closingTime: mergedPlain.closingTime || '21:00',
        workingDays,
        defaultBookingAmount: Number(mergedPlain.defaultBookingAmount || 0),
        notificationToggles: {
          dailyDigest: Boolean(mergedPlain.dailyDigest),
          soundAlerts: Boolean(mergedPlain.soundAlerts),
          bookingAlerts: Boolean(mergedPlain.bookingAlerts),
        },
      },
    }).catch(err => {
      console.warn('Failed to sync shopSettings in Prisma:', err.message);
    });

    if (Array.isArray(mergedPlain.closedDates)) {
      try {
        await prisma.$transaction(async (tx) => {
          await tx.shopClosure.deleteMany({ where: { shopId } });
          const validDates = mergedPlain.closedDates
            .filter((d: any) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.trim()))
            .map((d: string) => d.trim());
          if (validDates.length > 0) {
            await tx.shopClosure.createMany({
              data: validDates.map((dateStr: string) => ({
                shopId,
                date: dateStr,
                reason: 'Scheduled Closure',
              })),
              skipDuplicates: true,
            });
          }
        });
      } catch (err: any) {
        console.warn('Failed to sync shop_closures in Prisma:', err.message);
      }
    }

    return this.decryptSettingsRow(toStore);
  }
  /**
   * Create a new shop
   */
  async createShop(ownerId: string, data: any) {
    // Check subscription limit
    const existingShops = await prisma.shop.count({ where: { ownerId, isActive: true } });
    if (existingShops >= 3) {
      throw new AppError('Maximum 3 shops per account.', 400);
    }

    const slug = slugify(data.name, { lower: true, strict: true }) + '-' + nanoid(4);
    const logo = data.logo ? await persistBase64Image(data.logo, 'shops') : data.logo;
    const coverImage = data.coverImage ? await persistBase64Image(data.coverImage, 'shops') : data.coverImage;
    const photos = Array.isArray(data.photos) ? await persistImagesArray(data.photos, 'shops') : [];

    const shop = await prisma.shop.create({
      data: {
        ...data,
        logo,
        coverImage,
        ownerId,
        slug,
        subCategories: data.subCategories || [],
        photos,
      },
    });

    await cacheDeletePattern('shops:nearby:*');
    return shop;
  }

  /**
   * Get shop by ID with related data
   */
  async getShopById(shopId: string) {
    const cacheKey = `shop:${shopId}`;
    const cached = await cacheGet(cacheKey);

    // Log shop view asynchronously
    this.logShopView(shopId).catch(() => { });

    if (cached) return cached;

    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      include: {
        owner: { select: { id: true, name: true, avatar: true } },
        products: {
          where: { isActive: true },
          take: 20,
          orderBy: { orderCount: 'desc' },
          include: {
            promotedListings: {
              where: { isActive: true, startDate: { lte: new Date() }, endDate: { gte: new Date() } },
              select: { id: true }
            }
          }
        },
        stories: {
          where: { expiresAt: { gte: new Date() } },
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: { products: true, reviews: true, orders: true, savedBy: true },
        },
      },
    });

    if (!shop) throw new AppError('Shop not found.', 404);

    const extSettings = await this.getExtendedShopSettings(shopId);
    const publicExt = this.pickPublicSettings(extSettings);

    // Strip private payout/tax fields from public GET /api/shops/:id response
    const { gstNumber: _gst, razorpayAccountId: _rzp, ...publicShopFields } = shop as any;
    const mergedPublicShop = { ...publicExt, ...publicShopFields, extendedSettings: publicExt };

    await cacheSet(cacheKey, mergedPublicShop, 600); // 10 min cache
    return mergedPublicShop;
  }

  /**
   * Get shop by slug
   */
  async getShopBySlug(slug: string) {
    const shop = await prisma.shop.findUnique({
      where: { slug },
      include: {
        owner: { select: { id: true, name: true, avatar: true } },
        _count: { select: { products: true, reviews: true } },
      },
    });

    if (!shop || !shop.isActive) throw new AppError('Shop not found.', 404);

    // Log shop view asynchronously
    this.logShopView(shop.id).catch(() => { });

    return shop;
  }

  /**
   * Search shops by name or description
   */
  async searchShops(query: string) {
    if (!query) return [];
    return prisma.shop.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } }
        ],
        isActive: true,
      },
      take: 20,
    });
  }

  /**
   * Log shop view asynchronously
   */
  async logShopView(shopId: string, viewerId?: string) {
    try {
      await redis.hincrby('telemetry:views:shop', shopId, 1);
      if (viewerId) {
        const dateKey = new Date().toISOString().slice(0, 10);
        await Promise.all([
          redis.pfadd(`hll:shop:view:${dateKey}:${shopId}`, viewerId),
          redis.expire(`hll:shop:view:${dateKey}:${shopId}`, 172800),
        ]);
      }
      const { runTelemetrySyncNow } = require('../../jobs/telemetrySync.job');
      runTelemetrySyncNow().catch(() => { });
    } catch (e) {
      console.error('Failed to buffer shop view in redis:', e);
    }
  }

  /**
   * Log high-intent offline showroom action (direction, call, whatsapp)
   */
  async logShopIntent(shopId: string, type: 'call' | 'whatsapp' | 'direction', userOrDeviceId: string) {
    try {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      // Deduplicate per user/device per 30 mins in Redis
      const dedupKey = `dedup:shop_intent:${type}:${shopId}:${userOrDeviceId}`;
      const isFirst = await redis.set(dedupKey, '1', 'EX', 1800, 'NX');
      if (!isFirst) return;

      const fieldMap: Record<string, any> = {
        call: { calls: { increment: 1 } },
        whatsapp: { whatsappClicks: { increment: 1 } },
        direction: { directions: { increment: 1 } },
      };

      await prisma.shopAnalytics.upsert({
        where: { shopId_date: { shopId, date: today } },
        update: fieldMap[type],
        create: {
          shopId,
          date: today,
          calls: type === 'call' ? 1 : 0,
          whatsappClicks: type === 'whatsapp' ? 1 : 0,
          directions: type === 'direction' ? 1 : 0,
          views: 0,
          uniqueViews: 0,
          productImpressions: 0,
          productDetailViews: 0,
          cartAdds: 0,
          orders: 0,
          revenue: 0,
        },
      });

      await cacheDeletePattern(`shop:${shopId}:analytics*`).catch(() => { });
      try {
        const { orderSocket } = require('../../app');
        if (orderSocket) {
          orderSocket.getIO().to(`shop:${shopId}`).emit('shop:ad-analytics-updated', {
            shopId,
            timestamp: new Date(),
          });
        }
      } catch (_) { }
    } catch (e) {
      console.error('Failed to log shop intent:', e);
    }
  }


  /**
   * Find nearby shops using bounding box + distance calculation
   */
  async getNearbyShops(params: {
    latitude: number;
    longitude: number;
    radius?: number;
    category?: string;
    page?: number;
    limit?: number;
    sort?: string;
  }) {
    const {
      latitude, longitude,
      radius = 5,
      category,
      page = 1,
      limit = 20,
      sort = 'distance',
    } = params;

    const cacheKey = `shops:nearby:${latitude.toFixed(2)}:${longitude.toFixed(2)}:${radius}:${category || 'all'}:${sort}:${page}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return cached;

    const bbox = getBoundingBox(latitude, longitude, radius);

    const where: any = {
      isActive: true,
      latitude: { gte: bbox.minLat, lte: bbox.maxLat },
      longitude: { gte: bbox.minLng, lte: bbox.maxLng },
    };

    if (category) where.category = category;

    let orderBy: any;
    switch (sort) {
      case 'rating': orderBy = { averageRating: 'desc' }; break;
      case 'popularity': orderBy = { totalOrders: 'desc' }; break;
      case 'newest': orderBy = { createdAt: 'desc' }; break;
      default: orderBy = { createdAt: 'desc' }; // Distance sorted post-query
    }

    const [shops, total] = await Promise.all([
      prisma.shop.findMany({
        where,
        include: {
          _count: { select: { products: true, reviews: true } },
        },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.shop.count({ where }),
    ]);

    // Calculate distance and filter by exact radius
    const shopsWithDistance = shops
      .map(shop => ({
        ...shop,
        distance_km: haversineDistance(latitude, longitude, shop.latitude, shop.longitude),
      }))
      .filter(shop => shop.distance_km <= radius);

    // Sort by distance if requested
    if (sort === 'distance') {
      shopsWithDistance.sort((a, b) => a.distance_km - b.distance_km);
    }

    const result = {
      shops: shopsWithDistance,
      pagination: {
        page, limit, total,
        totalPages: Math.ceil(total / limit),
      },
    };

    await cacheSet(cacheKey, result, 300); // 5 min cache
    return result;
  }

  /**
   * Update shop (supports both core Prisma columns and extended compliance/payout/booking/alert settings)
   */
  async updateShop(shopId: string, ownerId: string, data: any) {
    const shop = await prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) throw new AppError('Shop not found.', 404);
    if (shop.ownerId !== ownerId) throw new AppError('Not authorized.', 403);

    const nextData = { ...data };
    if (nextData.logo) nextData.logo = await persistBase64Image(nextData.logo, 'shops');
    if (nextData.coverImage) nextData.coverImage = await persistBase64Image(nextData.coverImage, 'shops');
    if (Array.isArray(nextData.photos)) nextData.photos = await persistImagesArray(nextData.photos, 'shops');

    const prismaPayload: Record<string, any> = {};
    const extendedPayload: Record<string, any> = {};

    for (const [key, value] of Object.entries(nextData)) {
      if (value === undefined) continue;
      if (PRISMA_SHOP_UPDATE_KEYS.has(key)) {
        prismaPayload[key] = value;
      }
      if (EXTENDED_SHOP_SETTINGS_KEYS.has(key)) {
        extendedPayload[key] = value;
      }
    }

    let updatedShopRecord = shop;
    if (Object.keys(prismaPayload).length > 0) {
      updatedShopRecord = await prisma.shop.update({ where: { id: shopId }, data: prismaPayload });
    }

    let extSettings = await this.getExtendedShopSettings(shopId);
    if (Object.keys(extendedPayload).length > 0) {
      extSettings = await this.saveExtendedShopSettings(shopId, extendedPayload);
    }

    await Promise.all([
      cacheDeletePattern(`shop:${shopId}*`),
      cacheDeletePattern(`*${shopId}*`),
      cacheDeletePattern('shops:nearby:*'),
    ]);

    recordAuditLog({
      actorId: ownerId,
      actorRole: 'SELLER',
      action: 'SHOP_UPDATED',
      entityType: 'SHOP',
      entityId: shopId,
      changes: { ...prismaPayload, ...extendedPayload },
    }).catch(() => { });

    return { ...extSettings, ...updatedShopRecord, extendedSettings: extSettings };
  }

  /**
   * Get shops owned by a user (hydrated with extended seller settings via single batch query — zero N+1)
   */
  async getMyShops(ownerId: string) {
    const shops = await prisma.shop.findMany({
      where: { ownerId, isActive: true },
      include: {
        _count: { select: { products: true, orders: true, reviews: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const settingsByShop = await this.getExtendedShopSettingsBatch(shops.map((s) => s.id));
    return shops.map((s) => {
      const ext = settingsByShop.get(s.id) || {};
      return { ...ext, ...s, extendedSettings: ext };
    });
  }

  /**
   * Get private compliance, payout, and operational settings for shop owner/admin
   */
  async getPrivateShopSettings(shopId: string, requesterId: string, requesterRole?: string) {
    const shop = await prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) throw new AppError('Shop not found.', 404);
    if (shop.ownerId !== requesterId && requesterRole !== 'ADMIN') {
      throw new AppError('Not authorized.', 403);
    }
    const settings = await this.getExtendedShopSettings(shopId);
    return {
      gstNumber: shop.gstNumber || '',
      razorpayAccountId: shop.razorpayAccountId || '',
      ...settings,
    };
  }

  /**
   * Get audit trail for a shop (owner or admin only)
   */
  async getShopAuditLogs(shopId: string, ownerId: string) {
    const shop = await prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) throw new AppError('Shop not found.', 404);
    if (shop.ownerId !== ownerId) throw new AppError('Not authorized.', 403);
    return getEntityAuditLogs('SHOP', shopId, 50);
  }

  /**
   * Generate a real-time Daily Schedule Digest report for a shop
   */
  async getDailyDigestReport(shopId: string, ownerId: string) {
    const shop = await prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) throw new AppError('Shop not found.', 404);
    if (shop.ownerId !== ownerId) throw new AppError('Not authorized.', 403);

    const extSettings = await this.getExtendedShopSettings(shopId);
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [todayOrders, activeHolds, lowStockCount] = await Promise.all([
      prisma.order.findMany({
        where: { shopId, createdAt: { gte: startOfToday } },
        include: { items: true, user: { select: { name: true, phone: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.order.findMany({
        where: {
          shopId,
          status: { in: ['PLACED', 'CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP'] },
        },
        include: { items: true, user: { select: { name: true, phone: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.product.count({
        where: { shopId, isActive: true, quantity: { lte: 3 } },
      }),
    ]);

    const todayRevenue = todayOrders
      .filter((o) => o.status !== 'CANCELLED' && o.status !== 'REFUNDED')
      .reduce((sum, o) => sum + Number(o.total || 0), 0);

    const pendingApprovalCount = activeHolds.filter((o) => o.status === 'PLACED').length;
    const readyForPickupCount = activeHolds.filter((o) =>
      ['CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP'].includes(o.status)
    ).length;

    const dateLabel = new Date().toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    const whatsappSummary = [
      `📊 *${shop.name} — Daily Showroom Digest* (${dateLabel})`,
      `• Active Showroom Holds: *${activeHolds.length}* (${pendingApprovalCount} awaiting approval, ${readyForPickupCount} ready for pickup)`,
      `• Today's Bookings: *${todayOrders.length}*`,
      `• Today's Value: *₹${todayRevenue.toLocaleString('en-IN')}*`,
      `• Low Stock Alerts: *${lowStockCount} items*`,
      `• Store Hours: ${extSettings.openingTime || '09:00'} – ${extSettings.closingTime || '21:00'}`,
    ].join('\n');

    return {
      shopId: shop.id,
      shopName: shop.name,
      whatsapp: shop.whatsapp || shop.phone,
      dateLabel,
      todayBookingsCount: todayOrders.length,
      todayRevenue,
      activeHoldsCount: activeHolds.length,
      pendingApprovalCount,
      readyForPickupCount,
      lowStockCount,
      activeHolds: activeHolds.slice(0, 10).map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        total: o.total,
        buyerName: o.user?.name || 'Customer',
        buyerPhone: o.user?.phone || '',
        itemCount: o.items?.length || 0,
        createdAt: o.createdAt,
      })),
      whatsappSummary,
    };
  }

  /**
   * Save/unsave a shop
   */
  async toggleSaveShop(userId: string, shopId: string) {
    const existing = await prisma.savedShop.findUnique({
      where: { userId_shopId: { userId, shopId } },
    });

    if (existing) {
      await prisma.savedShop.delete({ where: { id: existing.id } });
      return { saved: false };
    }

    await prisma.savedShop.create({ data: { userId, shopId } });
    return { saved: true };
  }

  /**
   * Get saved shops for a user
   */
  async getSavedShops(userId: string) {
    return prisma.savedShop.findMany({
      where: { userId },
      include: {
        shop: {
          include: { _count: { select: { products: true, reviews: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get shop analytics (for shop owner)
   */
  async getShopAnalytics(shopId: string, ownerId: string, days: number = 30) {
    const safeDays = Number.isFinite(Number(days))
      ? Math.min(365, Math.max(1, Math.round(Number(days))))
      : 30;
    days = safeDays;

    const shop = await prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) throw new AppError('Shop not found.', 404);
    if (shop.ownerId !== ownerId) throw new AppError('Not authorized.', 403);

    const cacheKey = `shop:${shopId}:analytics:${days}`;
    const cachedData = await cacheGet(cacheKey);
    if (cachedData) return cachedData;

    const timeZone = 'Asia/Kolkata';
    const now = new Date();
    const todayStr = now.toLocaleDateString('en-CA', { timeZone }); // YYYY-MM-DD
    const todayStart = new Date(`${todayStr}T00:00:00+05:30`);

    let since: Date;
    if (days === 1) {
      since = todayStart;
    } else {
      since = new Date(todayStart.getTime() - (days - 1) * 86400000);
    }

    const weeklyLabels = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(todayStart.getTime() - (6 - i) * 86400000);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone });
    });

    const analytics = await prisma.shopAnalytics.findMany({
      where: { shopId, date: { gte: since } },
      orderBy: { date: 'asc' },
    });

    const totals = analytics.reduce(
      (acc, day) => ({
        views: acc.views + day.views,
        uniqueViews: acc.uniqueViews + day.uniqueViews,
        productImpressions: acc.productImpressions + ((day as any).productImpressions || 0),
        productDetailViews: acc.productDetailViews + ((day as any).productDetailViews || 0),
        cartAdds: acc.cartAdds + ((day as any).cartAdds || 0),
        orders: acc.orders + day.orders,
        revenue: acc.revenue + day.revenue,
        calls: acc.calls + day.calls,
        whatsappClicks: acc.whatsappClicks + day.whatsappClicks,
        directions: acc.directions + day.directions,
      }),
      {
        views: 0,
        uniqueViews: 0,
        productImpressions: 0,
        productDetailViews: 0,
        cartAdds: 0,
        orders: 0,
        revenue: 0,
        calls: 0,
        whatsappClicks: 0,
        directions: 0,
      }
    );

    // Calculate 7-day trailing data (ALWAYS 7 days regardless of the top filter) using SQL groupBy / bounded daily rollups
    const sevenDaysAgoStart = new Date(todayStart.getTime() - 6 * 86400000);

    const [past7DaysOrdersRaw, past7DaysAnalytics, past7DaysAdRollups] = await Promise.all([
      prisma.$queryRaw<{ day_str: string; revenue: number; cnt: number }[]>`
        SELECT TO_CHAR(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') AS day_str,
               COALESCE(SUM(total), 0)::float AS revenue,
               COUNT(*)::int AS cnt
        FROM "Order"
        WHERE "shopId" = ${shopId}
          AND "createdAt" >= ${sevenDaysAgoStart}
          AND status NOT IN ('CANCELLED', 'REFUNDED')
        GROUP BY day_str
      `,
      prisma.shopAnalytics.findMany({
        where: { shopId, date: { gte: sevenDaysAgoStart } },
        select: { date: true, views: true },
      }),
      prisma.adDailyMetricRollup.findMany({
        where: { promotedListing: { shopId }, date: { gte: sevenDaysAgoStart } },
        select: { date: true, views: true, impressions: true },
      }),
    ]);

    const weeklyRevenue = Array(7).fill(0);
    const weeklyOrders = Array(7).fill(0);
    const weeklyViews = Array(7).fill(0);

    past7DaysOrdersRaw.forEach((row) => {
      const target = new Date(`${row.day_str}T00:00:00+05:30`);
      const diffDays = Math.round((todayStart.getTime() - target.getTime()) / 86400000);
      if (diffDays >= 0 && diffDays < 7) {
        weeklyRevenue[6 - diffDays] += Number(row.revenue || 0);
        weeklyOrders[6 - diffDays] += Number(row.cnt || 0);
      }
    });

    past7DaysAnalytics.forEach((a) => {
      const aDateStr = new Date(a.date).toLocaleDateString('en-CA', { timeZone });
      const target = new Date(`${aDateStr}T00:00:00+05:30`);
      const diffDays = Math.round((todayStart.getTime() - target.getTime()) / 86400000);
      if (diffDays >= 0 && diffDays < 7) {
        weeklyViews[6 - diffDays] += a.views;
      }
    });

    past7DaysAdRollups.forEach((a) => {
      const aDateStr = new Date(a.date).toLocaleDateString('en-CA', { timeZone });
      const target = new Date(`${aDateStr}T00:00:00+05:30`);
      const diffDays = Math.round((todayStart.getTime() - target.getTime()) / 86400000);
      if (diffDays >= 0 && diffDays < 7) {
        weeklyViews[6 - diffDays] += (a.views || 0);
      }
    });

    // Top products — rank strictly by period sales/views/impressions, then take top 20
    const allShopProducts = await prisma.product.findMany({
      where: { shopId, isActive: true },
      orderBy: [{ orderCount: 'desc' }, { viewCount: 'desc' }],
      take: 100,
      include: {
        _count: { select: { wishlistedBy: true, cartItems: true } },
      },
    });

    const shopProductIds = allShopProducts.map((p) => p.id);
    const [topProductsDailyAgg, topProductsOrderItemsAgg, productAdRollups] =
      shopProductIds.length > 0
        ? await Promise.all([
          prisma.productDailyAnalytics.groupBy({
            by: ['productId'],
            where: { productId: { in: shopProductIds }, date: { gte: since } },
            _sum: {
              impressions: true,
              adImpressions: true,
              detailViews: true,
              adClicks: true,
              cartAdds: true,
              unitsSold: true,
              revenue: true,
            },
          }),
          prisma.orderItem.groupBy({
            by: ['productId'],
            where: {
              productId: { in: shopProductIds },
              order: { shopId, createdAt: { gte: since }, status: { notIn: ['CANCELLED', 'REFUNDED'] } },
            },
            _sum: { quantity: true, total: true },
          }),
          prisma.adDailyMetricRollup.findMany({
            where: {
              promotedListing: { shopId, productId: { in: shopProductIds } },
              date: { gte: since },
            },
            select: {
              impressions: true,
              clicks: true,
              promotedListing: { select: { productId: true } },
            },
          }),
        ])
        : [[], [], []];

    const dailyAggMap = new Map(
      topProductsDailyAgg.map((d) => [
        d.productId,
        {
          impressions: d._sum.impressions || 0,
          adImpressions: d._sum.adImpressions || 0,
          views: d._sum.detailViews || 0,
          adClicks: d._sum.adClicks || 0,
          cartAdds: d._sum.cartAdds || 0,
        },
      ])
    );
    const orderItemsAggMap = new Map(
      topProductsOrderItemsAgg.map((o) => [
        o.productId,
        {
          unitsSold: o._sum.quantity || 0,
          revenue: o._sum.total || 0,
        },
      ])
    );
    const productAdRollupMap = new Map<string, { impressions: number; clicks: number }>();
    for (const r of productAdRollups) {
      const pid = r.promotedListing?.productId;
      if (!pid) continue;
      const cur = productAdRollupMap.get(pid) || { impressions: 0, clicks: 0 };
      cur.impressions += r.impressions || 0;
      cur.clicks += r.clicks || 0;
      productAdRollupMap.set(pid, cur);
    }

    const periodDays = days;

    const topProducts = allShopProducts
      .map((p) => {
        const orderAgg = orderItemsAggMap.get(p.id) || { unitsSold: 0, revenue: 0 };
        const unitsSold = orderAgg.unitsSold;
        const revenue = orderAgg.revenue;

        // Period daily telemetry aggregated in PostgreSQL
        const periodDaily = dailyAggMap.get(p.id) || {
          impressions: 0,
          adImpressions: 0,
          views: 0,
          adClicks: 0,
          cartAdds: 0,
        };
        const rollupAd = productAdRollupMap.get(p.id) || { impressions: 0, clicks: 0 };

        const adImpressions = Math.max(periodDaily.adImpressions, rollupAd.impressions);
        const adClicks = Math.max(periodDaily.adClicks, rollupAd.clicks);

        const lifetimeViews = p.viewCount ?? 0;
        const periodViews = periodDaily.views || 0;
        const periodImpressions = periodDaily.impressions || 0;

        // Period views for accurate period analytics report
        const views = periodViews;

        // Combined impressions and clicks in the selected period
        const totalPeriodImpressions = periodImpressions + adImpressions;
        const totalPeriodClicks = periodViews + adClicks;

        // Safe impressions ensures impressions >= clicks to avoid >100% or divide-by-zero artifacts
        const safeImpressions = Math.max(totalPeriodImpressions, totalPeriodClicks);

        const ctr = safeImpressions > 0 && totalPeriodClicks > 0
          ? Math.min(100, Math.max(0, (totalPeriodClicks / safeImpressions) * 100)).toFixed(2)
          : '0.00';

        const dailyVelocity = unitsSold / periodDays;
        const daysOfStockLeft = p.quantity !== null && p.quantity !== undefined
          ? (p.quantity <= 0 ? 0 : dailyVelocity > 0 ? Math.floor(p.quantity / dailyVelocity) : null)
          : null;

        return {
          id: p.id,
          sku: p.sku || null,
          name: p.name,
          images: Array.isArray(p.images) ? p.images.slice(0, 1) : [],
          price: p.price,
          category: p.category,
          inStock: p.inStock,
          quantity: p.quantity,
          lowStockThreshold: p.lowStockThreshold ?? 5,
          units: unitsSold,
          orderCount: p.orderCount ?? 0,
          viewCount: lifetimeViews,
          views: views,
          periodViews,
          periodImpressions,
          impressions: totalPeriodImpressions,
          clicks: adClicks,
          revenue: revenue,
          ctr,
          wishlistCount: (p as any)._count?.wishlistedBy || 0,
          inCartCount: (p as any)._count?.cartItems || 0,
          daysOfStockLeft,
        };
      })
      .sort((a, b) =>
        (b.revenue - a.revenue) ||
        (b.units - a.units) ||
        (b.views - a.views) ||
        (b.impressions - a.impressions) ||
        (b.orderCount - a.orderCount)
      )
      .slice(0, 20);

    // Parallelize all independent database & Redis aggregations for sub-30ms cold execution
    const prevPeriodStart = new Date(since.getTime() - days * 86400000);
    const { AdsService } = require('../ads/ads.service');
    const adsService = new AdsService();

    const [
      adMetrics,
      abandonedCartSql,
      orderMetrics,
      orderStatusGroups,
      adAttributionGroups,
      recentSlaOrders,
      customerRetentionSql,
      oosViewsVal,
      prevOrderMetrics,
      productDailySumAgg,
      activeProductsCount,
      campaignsData,
      initialTopKeywords,
    ] = await Promise.all([
      prisma.adDailyMetricRollup.aggregate({
        where: { promotedListing: { shopId }, date: { gte: since } },
        _sum: { clicks: true, impressions: true, spend: true },
      }),
      prisma.$queryRaw<{ shoppers_cnt: number; items_cnt: number; val: number }[]>`
        SELECT COUNT(DISTINCT ci."userId")::int AS shoppers_cnt,
               COUNT(ci.id)::int AS items_cnt,
               COALESCE(SUM(ci.quantity * p.price), 0)::float AS val
        FROM "CartItem" ci
        JOIN "Product" p ON p.id = ci."productId"
        WHERE p."shopId" = ${shopId}
      `,
      prisma.order.aggregate({
        where: {
          shopId,
          createdAt: { gte: since },
          status: { notIn: ['CANCELLED', 'REFUNDED'] },
        },
        _sum: { total: true },
        _count: { id: true },
      }),
      prisma.order.groupBy({
        by: ['status'],
        where: {
          shopId,
          createdAt: { gte: since },
        },
        _sum: { total: true },
        _count: { id: true },
      }),
      prisma.order.groupBy({
        by: ['adCampaignId'],
        where: {
          shopId,
          createdAt: { gte: since },
          status: { notIn: ['CANCELLED', 'REFUNDED'] },
        },
        _sum: { total: true },
        _count: { id: true },
      }),
      prisma.order.findMany({
        where: {
          shopId,
          createdAt: { gte: since },
        },
        orderBy: { createdAt: 'desc' },
        take: 250,
        select: {
          statusHistory: true,
          createdAt: true,
        },
      }),
      prisma.$queryRaw<{ total_buyers: number; repeat_buyers: number }[]>`
        SELECT COUNT(*)::int AS total_buyers,
               COUNT(*) FILTER (WHERE cnt > 1)::int AS repeat_buyers
        FROM (
          SELECT "userId", COUNT(*) AS cnt
          FROM "Order"
          WHERE "shopId" = ${shopId}
            AND status NOT IN ('CANCELLED', 'REFUNDED')
          GROUP BY "userId"
        ) sub
      `,
      redis.hget(`telemetry:shop:oos_views:${todayStr}`, shopId),
      prisma.order.aggregate({
        where: {
          shopId,
          createdAt: { gte: prevPeriodStart, lt: since },
          status: { notIn: ['CANCELLED', 'REFUNDED'] },
        },
        _sum: { total: true },
        _count: { id: true },
      }),
      prisma.productDailyAnalytics.aggregate({
        where: { shopId, date: { gte: since } },
        _sum: { impressions: true, detailViews: true, cartAdds: true },
      }),
      prisma.product.count({ where: { shopId, isActive: true, inStock: true } }),
      adsService.getShopPromotionAnalytics(shopId),
      prisma.searchKeywordStat.groupBy({
        by: ['keyword'],
        where: {
          shopId,
          date: { gte: since },
        },
        _sum: {
          searches: true,
          clicks: true,
        },
        orderBy: {
          _sum: { searches: 'desc' },
        },
        take: 25,
      }),
    ]);

    let realTotalAdClicks = adMetrics._sum?.clicks ?? 0;
    let realTotalAdImpressions = adMetrics._sum?.impressions ?? 0;
    let realAdSpent = adMetrics._sum?.spend ?? 0;

    const abandonedCartShoppers = Number(abandonedCartSql[0]?.shoppers_cnt ?? 0);
    const abandonedCartItems = Number(abandonedCartSql[0]?.items_cnt ?? 0);
    const abandonedCartValue = Number(abandonedCartSql[0]?.val ?? 0);

    const realRevenue = orderMetrics._sum.total || 0;
    const realOrdersCount = orderMetrics._count.id || 0;

    let realizedRevenue = 0;
    let deliveredOrdersCount = 0;
    let pendingRevenue = 0;
    let pendingOrdersCount = 0;
    let lostRevenue = 0;
    let lostOrdersCount = 0;

    for (const group of orderStatusGroups) {
      const amt = group._sum.total || 0;
      const cnt = group._count.id || 0;
      if (group.status === 'DELIVERED') {
        realizedRevenue += amt;
        deliveredOrdersCount += cnt;
      } else if (['CANCELLED', 'REFUNDED'].includes(group.status)) {
        lostRevenue += amt;
        lostOrdersCount += cnt;
      } else {
        // PLACED, CONFIRMED, PREPARING, READY_FOR_PICKUP, OUT_FOR_DELIVERY, or any new active/in-flight status
        pendingRevenue += amt;
        pendingOrdersCount += cnt;
      }
    }

    const totalPlacedOrders = deliveredOrdersCount + pendingOrdersCount + lostOrdersCount;
    const cancellationRate = totalPlacedOrders > 0
      ? Number(((lostOrdersCount / totalPlacedOrders) * 100).toFixed(1))
      : 0;

    let organicRevenue = 0;
    let organicOrders = 0;
    let promotedRevenue = 0;
    let promotedOrders = 0;

    for (const grp of adAttributionGroups) {
      const amt = grp._sum.total || 0;
      const cnt = grp._count.id || 0;
      if (grp.adCampaignId) {
        promotedRevenue += amt;
        promotedOrders += cnt;
      } else {
        organicRevenue += amt;
        organicOrders += cnt;
      }
    }

    const acceptanceTimes: number[] = [];
    for (const o of recentSlaOrders) {
      const history = Array.isArray(o.statusHistory) ? o.statusHistory : [];
      const placedEntry = history.find((h: any) => h.status === 'PLACED');
      const confirmedEntry = history.find((h: any) => h.status === 'CONFIRMED');
      if (confirmedEntry && (confirmedEntry as any).updatedAt) {
        const placedTime = placedEntry && (placedEntry as any).updatedAt
          ? new Date((placedEntry as any).updatedAt).getTime()
          : new Date(o.createdAt).getTime();
        const confirmedTime = new Date((confirmedEntry as any).updatedAt).getTime();
        const diffMin = (confirmedTime - placedTime) / 60000;
        if (diffMin >= 0 && diffMin < 10080) { // under 7 days
          acceptanceTimes.push(diffMin);
        }
      }
    }

    const avgAcceptanceMinutes = acceptanceTimes.length > 0
      ? Math.round(acceptanceTimes.reduce((a, b) => a + b, 0) / acceptanceTimes.length)
      : null;

    let slaSpeed: 'fast' | 'moderate' | 'slow' | 'none' = 'none';
    let slaLabel = 'No recent orders';
    if (avgAcceptanceMinutes !== null) {
      if (avgAcceptanceMinutes <= 15) {
        slaSpeed = 'fast';
        slaLabel = 'Lightning Fast (<15m)';
      } else if (avgAcceptanceMinutes <= 45) {
        slaSpeed = 'moderate';
        slaLabel = `Standard (~${avgAcceptanceMinutes}m)`;
      } else {
        slaSpeed = 'slow';
        slaLabel = 'Needs Attention (>45m)';
      }
    }

    const fulfillmentSla = {
      avgMinutes: avgAcceptanceMinutes,
      speed: slaSpeed,
      label: slaLabel,
      samplesCount: acceptanceTimes.length,
    };

    const revenueBreakdown = {
      realizedRevenue,
      deliveredOrdersCount,
      pendingRevenue,
      pendingOrdersCount,
      lostRevenue,
      lostOrdersCount,
      cancellationRate,
    };

    const totalUniqueBuyers = Number(customerRetentionSql[0]?.total_buyers ?? 0);
    const repeatBuyers = Number(customerRetentionSql[0]?.repeat_buyers ?? 0);
    const repeatBuyerRate = totalUniqueBuyers > 0
      ? Number(((repeatBuyers / totalUniqueBuyers) * 100).toFixed(1))
      : 0;

    const missedOosViews = parseInt(oosViewsVal || '0', 10);

    const previousRevenue = prevOrderMetrics._sum.total || 0;
    const previousOrdersCount = prevOrderMetrics._count.id || 0;
    const isNewRevenueGrowth = previousRevenue === 0 && realRevenue > 0;
    const revenueGrowth = previousRevenue > 0
      ? (((realRevenue - previousRevenue) / previousRevenue) * 100).toFixed(1)
      : realRevenue > 0
        ? '100.0'
        : '0.0';

    const periodDailySum = {
      impressions: productDailySumAgg._sum?.impressions ?? 0,
      detailViews: productDailySumAgg._sum?.detailViews ?? 0,
      cartAdds: productDailySumAgg._sum?.cartAdds ?? 0,
    };

    // Reconcile ad rollups ONLY with campaigns started within this window when period rollups are empty
    if (
      realTotalAdImpressions === 0 &&
      realTotalAdClicks === 0 &&
      realAdSpent === 0 &&
      Array.isArray(campaignsData?.campaigns)
    ) {
      const inWindowCampaigns = campaignsData.campaigns.filter(
        (c: any) => c.startDate && new Date(c.startDate) >= since
      );
      for (const c of inWindowCampaigns) {
        realTotalAdImpressions += Number(c.impressions || 0);
        realTotalAdClicks += Number(c.clicks || 0);
        realAdSpent += Number(c.spent || 0);
      }
    }

    // Unified period-scoped discovery reach, clicks, and CTR
    const rawShopViews = totals.views || 0;
    const periodOrganicImpressions = Math.max(
      rawShopViews + (totals.productImpressions || 0),
      periodDailySum.impressions,
      periodDailySum.detailViews
    );
    const periodOrganicClicks = Math.max(
      totals.productDetailViews || 0,
      periodDailySum.detailViews
    );
    const totalClicks = periodOrganicClicks + realTotalAdClicks;
    const totalImpressions = Math.max(periodOrganicImpressions + realTotalAdImpressions, totalClicks);

    // Top-of-Funnel Total Store & Catalog Reach (monotonic non-increasing stages)
    const periodCartAdds = Math.max(totals.cartAdds || 0, periodDailySum.cartAdds, realOrdersCount);
    const periodProductViews = Math.max(totalClicks, periodCartAdds);
    const topOfFunnelReach = Math.max(totalImpressions, periodProductViews);

    const funnel = [
      { label: 'Shop Views', value: topOfFunnelReach, color: 'from-blue-500 to-cyan-400' },
      { label: 'Product Views', value: periodProductViews, color: 'from-purple-500 to-pink-400' },
      { label: 'Add to Cart', value: periodCartAdds, color: 'from-orange-500 to-rose-400' },
      { label: 'Orders Placed', value: realOrdersCount, color: 'from-emerald-500 to-teal-400' },
    ];

    // Traffic sources — calculated from period organic vs promoted impressions
    const totalTrafficBase = periodOrganicImpressions + realTotalAdImpressions;
    let trafficSources: { source: string; pct: number; color: string }[] = [];
    if (totalTrafficBase > 0) {
      const promotedPct = Math.round((realTotalAdImpressions / totalTrafficBase) * 100);
      const organicPct = Math.max(0, 100 - promotedPct);
      trafficSources = [
        { source: 'Organic Views', pct: organicPct, color: 'from-blue-500 to-cyan-400' },
        { source: 'Promoted Ads', pct: promotedPct, color: 'from-amber-500 to-orange-400' },
      ].filter(s => s.pct > 0);
    }

    const conversionRate = topOfFunnelReach > 0
      ? Math.min(100, (realOrdersCount / topOfFunnelReach) * 100).toFixed(2)
      : '0.00';

    let topKeywordsResult = initialTopKeywords;
    const keywordsScope: 'period' | 'all_time' =
      initialTopKeywords.length > 0 ? 'period' : 'period';
    let resolvedKeywordsScope: 'period' | 'all_time' = keywordsScope;

    if (topKeywordsResult.length === 0) {
      const fallbackKeywords = await prisma.searchKeywordStat.groupBy({
        by: ['keyword'],
        where: { shopId },
        _sum: {
          searches: true,
          clicks: true,
        },
        orderBy: {
          _sum: { searches: 'desc' }
        },
        take: 25
      });
      topKeywordsResult = fallbackKeywords as any;
      if (topKeywordsResult.length > 0) {
        resolvedKeywordsScope = 'all_time';
      }
    }

    const keywords = topKeywordsResult.map(k => ({
      keyword: k.keyword,
      searches: k._sum.searches || 0,
      clicks: k._sum.clicks || 0,
      ctr: k._sum.searches ? (((k._sum.clicks || 0) / k._sum.searches) * 100).toFixed(2) : '0.00'
    }));

    // Unified Store CTR + separate Ad CTR
    const storeCtr = totalImpressions > 0 && totalClicks > 0
      ? Math.min(100, Math.max(0, (totalClicks / totalImpressions) * 100)).toFixed(2)
      : '0.00';

    const safeAdImpressions = Math.max(realTotalAdImpressions, realTotalAdClicks);
    const adCtr = safeAdImpressions > 0 && realTotalAdClicks > 0
      ? Math.min(100, Math.max(0, (realTotalAdClicks / safeAdImpressions) * 100)).toFixed(2)
      : '0.00';

    const promotedRoas = realAdSpent > 0 ? (promotedRevenue / realAdSpent).toFixed(2) : '0.00';
    const blendedRoas = realAdSpent > 0 ? (realRevenue / realAdSpent).toFixed(2) : '0.00';

    const winningKeywords = keywords.filter((k: any) => k.clicks > 0);
    const searchGaps = keywords.filter((k: any) => k.clicks === 0 && k.searches >= 2);

    const revenueSplit = {
      organicRevenue,
      organicOrders,
      promotedRevenue,
      promotedOrders,
      adSpend: realAdSpent,
      promotedRoas,
      blendedRoas,
    };

    const response = {
      totalImpressions,
      totalClicks,
      ctr: storeCtr,
      adCtr,
      adImpressions: realTotalAdImpressions,
      adClicks: realTotalAdClicks,
      roas: promotedRoas,
      totalRevenue: realRevenue,
      ordersCount: realOrdersCount,
      previousRevenue,
      previousOrdersCount,
      revenueGrowth,
      isNewRevenueGrowth,
      activeProductsCount,
      conversionRate,
      weeklyRevenue,
      weeklyLabels,
      weeklyViews,
      weeklyOrders,
      topProducts,
      funnel,
      trafficSources,
      campaigns: campaignsData.campaigns,
      keywords,
      keywordsScope: resolvedKeywordsScope,
      winningKeywords,
      searchGaps,
      showroomLeads: {
        calls: totals.calls,
        whatsappClicks: totals.whatsappClicks,
        directions: totals.directions,
        totalLeads: totals.calls + totals.whatsappClicks + totals.directions,
      },
      revenueBreakdown,
      revenueSplit,
      fulfillmentSla,
      customerRetention: {
        totalBuyers: totalUniqueBuyers,
        repeatBuyers,
        repeatBuyerRate,
      },
      abandonedCarts: {
        count: abandonedCartShoppers,
        itemsCount: abandonedCartItems,
        value: abandonedCartValue,
      },
      missedOosViews,
    };

    await cacheSet(cacheKey, response, 60);
    return response;
  }

  /**
   * Helper: calculate Haversine distance in kilometers between two GPS coordinates
   */
  private calculateHaversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Number((R * c).toFixed(1));
  }

  /**
   * Get all followers with real order statistics, distance calculations, and loyalty tiers
   */
  async getShopFollowers(shopId: string) {
    const [shop, followers] = await Promise.all([
      prisma.shop.findUnique({
        where: { id: shopId },
        select: { id: true, latitude: true, longitude: true, city: true, slug: true }
      }),
      prisma.savedShop.findMany({
        where: { shopId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              city: true,
              latitude: true,
              longitude: true,
              createdAt: true,
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      })
    ]);

    const userIds = followers.map(f => f.userId);
    const orderAggregates = await prisma.order.groupBy({
      by: ['userId'],
      where: {
        shopId,
        userId: { in: userIds },
        status: { notIn: ['CANCELLED', 'REFUNDED'] },
      },
      _count: { id: true },
      _sum: { total: true },
    });
    const orderMap = new Map(
      orderAggregates.map(o => [o.userId, { ordersCount: o._count.id, totalSpent: o._sum.total || 0 }])
    );

    return followers.map(f => {
      const stats = orderMap.get(f.userId) || { ordersCount: 0, totalSpent: 0 };
      const badge = stats.ordersCount >= 3 ? 'VIP Buyer' : stats.ordersCount >= 1 ? 'Regular Buyer' : 'Follower';

      let distanceKm: number | null = null;
      if (
        shop?.latitude != null &&
        shop?.longitude != null &&
        f.user.latitude != null &&
        f.user.longitude != null
      ) {
        distanceKm = this.calculateHaversineDistanceKm(
          shop.latitude,
          shop.longitude,
          f.user.latitude,
          f.user.longitude
        );
      }

      return {
        id: f.user.id,
        name: f.user.name,
        email: f.user.email,
        phone: f.user.phone,
        city: f.user.city || shop?.city || 'Local',
        followedAt: f.createdAt,
        ordersCount: stats.ordersCount,
        totalSpent: stats.totalSpent,
        badge,
        distanceKm,
      };
    });
  }

  /**
   * Broadcast a notification to shop followers with corridor/radius & product deep-linking support
   */
  async broadcastToFollowers(
    shopId: string,
    payload: {
      title: string;
      body: string;
      type: 'PROMOTION' | 'FLASH_SALE' | 'NEW_PRODUCT' | 'SYSTEM';
      city?: string;
      corridor?: string;
      productId?: string;
      imageUrl?: string;
    }
  ) {
    const [followers, shop] = await Promise.all([
      this.getShopFollowers(shopId),
      prisma.shop.findUnique({ where: { id: shopId } }),
    ]);

    // Apply corridor or city filtering
    let targetFollowers = followers;
    if (payload.corridor && payload.corridor !== 'all_city') {
      if (payload.corridor === 'immediate' || payload.corridor === 'walk_in') {
        const inRange = followers.filter(f => f.distanceKm !== null && f.distanceKm <= 2);
        targetFollowers = inRange.length > 0 ? inRange : followers;
      } else if (payload.corridor === 'commercial' || payload.corridor === '3_5_km') {
        const inRange = followers.filter(f => f.distanceKm !== null && f.distanceKm > 2 && f.distanceKm <= 5);
        targetFollowers = inRange.length > 0 ? inRange : followers;
      } else if (payload.corridor === 'suburban' || payload.corridor === '5_10_km') {
        const inRange = followers.filter(f => f.distanceKm !== null && f.distanceKm > 5 && f.distanceKm <= 10);
        targetFollowers = inRange.length > 0 ? inRange : followers;
      }
    } else if (payload.city && payload.city !== 'all_city' && payload.city !== 'All') {
      const cityFiltered = followers.filter(f =>
        f.city && f.city.toLowerCase() === payload.city?.toLowerCase()
      );
      if (cityFiltered.length > 0) {
        targetFollowers = cityFiltered;
      }
    }

    if (targetFollowers.length === 0) return { success: true, count: 0, pushSent: 0 };

    const relatedId = payload.productId || shopId;
    const actionUrl = payload.productId ? `/product/${payload.productId}` : `/shop/${shop?.slug || shopId}`;

    let sentCount = 0;
    const BROADCAST_CHUNK_SIZE = 25;
    for (let i = 0; i < targetFollowers.length; i += BROADCAST_CHUNK_SIZE) {
      const chunk = targetFollowers.slice(i, i + BROADCAST_CHUNK_SIZE);
      const results = await Promise.allSettled(
        chunk.map((follower) =>
          notificationService.createNotification(follower.id, {
            title: payload.title,
            body: payload.body,
            type: payload.type,
            icon: shop?.logo || undefined,
            image: payload.imageUrl || undefined,
            relatedId,
            actionUrl,
          })
        )
      );
      sentCount += results.filter((r) => r.status === 'fulfilled').length;
    }

    return { success: true, count: targetFollowers.length, pushSent: sentCount };
  }

  /**
   * Identify all shoppers (registered and anonymous sessions) who currently have
   * this shop's products in their cart, along with active recovery/targeted vouchers.
   */
  async getShopCartAdders(shopId: string, ownerId: string) {
    const shop = await prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) throw new AppError('Shop not found.', 404);
    if (shop.ownerId !== ownerId) throw new AppError('Not authorized.', 403);

    const cartItems = await prisma.cartItem.findMany({
      where: {
        OR: [{ shopId }, { product: { shopId } }],
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            price: true,
            mrp: true,
            bookingAmount: true,
            holdDurationMinutes: true,
            images: true,
            category: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const uniqueUserIds = Array.from(new Set(cartItems.map((c) => c.userId).filter(Boolean)));
    const realUserIds = uniqueUserIds.filter((id) => !id.startsWith('anon_'));

    const [users, activeVouchers] = await Promise.all([
      realUserIds.length > 0
        ? prisma.user.findMany({
            where: { id: { in: realUserIds } },
            select: { id: true, name: true, phone: true, city: true, avatar: true },
          })
        : Promise.resolve([]),
      prisma.cartVoucher.findMany({
        where: {
          shopId,
          isUsed: false,
          expiresAt: { gte: new Date() },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const userMap = new Map(users.map((u) => [u.id, u]));
    const voucherByUserAndProd = new Map<string, typeof activeVouchers[0]>();
    const voucherByUserShop = new Map<string, typeof activeVouchers[0]>();

    for (const v of activeVouchers) {
      if (v.productId) {
        const key = `${v.userId}::${v.productId}`;
        if (!voucherByUserAndProd.has(key)) voucherByUserAndProd.set(key, v);
      } else if (!voucherByUserShop.has(v.userId)) {
        voucherByUserShop.set(v.userId, v);
      }
    }

    const maskPhone = (phone?: string | null) => {
      if (!phone || phone.length < 4) return null;
      return `${phone.slice(0, 2)}••••••${phone.slice(-2)}`;
    };

    const items = cartItems.map((ci) => {
      const isAnonymous = ci.userId.startsWith('anon_');
      const user = !isAnonymous ? userMap.get(ci.userId) : null;
      const anonSuffix = ci.userId.replace(/^anon_(dev_)?/, '').slice(0, 6).toUpperCase() || 'GUEST';
      const shopperName = isAnonymous
        ? `Anonymous Shopper #${anonSuffix}`
        : user?.name || 'Verified Buyer';
      const matchedVoucher =
        voucherByUserAndProd.get(`${ci.userId}::${ci.productId}`) ||
        voucherByUserShop.get(ci.userId) ||
        null;

      const unitPrice = Number(ci.product?.price || 0);
      return {
        id: ci.id,
        userId: ci.userId,
        isAnonymous,
        shopperName,
        phoneMasked: maskPhone(user?.phone),
        city: isAnonymous ? 'Guest Session' : user?.city || shop.city || 'Local Buyer',
        avatar: user?.avatar || null,
        productId: ci.productId,
        productName: ci.product?.name || 'Product',
        productCategory: ci.product?.category || null,
        productImage: ci.product?.images?.[0] || null,
        productPrice: unitPrice,
        productMrp: ci.product?.mrp || null,
        bookingAmount: Number(ci.product?.bookingAmount || 0),
        holdDurationMinutes: Number(ci.product?.holdDurationMinutes || 180),
        quantity: ci.quantity,
        lineTotal: +(unitPrice * ci.quantity).toFixed(2),
        addedAt: ci.createdAt,
        recoveryNotifiedAt: ci.recoveryNotifiedAt,
        recoveryVoucherCode: matchedVoucher?.code || ci.recoveryVoucherCode || null,
        activeVoucher: matchedVoucher
          ? {
              id: matchedVoucher.id,
              code: matchedVoucher.code,
              discountPercent: matchedVoucher.discountPercent,
              expiresAt: matchedVoucher.expiresAt,
              productId: matchedVoucher.productId,
            }
          : null,
      };
    });

    const totalCartValue = items.reduce((sum, i) => sum + i.lineTotal, 0);
    const totalItemsInCarts = items.reduce((sum, i) => sum + i.quantity, 0);

    return {
      summary: {
        totalCartShoppers: uniqueUserIds.length,
        registeredShoppersCount: realUserIds.length,
        anonymousShoppersCount: uniqueUserIds.length - realUserIds.length,
        totalItemsInCarts,
        totalCartValue: +totalCartValue.toFixed(2),
        vouchersActiveCount: activeVouchers.length,
      },
      items,
    };
  }

  /**
   * Manually dispatch exclusive discount voucher(s) strictly to shoppers
   * who currently have the product(s) in their cart.
   */
  async sendCartDiscountToAdders(
    shopId: string,
    ownerId: string,
    payload: {
      userId?: string;
      productId?: string;
      cartItemId?: string;
      discountPercent: number;
      maxDiscount?: number;
      validHours?: number;
    }
  ) {
    const shop = await prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) throw new AppError('Shop not found.', 404);
    if (shop.ownerId !== ownerId) throw new AppError('Not authorized.', 403);

    const discountPercent = Math.min(50, Math.max(1, Math.round(Number(payload.discountPercent) || 10)));
    const validHours = Math.min(168, Math.max(1, Math.round(Number(payload.validHours) || 24)));
    const maxDiscount = payload.maxDiscount && Number(payload.maxDiscount) > 0
      ? Number(payload.maxDiscount)
      : 500;

    const matchingItems = await prisma.cartItem.findMany({
      where: {
        AND: [
          { OR: [{ shopId }, { product: { shopId } }] },
          ...(payload.cartItemId ? [{ id: payload.cartItemId }] : []),
          ...(payload.userId ? [{ userId: payload.userId }] : []),
          ...(payload.productId ? [{ productId: payload.productId }] : []),
        ],
      },
      include: {
        product: { select: { id: true, name: true, price: true } },
      },
    });

    if (matchingItems.length === 0) {
      throw new AppError('No active cart shoppers found matching this selection.', 400);
    }

    const itemsByUser = new Map<string, typeof matchingItems>();
    for (const item of matchingItems) {
      if (!item.userId) continue;
      if (!itemsByUser.has(item.userId)) itemsByUser.set(item.userId, []);
      itemsByUser.get(item.userId)!.push(item);
    }

    const expiresAt = new Date(Date.now() + validHours * 60 * 60 * 1000);
    const createdVouchers: any[] = [];
    let notificationsSent = 0;

    for (const [targetUserId, userItems] of itemsByUser.entries()) {
      const targetProductId =
        payload.productId ||
        (payload.cartItemId || userItems.length === 1 ? userItems[0].productId : null);

      const existing = await prisma.cartVoucher.findFirst({
        where: {
          userId: targetUserId,
          shopId,
          isUsed: false,
          expiresAt: { gte: new Date() },
        },
        orderBy: { createdAt: 'desc' },
      });

      let voucher;
      if (existing) {
        voucher = await prisma.cartVoucher.update({
          where: { id: existing.id },
          data: {
            discountPercent,
            maxDiscount,
            expiresAt,
            productId: targetProductId,
          },
        });
      } else {
        const code = `SAVE${discountPercent}-${nanoid(5).toUpperCase()}`;
        voucher = await prisma.cartVoucher.create({
          data: {
            userId: targetUserId,
            shopId,
            productId: targetProductId,
            code,
            discountPercent,
            maxDiscount,
            expiresAt,
            isUsed: false,
          },
        });
      }

      createdVouchers.push({
        id: voucher.id,
        userId: targetUserId,
        code: voucher.code,
        discountPercent: voucher.discountPercent,
        productId: voucher.productId,
        expiresAt: voucher.expiresAt,
      });

      await prisma.cartItem.updateMany({
        where: { id: { in: userItems.map((i) => i.id) } },
        data: {
          recoveryNotifiedAt: new Date(),
          recoveryVoucherCode: voucher.code,
          shopId,
        },
      });

      if (!targetUserId.startsWith('anon_')) {
        const itemLabel = userItems.map((i) => i.product?.name).filter(Boolean).slice(0, 2).join(', ') || 'cart item';
        await notificationService
          .createNotification(targetUserId, {
            title: `🎁 Exclusive ${discountPercent}% OFF on your cart item!`,
            body: `${shop.name} sent you a ${discountPercent}% discount on "${itemLabel}" in your cart. Apply code ${voucher.code} within ${validHours}h.`,
            type: 'PROMOTION',
            icon: shop.logo || undefined,
            relatedId: voucher.id,
            actionUrl: `/cart?voucher=${voucher.code}`,
          })
          .then(() => {
            notificationsSent++;
          })
          .catch(() => {});
      }
    }

    return {
      success: true,
      vouchersIssued: createdVouchers.length,
      targetShoppersCount: itemsByUser.size,
      notificationsSent,
      vouchers: createdVouchers,
    };
  }

  /**
   * Real schedule engine: slots, capacity, notice, hours (SEL-2)
   */
  async getShopPickupSlots(shopId: string, dateStr: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      throw new AppError('Invalid date format. Expected YYYY-MM-DD.', 400);
    }

    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      include: {
        settings: true,
        closures: { where: { date: dateStr } },
      },
    });

    if (!shop) throw new AppError('Shop not found.', 404);

    const timeZone = 'Asia/Kolkata';
    const now = new Date();
    const todayStr = now.toLocaleDateString('en-CA', { timeZone });

    // Check if shop is explicitly closed
    if (!shop.isOpen) {
      return {
        shopId,
        date: dateStr,
        isOpen: false,
        reason: 'Shop is currently marked closed',
        allowWalkIns: false,
        slots: [],
      };
    }

    // Check holiday / closure table
    if (shop.closures && shop.closures.length > 0) {
      return {
        shopId,
        date: dateStr,
        isOpen: false,
        reason: shop.closures[0].reason || 'Shop closed on this date',
        allowWalkIns: false,
        slots: [],
      };
    }

    const settings = shop.settings || {
      openingTime: '09:00',
      closingTime: '21:00',
      slotDurationMin: 30,
      maxPerSlot: 2,
      advanceNoticeMin: 15,
      allowWalkIns: true,
      workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    };

    // Check working days
    const targetDate = new Date(`${dateStr}T12:00:00+05:30`);
    const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const targetDayName = dayNames[targetDate.getDay()];
    const workingDaysStr = Array.isArray(settings.workingDays)
      ? settings.workingDays.join(',').toLowerCase()
      : String(settings.workingDays || '').toLowerCase();

    const isWorkingDay =
      !workingDaysStr ||
      workingDaysStr.includes('mon - sun') ||
      workingDaysStr.includes('daily') ||
      workingDaysStr.includes('24/7') ||
      workingDaysStr.includes(targetDayName) ||
      (workingDaysStr.includes('mon - sat') && targetDayName !== 'sun') ||
      (workingDaysStr.includes('mon - fri') && !['sat', 'sun'].includes(targetDayName));

    if (!isWorkingDay) {
      return {
        shopId,
        date: dateStr,
        isOpen: false,
        reason: `Shop is closed on ${targetDayName.toUpperCase()}`,
        allowWalkIns: false,
        slots: [],
      };
    }

    const parseTimeToMins = (t?: string | null, def = 540) => {
      if (!t || !t.includes(':')) return def;
      const [h, m] = t.split(':').map(Number);
      return (h || 0) * 60 + (m || 0);
    };

    const openMins = parseTimeToMins(settings.openingTime, 9 * 60);
    const closeMins = parseTimeToMins(settings.closingTime, 21 * 60);
    const slotDuration = Math.max(15, Math.min(180, Number(settings.slotDurationMin) || 30));
    const maxPerSlot = Math.max(1, Number(settings.maxPerSlot) || 2);
    const advanceNoticeMin = Math.max(0, Number(settings.advanceNoticeMin) || 15);
    const allowWalkIns = settings.allowWalkIns !== false;

    // Generate slots
    const rawSlots: Array<{ slotStart: Date; slotEnd: Date; formatted: string }> = [];
    for (let m = openMins; m + slotDuration <= closeMins; m += slotDuration) {
      const startH = Math.floor(m / 60);
      const startM = m % 60;
      const endMins = m + slotDuration;
      const endH = Math.floor(endMins / 60);
      const endM = endMins % 60;

      const pad = (n: number) => n.toString().padStart(2, '0');
      const startIso = `${dateStr}T${pad(startH)}:${pad(startM)}:00+05:30`;
      const endIso = `${dateStr}T${pad(endH)}:${pad(endM)}:00+05:30`;

      const formatTime = (h: number, min: number) => {
        const period = h >= 12 ? 'PM' : 'AM';
        const displayH = h % 12 || 12;
        return `${displayH}:${pad(min)} ${period}`;
      };

      rawSlots.push({
        slotStart: new Date(startIso),
        slotEnd: new Date(endIso),
        formatted: `${formatTime(startH, startM)} - ${formatTime(endH, endM)}`,
      });
    }

    // Filter out past / past-notice slots if target date is today
    const nowMs = now.getTime();
    const noticeThresholdMs = nowMs + advanceNoticeMin * 60 * 1000;

    const filteredSlots = rawSlots.filter((slot) => {
      if (dateStr < todayStr) return false;
      if (dateStr === todayStr) {
        return slot.slotStart.getTime() >= noticeThresholdMs;
      }
      return true;
    });

    if (filteredSlots.length === 0) {
      return {
        shopId,
        date: dateStr,
        isOpen: true,
        reason: dateStr === todayStr ? 'No remaining slots available today' : undefined,
        allowWalkIns,
        slotDurationMin: slotDuration,
        maxPerSlot,
        advanceNoticeMin,
        slots: [],
      };
    }

    // Query booked counts from shop_slot_counters
    const slotStarts = filteredSlots.map((s) => s.slotStart);
    const counters = await prisma.shopSlotCounter.findMany({
      where: {
        shopId,
        slotStart: { in: slotStarts },
      },
    });
    const counterMap = new Map(counters.map((c) => [c.slotStart.toISOString(), c.booked]));

    // Query active orders as ground truth
    const orderCounts = await prisma.order.groupBy({
      by: ['pickupSlotStart'],
      where: {
        shopId,
        pickupSlotStart: { in: slotStarts },
        status: { in: ['PLACED', 'CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP'] },
      },
      _count: { id: true },
    });
    const orderMap = new Map(
      orderCounts
        .filter((o) => o.pickupSlotStart)
        .map((o) => [o.pickupSlotStart!.toISOString(), o._count.id])
    );

    const slots = filteredSlots.map((s) => {
      const key = s.slotStart.toISOString();
      const bookedFromCounter = counterMap.get(key) || 0;
      const bookedFromOrders = orderMap.get(key) || 0;
      const bookedCount = Math.max(bookedFromCounter, bookedFromOrders);
      const availableCount = Math.max(0, maxPerSlot - bookedCount);
      const isAvailable = availableCount > 0;

      return {
        slotStart: s.slotStart.toISOString(),
        slotEnd: s.slotEnd.toISOString(),
        formatted: s.formatted,
        capacity: maxPerSlot,
        bookedCount,
        availableCount,
        isAvailable,
      };
    });

    return {
      shopId,
      date: dateStr,
      isOpen: true,
      allowWalkIns,
      slotDurationMin: slotDuration,
      maxPerSlot,
      advanceNoticeMin,
      slots,
    };
  }

  async getShopClosures(shopId: string, ownerId: string) {
    const shop = await prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) throw new AppError('Shop not found.', 404);
    if (shop.ownerId !== ownerId) throw new AppError('Not authorized.', 403);

    return prisma.shopClosure.findMany({
      where: { shopId },
      orderBy: { date: 'asc' },
    });
  }

  async addShopClosure(shopId: string, ownerId: string, date: string, reason?: string) {
    const shop = await prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) throw new AppError('Shop not found.', 404);
    if (shop.ownerId !== ownerId) throw new AppError('Not authorized.', 403);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new AppError('Date must be in YYYY-MM-DD format.', 400);
    }

    const closure = await prisma.shopClosure.upsert({
      where: { shopId_date: { shopId, date } },
      update: { reason: reason || 'Scheduled closure' },
      create: { shopId, date, reason: reason || 'Scheduled closure' },
    });

    return closure;
  }

  async deleteShopClosure(shopId: string, ownerId: string, date: string) {
    const shop = await prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) throw new AppError('Shop not found.', 404);
    if (shop.ownerId !== ownerId) throw new AppError('Not authorized.', 403);

    await prisma.shopClosure.deleteMany({
      where: { shopId, date },
    });

    return { success: true, message: `Closure on ${date} removed.` };
  }
}

export default new ShopService();
