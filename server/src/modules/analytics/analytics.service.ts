import prisma from '../../config/database';

const getStartDate = (dateRange: 'week' | 'month' | 'year') => {
  const startDate = new Date();
  if (dateRange === 'week') {
    startDate.setDate(startDate.getDate() - 7);
  } else if (dateRange === 'month') {
    startDate.setMonth(startDate.getMonth() - 1);
  } else {
    startDate.setFullYear(startDate.getFullYear() - 1);
  }
  return startDate;
};

export class AnalyticsService {
  async getSellerAnalytics(sellerId: string, dateRange: 'week' | 'month' | 'year' = 'month') {
    const startDate = getStartDate(dateRange);

    const [orders, products, reviews] = await Promise.all([
      prisma.order.findMany({
        where: {
          shop: { ownerId: sellerId },
          createdAt: { gte: startDate },
        },
        select: {
          id: true,
          total: true,
          status: true,
        },
      }),
      prisma.product.count({
        where: { shop: { ownerId: sellerId }, isActive: true },
      }),
      prisma.review.findMany({
        where: { shop: { ownerId: sellerId } },
        select: { rating: true },
      }),
    ]);

    const validOrders = orders.filter((o) => o.status !== 'CANCELLED');
    const totalRevenue = validOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);

    const averageRating =
      reviews.length > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        : 0;

