import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler.middleware';
import redis, { cacheGet, cacheSet, cacheDelete, cacheDeletePattern } from '../../config/redis';
import { searchProducts, getComparableProducts, getPersonalizedCandidates } from './product.search';
import adsService from '../ads/ads.service';
import { persistImagesArray } from '../../utils/imageProcessor';
import { getPlanLimits } from '../../config/plans';
import { recordAuditLog } from '../../utils/auditLogger';
import shopService, { PUBLIC_SHOP_SETTINGS_KEYS } from '../shop/shop.service';
import { validateAndParseRow, NormalizedProductRow, RowValidationError } from './csvAliasMap';

async function compressImagesArray(images?: string[]): Promise<string[]> {
  return persistImagesArray(images, 'products');
}

export class ProductService {
  /**
   * Create a new product
   */
  async createProduct(shopId: string, ownerId: string, data: any) {
    // Verify shop ownership
    const shop = await prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) throw new AppError('Shop not found.', 404);
    if (shop.ownerId !== ownerId) throw new AppError('Not authorized.', 403);

    // Check product limit based on centralized subscription plan config
    const productCount = await prisma.product.count({ where: { shopId, isActive: true } });
    const planLimits = getPlanLimits(shop.subscriptionPlan);
    if (productCount >= planLimits.maxProducts) {
      throw new AppError(`Product limit (${planLimits.maxProducts}) reached for ${shop.subscriptionPlan} plan. Upgrade to add more products.`, 400);
    }

    // Auto-calculate discount if MRP provided
    if (data.mrp && data.price && !data.discount) {
      data.discount = Math.round(((data.mrp - data.price) / data.mrp) * 100);
    }

    // Sanitize bookingAmount
    if (data.bookingAmount !== undefined) {
      const bAmount = parseFloat(String(data.bookingAmount));
      data.bookingAmount = !isNaN(bAmount) && bAmount >= 0 ? Math.min(bAmount, data.price) : 0;
    } else {
      data.bookingAmount = 0;
    }

    // Sanitize holdDurationMinutes
    if (data.holdDurationMinutes !== undefined) {
      const hMins = parseInt(String(data.holdDurationMinutes), 10);
      data.holdDurationMinutes = !isNaN(hMins) && hMins >= 15 ? Math.min(hMins, 10080) : 180;
    } else {
      data.holdDurationMinutes = 180;
    }

    // Sanitize lowStockThreshold
    if (data.lowStockThreshold !== undefined) {
      const lst = parseInt(String(data.lowStockThreshold), 10);
      data.lowStockThreshold = !isNaN(lst) && lst >= 0 ? lst : 5;
    } else {
      data.lowStockThreshold = 5;
    }

    // Sanitize pre-book fields
    data.allowPrebook = Boolean(data.allowPrebook);
    if (data.prebookEtaDays !== undefined && data.prebookEtaDays !== null) {
      const eta = parseInt(String(data.prebookEtaDays), 10);
      data.prebookEtaDays = !isNaN(eta) && eta >= 1 ? Math.min(eta, 90) : 3;
    } else {
      data.prebookEtaDays = 3;
    }
    if (typeof data.prebookNote === 'string') {
      data.prebookNote = data.prebookNote.trim().slice(0, 200) || null;
    } else if (data.prebookNote !== undefined) {
      data.prebookNote = null;
    }

    if (typeof data.quantity === 'number') {
      data.inStock = data.quantity > 0;
    }

    const compressedImages = await compressImagesArray(data.images || []);

    const product = await prisma.product.create({
      data: {
        ...data,
        shopId,
        tags: data.tags || [],
        images: compressedImages,
        searchVector: [data.name, data.description, data.brand, ...(data.tags || [])].filter(Boolean).join(' '),
      },
    });

