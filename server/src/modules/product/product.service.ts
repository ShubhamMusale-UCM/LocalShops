import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler.middleware';
import redis, { cacheGet, cacheSet, cacheDelete, cacheDeletePattern } from '../../config/redis';
import { searchProducts, getComparableProducts } from './product.search';
import adsService from '../ads/ads.service';

export class ProductService {
  /**
   * Create a new product
   */
  async createProduct(shopId: string, ownerId: string, data: any) {
    // Verify shop ownership
    const shop = await prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) throw new AppError('Shop not found.', 404);
    if (shop.ownerId !== ownerId) throw new AppError('Not authorized.', 403);

    // Check product limit based on subscription
    const productCount = await prisma.product.count({ where: { shopId, isActive: true } });
    const limits: Record<string, number> = {
      FREE: 10, STARTER: 50, PROFESSIONAL: 999999, PREMIUM: 999999,
    };
    if (productCount >= (limits[shop.subscriptionPlan] || 10)) {
      throw new AppError(`Product limit reached for ${shop.subscriptionPlan} plan. Upgrade to add more products.`, 400);
    }

    // Auto-calculate discount if MRP provided
    if (data.mrp && data.price && !data.discount) {
      data.discount = Math.round(((data.mrp - data.price) / data.mrp) * 100);
    }

    if (typeof data.quantity === 'number') {
      data.inStock = data.quantity > 0;
    }

    const product = await prisma.product.create({
      data: {
        ...data,
        shopId,
        tags: data.tags || [],
        images: data.images || [],
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

    // Fire and forget logging (outside cache block to capture all views)
    let shopId = cached?.shop?.id;

    if (!cached) {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        include: { shop: { select: { id: true } } }
      });
      if (product) shopId = product.shop.id;
    }

    if (shopId) {
      this.logProductView(productId, shopId).catch(() => {});
    }

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
      },
    });

    if (!product || !product.isActive) throw new AppError('Product not found.', 404);

    await cacheSet(cacheKey, product, 300); // 5 min cache
    return product;
  }

  /**
   * Log product view asynchronously
   */
  async logProductView(productId: string, shopId: string) {
    try {
      await redis.hincrby('telemetry:views:product', productId, 1);
      await redis.hincrby('telemetry:views:shop', shopId, 1);
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

    if (typeof data.quantity === 'number') {
      data.inStock = data.quantity > 0;
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
    category?: string; sort?: string; page?: number; limit?: number;
  }) {
    const { category, sort = 'newest', page = 1, limit = 20 } = params;

    const where: any = { shopId, isActive: true };
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
        },
        skip: (page - 1) * limit, take: limit,
      }),
      prisma.product.count({ where }),
    ]);

    return {
      products,
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

    // Optional limits check
    const productCount = await prisma.product.count({ where: { shopId, isActive: true } });
    const limits: Record<string, number> = {
      FREE: 10, STARTER: 50, PROFESSIONAL: 999999, PREMIUM: 999999,
    };
    const maxAllowed = limits[shop.subscriptionPlan] || 10;
    
    if (productCount + records.length > maxAllowed) {
      throw new AppError(`Bulk import exceeds product limit for ${shop.subscriptionPlan} plan. Available slots: ${Math.max(0, maxAllowed - productCount)}`, 400);
    }

    // Process rows
    for (let i = 0; i < records.length; i++) {
      const row = records[i] as any;
      try {
        if (!row.name || !row.price || !row.description) {
          throw new Error('Missing required fields: name, price, description');
        }

        const price = parseFloat(row.price);
        const mrp = row.mrp ? parseFloat(row.mrp) : undefined;
        let discount = 0;
        if (mrp && price && !row.discount) {
          discount = Math.round(((mrp - price) / mrp) * 100);
        } else if (row.discount) {
          discount = parseInt(row.discount, 10);
        }

        const tags = row.tags ? row.tags.split(',').map((t: string) => t.trim()) : [];
        const quantity = row.quantity ? parseInt(row.quantity, 10) : 0;
        const inStock = quantity > 0 || row.inStock === 'true' || row.inStock === '1';

        const searchVector = [row.name, row.description, row.brand, ...tags].filter(Boolean).join(' ');

        successRows.push({
          shopId,
          name: row.name,
          description: row.description,
          price,
          mrp,
          discount,
          category: row.category || 'Uncategorized',
          subCategory: row.subCategory || null,
          brand: row.brand || null,
          quantity,
          inStock,
          tags,
          searchVector,
          isActive: true,
          images: [] // Initially empty, users can upload later or via URLs
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
        include: { promotedListing: true }
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
