import { z } from 'zod';

export const createReviewSchema = z.object({
  shopId: z.string().uuid(),
  productId: z.string().uuid().optional(),
  orderId: z.string().uuid().optional(),
  rating: z.number().int().min(1).max(5),
  title: z.string().min(2).max(100).optional(),
  comment: z.string().min(5).max(2000),
  photos: z.array(z.string()).max(5).optional(),
});

export const replyReviewSchema = z.object({
  reply: z.string().min(2).max(500),
});

export const reviewQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().positive()).optional(),
  limit: z.string().transform(Number).pipe(z.number().positive().max(50)).optional(),
  sort: z.enum(['newest', 'oldest', 'highest', 'lowest', 'helpful']).optional(),
  rating: z.string().transform(Number).pipe(z.number().int().min(1).max(5)).optional(),
});
