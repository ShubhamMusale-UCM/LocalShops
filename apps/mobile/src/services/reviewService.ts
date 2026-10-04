import api from './api';

export interface CreateReviewPayload {
  productId: string;
  shopId: string;
  orderId: string;
  rating: number;
  title: string;
  comment: string;
  photos?: string[];
  isAnonymous?: boolean;
}

export interface ReviewResponse {
  id: string;
  productId: string;
  shopId: string;
  orderId: string;
  rating: number;
  title: string;
  comment: string;
  photos: string[];
  isVerifiedPurchase: boolean;
  sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
  sentimentScore: number;
  sentimentKeywords: string[];
  user: { id: string; name: string; avatar?: string };
  createdAt: string;
  updatedAt: string;
}

export interface ShopReviewsResponse {
  reviews: ReviewResponse[];
  ratingDistribution: Array<{ rating: number; count: number }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

class ReviewService {
  /**
   * Create a review for a product or shop
   */
  async createReview(payload: CreateReviewPayload): Promise<ReviewResponse> {
    const { data } = await api.post('/reviews', payload);
    return data;
  }

  /**
   * Get reviews for a shop with filters and pagination
   */
  async getShopReviews(
    shopId: string,
    params?: {
      page?: number;
      limit?: number;
      sort?: 'newest' | 'oldest' | 'highest' | 'lowest' | 'helpful';
      rating?: number;
    }
  ): Promise<ShopReviewsResponse> {
    const { data } = await api.get(`/reviews/shop/${shopId}`, { params });
    return data;
  }

  /**
   * Get reviews for a product
   */
  async getProductReviews(productId: string): Promise<ReviewResponse[]> {
    const { data } = await api.get(`/reviews/product/${productId}`);
    return data;
  }

  /**
   * Mark a review as helpful
   */
  async markReviewHelpful(reviewId: string): Promise<{ success: boolean }> {
    const { data } = await api.post(`/reviews/${reviewId}/helpful`);
    return data;
  }

  /**
   * Update a review
   */
  async updateReview(
    reviewId: string,
    payload: Partial<CreateReviewPayload>
  ): Promise<ReviewResponse> {
    const { data } = await api.patch(`/reviews/${reviewId}`, payload);
    return data;
  }

  /**
   * Delete a review
   */
  async deleteReview(reviewId: string): Promise<{ success: boolean }> {
    const { data } = await api.delete(`/reviews/${reviewId}`);
    return data;
  }

  /**
   * Get review summary for a shop (AI-generated)
   */
  async getReviewSummary(shopId: string): Promise<{
    summary: string;
    positiveSentiment: number;
    neutralSentiment: number;
    negativeSentiment: number;
    topIssues: string[];
    topStrengths: string[];
  }> {
    const { data } = await api.get(`/reviews/shop/${shopId}/summary`);
    return data;
  }
}

export default new ReviewService();
