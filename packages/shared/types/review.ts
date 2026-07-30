export enum SentimentType {
  POSITIVE = 'POSITIVE',
  NEUTRAL = 'NEUTRAL',
  NEGATIVE = 'NEGATIVE',
}

export interface Review {
  id: string;
  userId: string;
  shopId: string;
  productId?: string | null;

  rating: number; // 1-5
  title?: string | null;
  comment: string;
  photos: string[];

  // Sentiment Analysis
  sentiment?: SentimentType | null;
  sentimentScore?: number | null; // -1 to 1
  sentimentKeywords: string[];

  // Engagement
  helpfulCount: number;
  reportCount: number;

  isVerifiedPurchase: boolean;

  sellerReply?: string | null;
  sellerRepliedAt?: Date | null;

  createdAt: Date;
  updatedAt: Date;

  // Joined
  userName?: string;
  userAvatar?: string;
}

export interface ReviewCreateInput {
  shopId: string;
  productId?: string;
  rating: number;
  title?: string;
  comment: string;
  photos?: string[];
}

export interface SentimentResult {
  type: SentimentType;
  score: number;
  keywords: string[];
  summary: string;
}

export interface SentimentAggregation {
  total: number;
  positive: { count: number; percentage: number };
  negative: { count: number; percentage: number };
  neutral: { count: number; percentage: number };
  overallScore: number;
  verdict: string;
}
