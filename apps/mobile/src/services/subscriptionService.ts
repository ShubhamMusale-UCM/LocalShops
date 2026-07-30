import apiClient from './api';

interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  features: string[];
}

interface UserSubscription {
  id: string;
  userId: string;
  planName: string;
  price: number;
  status: 'ACTIVE' | 'CANCELLED';
  startDate: string;
  endDate: string;
}

interface SubscriptionUsage {
  productCount: number;
  promotedCount: number;
  limits: {
    maxProducts: number;
    maxPromotedListings: number;
  };
  usage: {
    productsPercent: number;
    promotedPercent: number;
  };
}

const subscriptionService = {
  /**
   * Get all available subscription plans
   */
  getPlans: async () => {
    try {
      const response = await apiClient.get<{ data: SubscriptionPlan[] }>('/subscriptions/plans');
      return response.data.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get user's current subscription
   */
  getUserSubscription: async () => {
    try {
      const response = await apiClient.get<{ data: UserSubscription }>(
        '/subscriptions/my-subscription'
      );
      return response.data.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get subscription usage and limits
   */
  getUsage: async () => {
    try {
      const response = await apiClient.get<{ data: SubscriptionUsage }>(
        '/subscriptions/usage'
      );
      return response.data.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Subscribe to a plan
   */
  subscribe: async (planId: string) => {
    try {
      const response = await apiClient.post<{ data: UserSubscription }>(
        '/subscriptions/create',
        { planId }
      );
      return response.data.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Upgrade to a different plan
   */
  upgradePlan: async (subscriptionId: string, newPlanId: string) => {
    try {
      const response = await apiClient.put<{ data: UserSubscription }>(
        '/subscriptions/upgrade',
        { subscriptionId, newPlanId }
      );
      return response.data.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Cancel subscription
   */
  cancelSubscription: async (subscriptionId: string) => {
    try {
      const response = await apiClient.post<{ data: UserSubscription }>(
        '/subscriptions/cancel',
        { subscriptionId }
      );
      return response.data.data;
    } catch (error) {
      throw error;
    }
  },
};

export default subscriptionService;
