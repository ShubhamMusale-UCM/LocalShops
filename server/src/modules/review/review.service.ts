import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler.middleware';
import { cacheDelete, cacheDeletePattern } from '../../config/redis';
import { SentimentType } from '@prisma/client';

export class ReviewService {
  /**
   * Create a review
   */
  async createReview(userId: string, data: {
    shopId: string; productId?: string; orderId?: string;
    rating: number; title?: string; comment: string; photos?: string[];
  }) {
    // Prevent duplicate reviews per user per shop/product
    const existing = await prisma.review.findFirst({
      where: {
        userId,
        shopId: data.shopId,
        ...(data.productId ? { productId: data.productId } : {}),
      },
    });
    if (existing) throw new AppError('You have already reviewed this item.', 409);

    // Check if user has ordered from this shop (verified purchase)
    const hasOrdered = await prisma.order.findFirst({
      where: { userId, shopId: data.shopId, status: 'DELIVERED' },
    });

    // Simple sentiment analysis based on keywords
    const sentiment = this.analyzeSentiment(data.comment);

    const review = await prisma.review.create({
      data: {
        userId,
        shopId: data.shopId,
        productId: data.productId || null,
        rating: data.rating,
        title: data.title || null,
        comment: data.comment,
        photos: data.photos || [],
        isVerifiedPurchase: !!hasOrdered,
        sentiment: sentiment.label as SentimentType,
        sentimentScore: sentiment.score,
        sentimentKeywords: sentiment.keywords,
      },
      include: {
        user: { select: { id: true, name: true, avatar: true } },
      },
    });

    // Update shop average rating
    await this.updateShopRating(data.shopId);
    if (data.productId) await this.updateProductRating(data.productId);

    await cacheDelete(`shop:${data.shopId}`);
    if (data.productId) await cacheDelete(`product:${data.productId}`);

    return review;
  }

  /**
   * Get reviews for a shop
   */
  async getShopReviews(shopId: string, params: {
    page?: number; limit?: number; sort?: string; rating?: number;
  }) {
    const { page = 1, limit = 20, sort = 'newest', rating } = params;

    const where: any = { shopId };
    if (rating) where.rating = rating;

    let orderBy: any;
    switch (sort) {
      case 'oldest': orderBy = { createdAt: 'asc' }; break;
      case 'highest': orderBy = { rating: 'desc' }; break;
      case 'lowest': orderBy = { rating: 'asc' }; break;
      case 'helpful': orderBy = { helpfulCount: 'desc' }; break;
      default: orderBy = { createdAt: 'desc' };
    }

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where,
        include: { user: { select: { id: true, name: true, avatar: true } } },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.review.count({ where }),
    ]);

    // Compute rating distribution
    const distribution = await prisma.review.groupBy({
      by: ['rating'],
      where: { shopId },
      _count: true,
    });

    const ratingDistribution = [5, 4, 3, 2, 1].map(r => ({
      rating: r,
      count: distribution.find(d => d.rating === r)?._count || 0,
    }));

    return {
      reviews,
      ratingDistribution,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Get reviews for a product
   */
  async getProductReviews(productId: string) {
    return prisma.review.findMany({
      where: { productId },
      include: { user: { select: { id: true, name: true, avatar: true } } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  /**
   * Mark a review as helpful
   */
  async markHelpful(reviewId: string, userId: string) {
    const review = await prisma.review.findUnique({ where: { id: reviewId } });
    if (!review) throw new AppError('Review not found.', 404);
    if (review.userId === userId) throw new AppError('Cannot mark your own review as helpful.', 400);

    await prisma.review.update({
      where: { id: reviewId },
      data: { helpfulCount: { increment: 1 } },
    });

    return { success: true };
  }

  /**
   * Seller reply to a review
   */
  async replyToReview(reviewId: string, ownerId: string, reply: string) {
    const review = await prisma.review.findUnique({
      where: { id: reviewId },
      include: { shop: { select: { ownerId: true } } },
    });

    if (!review) throw new AppError('Review not found.', 404);
    if (review.shop.ownerId !== ownerId) throw new AppError('Not authorized.', 403);

    return prisma.review.update({
      where: { id: reviewId },
      data: { sellerReply: reply, sellerRepliedAt: new Date() },
    });
  }

  /**
   * Update shop average rating after a new review
   */
  private async updateShopRating(shopId: string) {
    const result = await prisma.review.aggregate({
      where: { shopId },
      _avg: { rating: true },
      _count: true,
    });

    await prisma.shop.update({
      where: { id: shopId },
      data: {
        averageRating: result._avg.rating || 0,
        totalReviews: result._count,
      },
    });
  }

  /**
   * Update product average rating
   */
  private async updateProductRating(productId: string) {
    const result = await prisma.review.aggregate({
      where: { productId },
      _avg: { rating: true },
      _count: true,
    });

    await prisma.product.update({
      where: { id: productId },
      data: {
        averageRating: result._avg.rating || 0,
      },
    });
  }

  /**
   * Simple keyword-based sentiment analysis
   */
  private analyzeSentiment(text: string): { label: string; score: number; keywords: string[] } {
    const lower = text.toLowerCase();
    const positiveWords = ['excellent', 'amazing', 'great', 'love', 'best', 'perfect', 'awesome',
      'accha', 'zabardast', 'badhiya', 'superb', 'fantastic', 'recommended', 'fresh', 'quality'];
    const negativeWords = ['terrible', 'worst', 'bad', 'horrible', 'poor', 'waste', 'fraud',
      'kharab', 'bakwas', 'bekar', 'disappointing', 'fake', 'expired', 'rotten', 'damaged'];

    const posMatches = positiveWords.filter(w => lower.includes(w));
    const negMatches = negativeWords.filter(w => lower.includes(w));

    const score = (posMatches.length - negMatches.length) / Math.max(posMatches.length + negMatches.length, 1);

    if (score > 0.2) return { label: 'POSITIVE', score: Math.min(score, 1), keywords: posMatches };
    if (score < -0.2) return { label: 'NEGATIVE', score: Math.max(score, -1), keywords: negMatches };
    return { label: 'NEUTRAL', score: 0, keywords: [...posMatches, ...negMatches] };
  }
}

export default new ReviewService();
