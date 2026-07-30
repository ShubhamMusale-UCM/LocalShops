import { Request, Response } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';
import reviewService from './review.service';
import { createReviewSchema, replyReviewSchema, reviewQuerySchema } from './review.validator';

export class ReviewController {
  async create(req: AuthRequest, res: Response): Promise<void> {
    try {
      const validated = createReviewSchema.parse(req.body);
      const review = await reviewService.createReview(req.user!.id, validated);
      res.status(201).json(review);
    } catch (error: any) {
      res.status(error.statusCode || 400).json({ error: error.message, details: error.errors });
    }
  }

  async getByShop(req: Request, res: Response): Promise<void> {
    try {
      const params = reviewQuerySchema.parse(req.query);
      const result = await reviewService.getShopReviews(req.params.shopId, params);
      res.json(result);
    } catch (error: any) {
      res.status(error.statusCode || 400).json({ error: error.message });
    }
  }

  async getByProduct(req: Request, res: Response): Promise<void> {
    try {
      const reviews = await reviewService.getProductReviews(req.params.productId);
      res.json(reviews);
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  }

  async markHelpful(req: AuthRequest, res: Response): Promise<void> {
    try {
      const result = await reviewService.markHelpful(req.params.id, req.user!.id);
      res.json(result);
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  }

  async reply(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { reply } = replyReviewSchema.parse(req.body);
      const review = await reviewService.replyToReview(req.params.id, req.user!.id, reply);
      res.json(review);
    } catch (error: any) {
      res.status(error.statusCode || 400).json({ error: error.message });
    }
  }
}

export default new ReviewController();
