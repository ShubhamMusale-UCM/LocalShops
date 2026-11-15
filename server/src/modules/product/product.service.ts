import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler.middleware';
import redis, { cacheGet, cacheSet, cacheDelete, cacheDeletePattern } from '../../config/redis';
import { searchProducts, getComparableProducts } from './product.search';
import adsService from '../ads/ads.service';
import { persistImagesArray } from '../../utils/imageProcessor';
import { getPlanLimits } from '../../config/plans';
import { recordAuditLog } from '../../utils/auditLogger';

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

    const updated = await prisma.product.update({ where: { id: productId }, data });

    await this.invalidateProductAndShopCaches(product.shopId, productId);
    return updated;
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
    await cacheDelete(`shop:${product.shop.id}:ads`);
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
   * Bulk import products from CSV
   */
  async bulkImportProducts(shopId: string, ownerId: string, csvBuffer: Buffer) {
    const shop = await prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) throw new AppError('Shop not found.', 404);
    if (shop.ownerId !== ownerId) throw new AppError('Not authorized.', 403);

    // Dynamic import to support both commonjs and esm parsing if needed
    const { parse } = await import('csv-parse/sync');

    let records;
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

    const successRows: any[] = [];
    const errorRows: { row: number; error: string }[] = [];

    // Centralized limits check
    const productCount = await prisma.product.count({ where: { shopId, isActive: true } });
    const planLimits = getPlanLimits(shop.subscriptionPlan);
    const maxAllowed = planLimits.maxProducts;

    if (records.length > planLimits.maxCsvBatchRows) {
      throw new AppError(`CSV batch size (${records.length}) exceeds maximum ${planLimits.maxCsvBatchRows} rows for ${shop.subscriptionPlan} plan.`, 400);
    }

    if (productCount + records.length > maxAllowed) {
      throw new AppError(`Bulk import exceeds product limit for ${shop.subscriptionPlan} plan. Available slots: ${Math.max(0, maxAllowed - productCount)}`, 400);
    }

    // Process rows
    for (let i = 0; i < records.length; i++) {
      const row = records[i] as any;
      try {
        const itemName = (row.name || row.title || row.Name || row.Title || '').trim();
        const rawPrice = row.price || row.Price || row.selling_price;
        const itemDescription = (row.description || row.Description || `${itemName} — available in store for immediate pickup.`).trim();

        if (!itemName || !rawPrice) {
          throw new Error('Missing required fields: name, price');
        }

        const price = parseFloat(String(rawPrice).replace(/[^0-9.]/g, ''));
        if (isNaN(price) || price <= 0) {
          throw new Error('Invalid price value');
        }
        const rawMrp = row.mrp || row.MRP || row.originalPrice;
        const mrp = rawMrp ? parseFloat(String(rawMrp).replace(/[^0-9.]/g, '')) : undefined;
        let discount = 0;
        if (mrp && price && mrp > price && !row.discount) {
          discount = Math.round(((mrp - price) / mrp) * 100);
        } else if (row.discount) {
          discount = parseInt(row.discount, 10) || 0;
        }

        const rawBookingAmount = row.bookingAmount || row.booking_amount || row.tokenAmount || row.token_amount;
        const bAmount = rawBookingAmount ? parseFloat(String(rawBookingAmount).replace(/[^0-9.]/g, '')) : 0;
        const bookingAmount = !isNaN(bAmount) && bAmount >= 0 ? Math.min(bAmount, price) : 0;

        const rawTags = row.tags || row.Tags;
        const tags = rawTags ? String(rawTags).split(',').map((t: string) => t.trim()).filter(Boolean) : [];
        const rawQty = row.quantity ?? row.stock ?? row.Quantity ?? row.Stock;
        const quantity = rawQty !== undefined && rawQty !== '' ? parseInt(String(rawQty), 10) : 5;
        const inStock = quantity > 0 || row.inStock === 'true' || row.inStock === '1';
        const category = (row.category || row.Category || shop.category || 'General').trim();
        const subCategory = (row.subCategory || row.SubCategory || '').trim() || null;
        const brand = (row.brand || row.Brand || '').trim() || null;
        const unit = (row.unit || row.Unit || 'pcs').trim();

        const searchVector = [itemName, itemDescription, brand, ...tags].filter(Boolean).join(' ');
        const rawRowImages = row.images || row.image || row.Images || row.Image
          ? String(row.images || row.image || row.Images || row.Image).split(/[|,]/).map((s: string) => s.trim()).filter(Boolean)
          : [];
        const persistedRowImages = rawRowImages.length > 0 ? await compressImagesArray(rawRowImages) : [];

        successRows.push({
          shopId,
          name: itemName,
          description: itemDescription,
          price,
          mrp: mrp && !isNaN(mrp) ? mrp : undefined,
          discount,
          bookingAmount,
          category,
          subCategory,
          brand,
          quantity: isNaN(quantity) ? 5 : quantity,
          unit,
          inStock,
          tags,
          searchVector,
          isActive: true,
          images: persistedRowImages
        });
      } catch (err: any) {
        errorRows.push({ row: i + 1, error: err.message });
      }
    }

    if (successRows.length > 0) {
      await prisma.product.createMany({
        data: successRows,
        skipDuplicates: true // Optional: depending on needs
      });
      await this.invalidateProductAndShopCaches(shopId);
    }

    return {
      totalProcessed: records.length,
      successCount: successRows.length,
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
