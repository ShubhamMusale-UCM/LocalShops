import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler.middleware';

export interface AdminListQuery {
  page?: number;
  limit?: number;
  role?: 'BUYER' | 'SELLER' | 'ADMIN';
  search?: string;
}

class AdminService {
  async getPlatformOverview() {
    const [users, shops, products, orders, reviews, activeShops, gmv] = await Promise.all([
      prisma.user.count(),
      prisma.shop.count(),
      prisma.product.count(),
      prisma.order.count(),
      prisma.review.count(),
      prisma.shop.count({ where: { isActive: true } }),
      prisma.order.aggregate({
        where: { status: { not: 'CANCELLED' } },
        _sum: { total: true },
      }),
    ]);

    return {
      users,
      shops,
      products,
      orders,
      reviews,
      activeShops,
      grossMerchandiseValue: gmv._sum.total || 0,
    };
  }

  async getAnalytics() {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [recentSignups, recentOrders, orderStatusDistribution] = await Promise.all([
      prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      prisma.order.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      prisma.order.groupBy({
        by: ['status'],
        _count: { status: true },
      }),
    ]);

    // Format order distribution
    const distribution = orderStatusDistribution.reduce((acc, curr) => {
      acc[curr.status] = curr._count.status;
      return acc;
    }, {} as Record<string, number>);

    return {
      recentSignups,
      recentOrders,
      orderStatusDistribution: distribution,
      timeframe: 'last_7_days'
    };
  }

  async getUsers(query: AdminListQuery) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.role) where.role = query.role;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          role: true,
          isVerified: true,
          createdAt: true,
          _count: {
            select: {
              shops: true,
              orders: true,
              reviews: true,
            },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async updateUserRole(userId: string, role: 'BUYER' | 'SELLER' | 'ADMIN') {
    return prisma.user.update({
      where: { id: userId },
      data: { role },
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
        updatedAt: true,
      },
    });
  }

  async setUserStatus(userId: string, isActive: boolean) {
    return prisma.user.update({
      where: { id: userId },
      data: { isActive },
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
        isActive: true,
        updatedAt: true,
      },
    });
  }

  async getShops(page = 1, limit = 20, search?: string, status?: string) {
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
      ];
    }
    
    if (status === 'pending') {
      where.isVerified = false;
    }

    const [items, total] = await Promise.all([
      prisma.shop.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          city: true,
          category: true,
          isVerified: true,
          isActive: true,
          trustScore: true,
          createdAt: true,
          owner: {
            select: {
              id: true,
              name: true,
              phone: true,
            },
          },
        },
      }),
      prisma.shop.count({ where }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async setShopStatus(shopId: string, isActive: boolean) {
    return prisma.shop.update({
      where: { id: shopId },
      data: { isActive },
      select: {
        id: true,
        name: true,
        isActive: true,
        updatedAt: true,
      },
    });
  }

  async setShopVerification(shopId: string, isVerified: boolean) {
    return prisma.shop.update({
      where: { id: shopId },
      data: {
        isVerified,
        verifiedAt: isVerified ? new Date() : null,
      },
      select: {
        id: true,
        name: true,
        isVerified: true,
        verifiedAt: true,
      },
    });
  }

  async getFlaggedReviews(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where = { reportCount: { gt: 0 } };

    const [items, total] = await Promise.all([
      prisma.review.findMany({
        where,
        skip,
        take: limit,
        orderBy: { reportCount: 'desc' },
        select: {
          id: true,
          title: true,
          comment: true,
          rating: true,
          reportCount: true,
          helpfulCount: true,
          createdAt: true,
          user: { select: { id: true, name: true } },
          shop: { select: { id: true, name: true } },
          product: { select: { id: true, name: true } },
        },
      }),
      prisma.review.count({ where }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async resolveReviewReport(reviewId: string, action: 'dismiss' | 'remove') {
    const review = await prisma.review.findUnique({ where: { id: reviewId } });
    if (!review) throw new AppError('Review not found.', 404);

    if (action === 'remove') {
      await prisma.review.delete({ where: { id: reviewId } });
      return { removed: true, reviewId };
    }

    await prisma.review.update({
      where: { id: reviewId },
      data: { reportCount: 0 },
    });

    return { removed: false, reviewId, dismissed: true };
  }
}

export default new AdminService();
