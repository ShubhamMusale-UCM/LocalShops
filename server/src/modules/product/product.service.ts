import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler.middleware';
import { cacheGet, cacheSet, cacheDelete, cacheDeletePattern } from '../../config/redis';
import { searchProducts, getComparableProducts } from './product.search';

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

    await cacheDeletePattern(`shop:${shopId}*`);
    return product;
  }

  /**
   * Get product by ID with shop info
   */
  async getProductById(productId: string) {
    const cacheKey = `product:${productId}`;
    const cached = await cacheGet(cacheKey);
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

    // Increment view count (fire and forget)
    prisma.product.update({
      where: { id: productId },
      data: { viewCount: { increment: 1 } },
    }).catch(() => {});

    await cacheSet(cacheKey, product, 300); // 5 min cache
    return product;
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

    await cacheDelete(`product:${productId}`);
    await cacheDeletePattern(`shop:${product.shopId}*`);
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

    await cacheDelete(`product:${productId}`);
    await cacheDeletePattern(`shop:${product.shop.id}*`);
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
    if (category) where.category = category;

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
}

export default new ProductService();