    return {
      period: dateRange,
      stats: {
        totalOrders: orders.length,
        totalRevenue,
        productCount: products,
        averageRating: Number(averageRating.toFixed(1)),
        reviewCount: reviews.length,
      },
    };
  }

  async getDailySalesTrend(sellerId: string, days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const orders = await prisma.order.findMany({
      where: {
        shop: { ownerId: sellerId },
        createdAt: { gte: startDate },
        status: { not: 'CANCELLED' },
      },
      select: {
        createdAt: true,
        total: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const bucket: Record<string, { date: string; order_count: number; revenue: number }> = {};
    for (const order of orders) {
      const dateKey = order.createdAt.toISOString().slice(0, 10);
      if (!bucket[dateKey]) {
        bucket[dateKey] = { date: dateKey, order_count: 0, revenue: 0 };
      }
      bucket[dateKey].order_count += 1;
      bucket[dateKey].revenue += Number(order.total || 0);
    }

    return Object.values(bucket);
  }

  async getProductPerformance(sellerId: string, limit: number = 10) {
    const products = await prisma.product.findMany({
      where: { shop: { ownerId: sellerId }, isActive: true },
      select: {
        id: true,
        name: true,
        price: true,
        images: true,
        averageRating: true,
        _count: {
          select: {
            orderItems: true,
            reviews: true,
          },
        },
      },
      orderBy: { orderCount: 'desc' },
      take: limit,
    });

    return products.map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      image: p.images?.[0] || null,
      sales: p._count.orderItems,
      reviewCount: p._count.reviews,
      avgRating: Number((p.averageRating || 0).toFixed(1)),
    }));
  }

  async getCategoryAnalytics(sellerId: string) {
    const categoryStats = await prisma.product.groupBy({
      by: ['category'],
      where: { shop: { ownerId: sellerId }, isActive: true },
      _count: { id: true },
      _avg: { price: true },
    });

    const detailed = await Promise.all(
      categoryStats.map(async (cat) => {
        const [reviews, orderItems] = await Promise.all([
          prisma.review.findMany({
            where: {
              shop: { ownerId: sellerId },
              product: { category: cat.category },
            },
            select: { rating: true },
          }),
          prisma.orderItem.count({
            where: {
              product: {
                category: cat.category,
                shop: { ownerId: sellerId },
              },
            },
          }),
        ]);

        const avgRating =
          reviews.length > 0
            ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
            : 0;

        return {
          category: cat.category,
          productCount: cat._count.id,
          avgPrice: Number(cat._avg.price || 0),
          totalSales: orderItems,
          avgRating: Number(avgRating.toFixed(1)),
        };
      })
    );

    return detailed;
  }

  async getCustomerInsights(sellerId: string) {
    const orders = await prisma.order.findMany({
      where: { shop: { ownerId: sellerId } },
      select: {
        userId: true,
        total: true,
        status: true,
      },
    });

    const customerOrderMap = new Map<string, number>();
    let revenue = 0;
    let revenueOrders = 0;

    for (const order of orders) {
      customerOrderMap.set(order.userId, (customerOrderMap.get(order.userId) || 0) + 1);
      if (order.status !== 'CANCELLED') {
        revenue += Number(order.total || 0);
        revenueOrders += 1;
      }
    }

    const totalCustomers = customerOrderMap.size;
    const repeatCustomers = Array.from(customerOrderMap.values()).filter((count) => count > 1).length;

    return {
      totalCustomers,
      repeatCustomers,
      repeatRate: totalCustomers > 0 ? Number(((repeatCustomers / totalCustomers) * 100).toFixed(2)) : 0,
      avgOrderValue: revenueOrders > 0 ? Number((revenue / revenueOrders).toFixed(2)) : 0,
    };
  }

  async getReviewAnalytics(sellerId: string) {
    const reviews = await prisma.review.findMany({
      where: { shop: { ownerId: sellerId } },
      select: {
        sentiment: true,
        rating: true,
        helpfulCount: true,
      },
    });

    const totalReviews = reviews.length;
    const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);

    const byRating = {
      5: reviews.filter((r) => r.rating === 5).length,
      4: reviews.filter((r) => r.rating === 4).length,
      3: reviews.filter((r) => r.rating === 3).length,
      2: reviews.filter((r) => r.rating === 2).length,
      1: reviews.filter((r) => r.rating === 1).length,
    };

    const bySentiment = {
      positive: reviews.filter((r) => r.sentiment === 'POSITIVE').length,
      neutral: reviews.filter((r) => r.sentiment === 'NEUTRAL').length,
      negative: reviews.filter((r) => r.sentiment === 'NEGATIVE').length,
    };

    const helpfulReviews = reviews.filter((r) => (r.helpfulCount || 0) > 0).length;

    return {
      totalReviews,
      averageRating: totalReviews > 0 ? Number((totalRating / totalReviews).toFixed(1)) : 0,
      byRating,
      bySentiment,
      helpfulPercent: totalReviews > 0 ? Number(((helpfulReviews / totalReviews) * 100).toFixed(2)) : 0,
    };
  }

  async getAdAnalytics(sellerId: string) {
    const ads = await prisma.promotedListing.findMany({
      where: { shop: { ownerId: sellerId } },
      select: {
        id: true,
        spent: true,
        impressions: true,
        clicks: true,
        isActive: true,
      },
    });

    const totalSpent = ads.reduce((sum, ad) => sum + Number(ad.spent || 0), 0);
    const totalClicks = ads.reduce((sum, ad) => sum + ad.clicks, 0);
    const totalImpressions = ads.reduce((sum, ad) => sum + ad.impressions, 0);

    return {
      activeAds: ads.filter((ad) => ad.isActive).length,
      totalSpent,
      totalClicks,
      totalConversions: 0,
      avgCTR: totalImpressions > 0 ? Number(((totalClicks / totalImpressions) * 100).toFixed(2)) : 0,
      roi: 0,
    };
  }

  async generateSellerReport(sellerId: string, format: 'json' | 'csv' = 'json') {
    const analytics = await this.getSellerAnalytics(sellerId, 'month');
    const products = await this.getProductPerformance(sellerId);
    const customers = await this.getCustomerInsights(sellerId);
    const reviews = await this.getReviewAnalytics(sellerId);
    const ads = await this.getAdAnalytics(sellerId);

    const report = {
      generatedAt: new Date(),
      analytics,
      topProducts: products,
      customerInsights: customers,
      reviewAnalytics: reviews,
      adPerformance: ads,
    };

    if (format === 'csv') {
      return this.convertToCSV(report);
    }

    return report;
  }

  private convertToCSV(report: any): string {
    let csv = 'CityLocalShop Seller Report\n';
    csv += `Generated,${report.generatedAt.toISOString()}\n\n`;
    csv += 'Analytics Summary\n';
    csv += `Total Orders,${report.analytics.stats.totalOrders}\n`;
    csv += `Total Revenue,${report.analytics.stats.totalRevenue}\n`;
    csv += `Average Rating,${report.analytics.stats.averageRating}\n`;
    csv += `Active Ads,${report.adPerformance.activeAds}\n`;
    return csv;
  }
}

export default new AnalyticsService();