    await this.invalidateProductAndShopCaches(shopId);
    return product;
  }

  private async invalidateProductAndShopCaches(shopId: string, productId?: string) {
    const promises: Promise<void>[] = [
      cacheDeletePattern(`shop:${shopId}*`),
      cacheDeletePattern(`*${shopId}*`),
      cacheDeletePattern('*products*'),
      cacheDeletePattern('shops:nearby:*'),
    ];
    if (productId) {
      promises.push(cacheDelete(`product:${productId}`));
    }
    await Promise.all(promises);
  }

  /**
   * Get product by ID with shop info
   */
  async getProductById(productId: string) {
    const cacheKey = `product:${productId}`;
    const cached: any = await cacheGet(cacheKey);
    if (cached) return cached;

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        shop: {
          select: {
            id: true, name: true, slug: true, phone: true, whatsapp: true,
            latitude: true, longitude: true, address: true, city: true,
            averageRating: true, isVerified: true, isOpen: true,
            operatingHours: true, deliveryEnabled: true, deliveryRadius: true,
            logo: true, coverImage: true,
          },
        },
        reviews: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: { user: { select: { id: true, name: true, avatar: true } } },
        },
        _count: { select: { reviews: true, orderItems: true } },
        promotedListings: {
          where: { isActive: true, startDate: { lte: new Date() }, endDate: { gte: new Date() } },
          select: { id: true },
        },
      },
    });

    if (!product || !product.isActive) throw new AppError('Product not found.', 404);

    if (product.shop) {
      const extSettings = await shopService.getExtendedShopSettings(product.shop.id);
      const publicExt: Record<string, any> = {};
      for (const k of PUBLIC_SHOP_SETTINGS_KEYS) {
        if (extSettings[k] !== undefined) publicExt[k] = extSettings[k];
      }
      (product as any).shop = { ...product.shop, ...publicExt, extendedSettings: publicExt };
    }

    await cacheSet(cacheKey, product, 300); // 5 min cache
    return product;
  }

  /**
   * Log product view asynchronously
   */
  async logProductView(productId: string, shopId?: string) {
    try {
      await redis.hincrby('telemetry:views:product', productId, 1);
      // NOTE: Storefront visits (telemetry:views:shop) must ONLY be recorded when the shop profile
      // is actually visited, never inflated merely by fetching a product detail.
    } catch (e) {
      console.error('Failed to buffer product view in redis:', e);
    }
  }

  /**
   * Search products
   */
  async search(params: any) {
    return searchProducts(params);
  }

  /**
   * Retrieve scalable personalized product candidates for a buyer
   */
  async getPersonalizedCandidates(params: any) {
    return getPersonalizedCandidates(params);
  }

  /**
   * Get comparable products for price comparison
   */
  async compareProducts(productId: string, latitude?: number, longitude?: number) {
    return getComparableProducts(productId, latitude, longitude);
  }

  /**
   * Update a product
   */
  async updateProduct(productId: string, ownerId: string, data: any) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { shop: { select: { ownerId: true } } },
    });

    if (!product) throw new AppError('Product not found.', 404);
    if (product.shop.ownerId !== ownerId) throw new AppError('Not authorized.', 403);

    // Recalculate discount
    if (data.mrp && data.price) {
      data.discount = Math.round(((data.mrp - data.price) / data.mrp) * 100);
    }

    // Sanitize bookingAmount
    if (data.bookingAmount !== undefined) {
      const bAmount = parseFloat(String(data.bookingAmount));
      const targetPrice = data.price ?? product.price;
      data.bookingAmount = !isNaN(bAmount) && bAmount >= 0 ? Math.min(bAmount, targetPrice) : 0;
    }

    // Sanitize holdDurationMinutes
    if (data.holdDurationMinutes !== undefined) {
      const hMins = parseInt(String(data.holdDurationMinutes), 10);
      data.holdDurationMinutes = !isNaN(hMins) && hMins >= 15 ? Math.min(hMins, 10080) : 180;
    }

    // Sanitize lowStockThreshold
    if (data.lowStockThreshold !== undefined) {
      const lst = parseInt(String(data.lowStockThreshold), 10);
      data.lowStockThreshold = !isNaN(lst) && lst >= 0 ? lst : 5;
    }

    // Sanitize pre-book fields
    if (data.allowPrebook !== undefined) {
      data.allowPrebook = Boolean(data.allowPrebook);
    }
    if (data.prebookEtaDays !== undefined) {
      if (data.prebookEtaDays === null) {
        data.prebookEtaDays = 3;
      } else {
        const eta = parseInt(String(data.prebookEtaDays), 10);
        data.prebookEtaDays = !isNaN(eta) && eta >= 1 ? Math.min(eta, 90) : 3;
      }
    }
    if (data.prebookNote !== undefined) {
      data.prebookNote = typeof data.prebookNote === 'string'
        ? (data.prebookNote.trim().slice(0, 200) || null)
        : null;
    }

    if (typeof data.quantity === 'number') {
      data.inStock = data.quantity > 0;
    }

    if (Array.isArray(data.images)) {
      data.images = await compressImagesArray(data.images);
    }

    // Update search vector
    if (data.name || data.description || data.brand || data.tags) {
      const current = { name: product.name, description: product.description, brand: product.brand, tags: product.tags };
      const merged = { ...current, ...data };
      data.searchVector = [merged.name, merged.description, merged.brand, ...(merged.tags || [])].filter(Boolean).join(' ');
    }

    const wasOutOfStock = !product.inStock || (typeof product.quantity === 'number' && product.quantity <= 0);
    const updated = await prisma.product.update({ where: { id: productId }, data });
    const isNowInStock = updated.inStock && (typeof updated.quantity !== 'number' || updated.quantity > 0);

    // Notify buyers who hold active pre-bookings when item is restocked
    if (wasOutOfStock && isNowInStock) {
      this.notifyPrebookRestock(productId, updated.name).catch(() => {});
    }

    await this.invalidateProductAndShopCaches(product.shopId, productId);
    return updated;
  }

  private async notifyPrebookRestock(productId: string, productName: string) {
    const prebookOrders = await prisma.order.findMany({
      where: {
        isPrebook: true,
        status: { in: ['PLACED', 'CONFIRMED', 'PREPARING'] },
        items: { some: { productId, isPrebook: true } },
      },
      select: { id: true, userId: true, orderNumber: true },
      take: 50,
    });
    if (prebookOrders.length === 0) return;
    await prisma.notification.createMany({
      data: prebookOrders.map((o) => ({
        userId: o.userId,
        title: 'Pre-Booked Item Back in Stock!',
        body: `"${productName}" is now in stock for order #${o.orderNumber}.`,
        type: 'ORDER_UPDATE',
        data: { orderId: o.id, productId, status: 'RESTOCKED' },
      })),
    }).catch(() => {});
  }

  /**
   * Delete (soft-delete) a product
   */
  async deleteProduct(productId: string, ownerId: string) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { shop: { select: { ownerId: true, id: true } } },
    });

    if (!product) throw new AppError('Product not found.', 404);
    if (product.shop.ownerId !== ownerId) throw new AppError('Not authorized.', 403);

    await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id: productId },
        data: { isActive: false },
      });

      await tx.promotedListing.updateMany({
        where: {
          productId,
          isActive: true,
        },
        data: {
          isActive: false,
          endDate: new Date(),
        },
      });
    });

    await this.invalidateProductAndShopCaches(product.shop.id, productId);
    await Promise.all([
      cacheDelete(`shop:${product.shop.id}:ads:list`),
      cacheDelete(`shop:${product.shop.id}:ads:analytics`),
    ]);
    return { success: true, message: 'Product deleted.' };
  }

  /**
   * Get products for a specific shop
   */
  async getShopProducts(shopId: string, params: {
    category?: string; sort?: string; page?: number; limit?: number; includeInactive?: boolean;
  }) {
    const { category, sort = 'newest', page = 1, limit = 20, includeInactive = false } = params;

    const where: any = { shopId };
    if (!includeInactive) {
      where.isActive = true;
    }
    if (category) where.category = { equals: category, mode: 'insensitive' };

    let orderBy: any;
    switch (sort) {
      case 'price_asc': orderBy = { price: 'asc' }; break;
      case 'price_desc': orderBy = { price: 'desc' }; break;
      case 'rating': orderBy = { averageRating: 'desc' }; break;
      case 'popularity': orderBy = { orderCount: 'desc' }; break;
      default: orderBy = { createdAt: 'desc' };
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where, orderBy,
        include: {
          shop: {
            select: {
              id: true, name: true, slug: true,
              latitude: true, longitude: true, address: true, city: true,
              averageRating: true, isVerified: true,
              isOpen: true, deliveryEnabled: true,
              logo: true, coverImage: true,
            },
          },
          promotedListings: {
            select: {
              id: true,
              isActive: true,
              startDate: true,
              endDate: true,
              budget: true,
              spent: true,
              impressions: true,
              clicks: true,
              conversions: true,
              revenue: true,
            },
          },
        },
        skip: (page - 1) * limit, take: limit,
      }),
      prisma.product.count({ where }),
    ]);

    const productIds = products.map((p) => p.id);
    let dailyAggMap = new Map<string, { impressions: number; detailViews: number; cartAdds: number; adImpressions: number; adClicks: number }>();
    if (productIds.length > 0) {
      try {
        const dailyAgg = await prisma.productDailyAnalytics.groupBy({
          by: ['productId'],
          where: { productId: { in: productIds } },
          _sum: {
            impressions: true,
            detailViews: true,
            cartAdds: true,
            adImpressions: true,
            adClicks: true,
          },
        });
        dailyAggMap = new Map(
          dailyAgg.map((d) => [
            d.productId,
            {
              impressions: d._sum.impressions || 0,
              detailViews: d._sum.detailViews || 0,
              cartAdds: d._sum.cartAdds || 0,
              adImpressions: d._sum.adImpressions || 0,
              adClicks: d._sum.adClicks || 0,
            },
          ])
        );
      } catch (err) {
        // Safe fallback if analytics table is temporarily busy
      }
    }

    const now = new Date();
    const enrichedProducts = products.map((p: any) => {
      const agg = dailyAggMap.get(p.id) || { impressions: 0, detailViews: 0, cartAdds: 0, adImpressions: 0, adClicks: 0 };
      const campaignAdImpressions = (p.promotedListings || []).reduce((a: number, l: any) => a + (l.impressions || 0), 0);
      const campaignAdClicks = (p.promotedListings || []).reduce((a: number, l: any) => a + (l.clicks || 0), 0);
      const adConversions = (p.promotedListings || []).reduce((a: number, l: any) => a + (l.conversions || 0), 0);
      const adRevenue = (p.promotedListings || []).reduce((a: number, l: any) => a + (l.revenue || 0), 0);
      const adImpressions = Math.max(campaignAdImpressions, agg.adImpressions || 0);
      const adClicks = Math.max(campaignAdClicks, agg.adClicks || 0);
      const totalImpressions = (agg.impressions || 0) + adImpressions;
      const totalViews = Math.max(p.viewCount || 0, agg.detailViews || 0);

      return {
        ...p,
        viewCount: totalViews,
        views: totalViews,
        impressions: totalImpressions,
        feedImpressions: agg.impressions || 0,
        cartAdds: agg.cartAdds || 0,
        adImpressions,
        adClicks,
        adConversions,
        adRevenue,
        isBoosted: !!(
          p.promotedListings &&
          p.promotedListings.some(
            (ad: any) =>
              ad.isActive &&
              new Date(ad.startDate) <= now &&
              new Date(ad.endDate) > now &&
              (ad.budget === undefined || ad.spent === undefined || ad.spent < ad.budget)
          )
        ),
      };
    });

    return {
      products: enrichedProducts,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Get trending products near user
   */
  async getTrendingNearby(latitude: number, longitude: number, radius: number = 50, limit: number = 15) {
    return searchProducts({
      latitude, longitude, radius, sort: 'newest', limit,
    });
  }

  /**
   * Preview bulk import without saving to database (SEL-7)
   */
  async previewBulkImport(shopId: string, ownerId: string, csvBuffer: Buffer) {
    const shop = await prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) throw new AppError('Shop not found.', 404);
    if (shop.ownerId !== ownerId) throw new AppError('Not authorized.', 403);

    const { parse } = await import('csv-parse/sync');
    let records: any[];
    try {
      records = parse(csvBuffer, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });
    } catch (err: any) {
      throw new AppError(`Failed to parse CSV: ${err.message}`, 400);
    }

    if (!records || records.length === 0) {
      throw new AppError('CSV file is empty or missing headers.', 400);
    }

    if (records.length > 5000) {
      throw new AppError('CSV file exceeds maximum limit of 5,000 rows. Please import in chunks.', 400);
    }

    const validRows: NormalizedProductRow[] = [];
    const errorRows: RowValidationError[] = [];
    const skusInFile = new Set<string>();

    for (let i = 0; i < records.length; i++) {
      const { parsed, error } = validateAndParseRow(records[i], i + 1, shop.category);
      if (error) {
        errorRows.push(error);
      } else if (parsed) {
        validRows.push(parsed);
        if (parsed.sku) skusInFile.add(parsed.sku);
      }
    }

    let existingSkuCount = 0;
    if (skusInFile.size > 0) {
      existingSkuCount = await prisma.product.count({
        where: {
          shopId,
          sku: { in: Array.from(skusInFile) },
        },
      });
    }

    return {
      totalRows: records.length,
      validCount: validRows.length,
      errorCount: errorRows.length,
      duplicateSkusToUpdate: existingSkuCount,
      newProductsToCreate: validRows.length - existingSkuCount,
      previewSample: validRows.slice(0, 10),
      errors: errorRows.slice(0, 50),
    };
  }

  /**
   * Start asynchronous chunked bulk import with progress tracking (SEL-7)
   */
  async createBulkImportJob(shopId: string, ownerId: string, csvBuffer: Buffer) {
    const shop = await prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) throw new AppError('Shop not found.', 404);
    if (shop.ownerId !== ownerId) throw new AppError('Not authorized.', 403);

    const { parse } = await import('csv-parse/sync');
    let records: any[];
    try {
      records = parse(csvBuffer, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });
    } catch (err: any) {
      throw new AppError(`Failed to parse CSV: ${err.message}`, 400);
    }

    if (!records || records.length === 0) {
      throw new AppError('CSV file is empty or missing headers.', 400);
    }

    if (records.length > 5000) {
      throw new AppError('CSV file exceeds maximum limit of 5,000 rows.', 400);
    }

    const validRows: NormalizedProductRow[] = [];
    const errorRows: RowValidationError[] = [];
    for (let i = 0; i < records.length; i++) {
      const { parsed, error } = validateAndParseRow(records[i], i + 1, shop.category);
      if (error) {
        errorRows.push(error);
      } else if (parsed) {
        validRows.push(parsed);
      }
    }

    const job = await prisma.importJob.create({
      data: {
        shopId,
        status: 'PROCESSING',
        totalRows: records.length,
        processedRows: 0,
        successRows: 0,
        errorRows: errorRows.length,
        errors: errorRows as any,
        startedAt: new Date(),
      },
    });

    // Run async chunked upserts without blocking request
    this.processImportJobAsync(job.id, shopId, validRows, errorRows).catch((err) => {
      console.error(`[ImportJob:${job.id}] Background processing failed:`, err);
    });

    return {
      jobId: job.id,
      status: job.status,
      totalRows: job.totalRows,
      initialErrorCount: errorRows.length,
    };
  }

  /**
   * Background processor for chunked upserts (SEL-7)
   */
  private async processImportJobAsync(
    jobId: string,
    shopId: string,
    validRows: NormalizedProductRow[],
    errorRows: RowValidationError[]
  ) {
    const CHUNK_SIZE = 500;
    let totalSuccess = 0;
    let totalProcessed = errorRows.length;

    for (let i = 0; i < validRows.length; i += CHUNK_SIZE) {
      const chunk = validRows.slice(i, i + CHUNK_SIZE);
      let chunkSuccess = 0;

      for (const row of chunk) {
        try {
          const searchVector = [row.name, row.description, row.brand, ...(row.tags || [])].filter(Boolean).join(' ');

          if (row.sku) {
            await prisma.product.upsert({
              where: {
                shopId_sku: {
                  shopId,
                  sku: row.sku,
                },
              },
              update: {
                name: row.name,
                description: row.description,
                price: row.price,
                mrp: row.mrp,
                discount: row.discount,
                bookingAmount: row.bookingAmount,
                quantity: row.quantity,
                inStock: row.inStock,
                allowPrebook: row.allowPrebook,
                prebookEtaDays: row.prebookEtaDays,
                prebookNote: row.prebookNote ?? null,
                category: row.category,
                subCategory: row.subCategory,
                brand: row.brand,
                unit: row.unit,
                tags: row.tags,
                searchVector,
                isActive: true,
                updatedAt: new Date(),
              },
              create: {
                shopId,
                sku: row.sku,
                name: row.name,
                description: row.description,
                price: row.price,
                mrp: row.mrp,
                discount: row.discount,
                bookingAmount: row.bookingAmount,
                quantity: row.quantity,
                inStock: row.inStock,
                allowPrebook: row.allowPrebook,
                prebookEtaDays: row.prebookEtaDays,
                prebookNote: row.prebookNote ?? null,
                category: row.category,
                subCategory: row.subCategory,
                brand: row.brand,
                unit: row.unit,
                tags: row.tags,
                images: row.images || [],
                searchVector,
                isActive: true,
              },
            });
          } else {
            await prisma.product.create({
              data: {
                shopId,
                name: row.name,
                description: row.description,
                price: row.price,
                mrp: row.mrp,
                discount: row.discount,
                bookingAmount: row.bookingAmount,
                quantity: row.quantity,
                inStock: row.inStock,
                allowPrebook: row.allowPrebook,
                prebookEtaDays: row.prebookEtaDays,
                prebookNote: row.prebookNote ?? null,
                category: row.category,
                subCategory: row.subCategory,
                brand: row.brand,
                unit: row.unit,
                tags: row.tags,
                images: row.images || [],
                searchVector,
                isActive: true,
              },
            });
          }
          chunkSuccess++;
        } catch (rowErr: any) {
          errorRows.push({
            row: totalProcessed + 1,
            sku: row.sku,
            name: row.name,
            message: rowErr?.message || 'Database write failed',
          });
        }
        totalProcessed++;
      }

      totalSuccess += chunkSuccess;

      await prisma.importJob.update({
        where: { id: jobId },
        data: {
          processedRows: totalProcessed,
          successRows: totalSuccess,
          errorRows: errorRows.length,
          errors: errorRows as any,
        },
      });
    }

    await prisma.importJob.update({
      where: { id: jobId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        processedRows: totalProcessed,
        successRows: totalSuccess,
        errorRows: errorRows.length,
        errors: errorRows as any,
      },
    });

    await this.invalidateProductAndShopCaches(shopId);
  }

  /**
   * Fetch import job status and progress
   */
  async getImportJob(jobId: string) {
    const job = await prisma.importJob.findUnique({
      where: { id: jobId },
    });
    if (!job) throw new AppError('Import job not found', 404);

    const progressPercent = job.totalRows > 0
      ? Math.round((job.processedRows / job.totalRows) * 100)
      : 0;

    return {
      ...job,
      progressPercent,
    };
  }

  /**
   * Export error report as downloadable CSV string
   */
  async getImportJobErrorReportCsv(jobId: string): Promise<string> {
    const job = await prisma.importJob.findUnique({
      where: { id: jobId },
    });
    if (!job) throw new AppError('Import job not found', 404);

    const errors = (job.errors as any[]) || [];
    const lines = ['Row,SKU,Item Name,Column,Error Message'];

    for (const err of errors) {
      const row = err.row || '';
      const sku = (err.sku || '').replace(/"/g, '""');
      const name = (err.name || '').replace(/"/g, '""');
      const col = (err.column || '').replace(/"/g, '""');
      const msg = (err.message || '').replace(/"/g, '""');
      lines.push(`${row},"${sku}","${name}","${col}","${msg}"`);
    }

    return lines.join('\n');
  }

  /**
   * Synchronous bulk import backwards-compatible helper (upgraded with SKU upsert & alias map)
   */
  async bulkImportProducts(shopId: string, ownerId: string, csvBuffer: Buffer) {
    const shop = await prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) throw new AppError('Shop not found.', 404);
    if (shop.ownerId !== ownerId) throw new AppError('Not authorized.', 403);

    const { parse } = await import('csv-parse/sync');
    let records: any[];
    try {
      records = parse(csvBuffer, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });
    } catch (err: any) {
      throw new AppError(`Failed to parse CSV: ${err.message}`, 400);
    }

    if (!records || records.length === 0) {
      throw new AppError('CSV file is empty or missing headers.', 400);
    }

    const planLimits = getPlanLimits(shop.subscriptionPlan);
    if (records.length > planLimits.maxCsvBatchRows) {
      throw new AppError(`CSV batch size (${records.length}) exceeds maximum ${planLimits.maxCsvBatchRows} rows for ${shop.subscriptionPlan} plan.`, 400);
    }

    const validRows: NormalizedProductRow[] = [];
    const errorRows: RowValidationError[] = [];
    for (let i = 0; i < records.length; i++) {
      const { parsed, error } = validateAndParseRow(records[i], i + 1, shop.category);
      if (error) {
        errorRows.push(error);
      } else if (parsed) {
        validRows.push(parsed);
      }
    }

    let successCount = 0;
    for (const row of validRows) {
      try {
        const searchVector = [row.name, row.description, row.brand, ...(row.tags || [])].filter(Boolean).join(' ');
        if (row.sku) {
          await prisma.product.upsert({
            where: { shopId_sku: { shopId, sku: row.sku } },
            update: {
              name: row.name,
              description: row.description,
              price: row.price,
              mrp: row.mrp,
              discount: row.discount,
              bookingAmount: row.bookingAmount,
              quantity: row.quantity,
              inStock: row.inStock,
              category: row.category,
              subCategory: row.subCategory,
              brand: row.brand,
              unit: row.unit,
              tags: row.tags,
              searchVector,
              isActive: true,
              updatedAt: new Date(),
            },
            create: {
              shopId,
              sku: row.sku,
              name: row.name,
              description: row.description,
              price: row.price,
              mrp: row.mrp,
              discount: row.discount,
              bookingAmount: row.bookingAmount,
              quantity: row.quantity,
              inStock: row.inStock,
              category: row.category,
              subCategory: row.subCategory,
              brand: row.brand,
              unit: row.unit,
              tags: row.tags,
              images: row.images || [],
              searchVector,
              isActive: true,
            },
          });
        } else {
          await prisma.product.create({
            data: {
              shopId,
              name: row.name,
              description: row.description,
              price: row.price,
              mrp: row.mrp,
              discount: row.discount,
              bookingAmount: row.bookingAmount,
              quantity: row.quantity,
              inStock: row.inStock,
              category: row.category,
              subCategory: row.subCategory,
              brand: row.brand,
              unit: row.unit,
              tags: row.tags,
              images: row.images || [],
              searchVector,
              isActive: true,
            },
          });
        }
        successCount++;
      } catch (err: any) {
        errorRows.push({ row: validRows.indexOf(row) + 1, message: err.message });
      }
    }

    await this.invalidateProductAndShopCaches(shopId);

    return {
      totalProcessed: records.length,
      successCount,
      errorCount: errorRows.length,
      errors: errorRows,
    };
  }

  /**
   * Log product click (view) and optionally keyword stat
   */
  async logProductClick(productId: string, keyword?: string) {
    try {
      const product = await prisma.product.update({
        where: { id: productId },
        data: { viewCount: { increment: 1 } },
      });

      // Also track click for promoted listings if active and within budget


      if (keyword && keyword.trim().length > 0) {
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        
        await prisma.searchKeywordStat.upsert({
          where: {
            shopId_keyword_date: {
              shopId: product.shopId,
              keyword: keyword.trim().toLowerCase(),
              date: today
            }
          },
          update: { clicks: { increment: 1 } },
          create: {
            shopId: product.shopId,
            keyword: keyword.trim().toLowerCase(),
            date: today,
            searches: 0,
            clicks: 1
          }
        }).catch(e => console.error('Error tracking keyword click:', e));
      }
    } catch (e) {
      console.error('Failed to log product click:', e);
    }
  }

  /**
   * Bulk update products
   */
    async bulkUpdateProducts(shopId: string, ownerId: string, updates: any[]) {
    const shop = await prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) throw new AppError('Shop not found.', 404);
    if (shop.ownerId !== ownerId) throw new AppError('Not authorized.', 403);

    await prisma.$transaction(async (tx) => {
      const updatePromises = updates.map(async (update) => {
        const data: any = {};
        if (update.price !== undefined) data.price = update.price;
        if (update.mrp !== undefined) data.mrp = update.mrp;
        if (update.bookingAmount !== undefined) {
          const bAmount = parseFloat(String(update.bookingAmount));
          data.bookingAmount = !isNaN(bAmount) && bAmount >= 0 ? bAmount : 0;
        }
        if (update.quantity !== undefined) {
          data.quantity = update.quantity;
          data.inStock = update.quantity > 0;
        } else if (update.inStock !== undefined) {
          data.inStock = update.inStock;
        }
        if (update.allowPrebook !== undefined) data.allowPrebook = Boolean(update.allowPrebook);
        if (update.prebookEtaDays !== undefined) {
          data.prebookEtaDays = update.prebookEtaDays === null ? 3 : Math.min(90, Math.max(1, parseInt(String(update.prebookEtaDays), 10) || 3));
        }
        if (update.prebookNote !== undefined) {
          data.prebookNote = typeof update.prebookNote === 'string' ? (update.prebookNote.trim().slice(0, 200) || null) : null;
        }

        // Recalculate discount
        if (data.mrp && data.price) {
          data.discount = Math.round(((data.mrp - data.price) / data.mrp) * 100);
        } else if (data.price && update.mrp === undefined) {
          // Need to fetch current MRP to recalculate discount if only price is updated
          const existing = await tx.product.findUnique({ where: { id: update.id }, select: { mrp: true } });
          if (existing?.mrp) {
            data.discount = Math.round(((existing.mrp - data.price) / existing.mrp) * 100);
          }
        }

        return tx.product.update({
          where: { id: update.id, shopId },
          data,
        });
      });

      await Promise.all(updatePromises);
    });
    
    // Clear caches
    await this.invalidateProductAndShopCaches(shopId);
    for (const update of updates) {
      await cacheDelete(`product:${update.id}`);
    }

    return { success: true, message: `Successfully updated ${updates.length} products.` };
  }
}

export default new ProductService();
