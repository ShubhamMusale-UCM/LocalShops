import { Request, Response, NextFunction } from 'express';
import subscriptionService from './subscription.service';
import { AuthRequest } from '../../middleware/auth.middleware';
import { AppError } from '../../middleware/errorHandler.middleware';

export const SubscriptionController = {
  /**
   * Get all available plans
   */
  getPlans: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const plans = await subscriptionService.getPlans();
      res.json({
        status: 'success',
        data: plans,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get user's current subscription
   */
  getUserSubscription: async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const subscription = await subscriptionService.getUserSubscription(
        req.user!.id
      );
      res.json({
        status: 'success',
        data: subscription,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Create new subscription
   */
  createSubscription: async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { planId } = req.body;

      if (!planId) throw new AppError('Plan ID required', 400);

      const subscription = await subscriptionService.createSubscription(
        req.user!.id,
        planId
      );

      res.status(201).json({
        status: 'success',
        data: subscription,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Upgrade/downgrade subscription
   */
  upgradeSubscription: async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { subscriptionId, newPlanId } = req.body;

      if (!subscriptionId || !newPlanId)
        throw new AppError('Subscription and plan ID required', 400);

      // Cancel old subscription
      await subscriptionService.cancelSubscription(subscriptionId);

      // Create new subscription with new plan
      const newSubscription = await subscriptionService.createSubscription(
        req.user!.id,
        newPlanId
      );

      res.json({
        status: 'success',
        data: newSubscription,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get subscription usage and limits
   */
  getUsage: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const usage = await subscriptionService.getSubscriptionUsage(
        req.user!.id
      );

      res.json({
        status: 'success',
        data: usage,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Cancel subscription
   */
  cancelSubscription: async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { subscriptionId } = req.body;

      if (!subscriptionId) throw new AppError('Subscription ID required', 400);

      const cancelled = await subscriptionService.cancelSubscription(
        subscriptionId
      );

      res.json({
        status: 'success',
        data: cancelled,
      });
    } catch (error) {
      next(error);
    }
  },
};

export default SubscriptionController;
