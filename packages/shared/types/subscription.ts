export enum SubscriptionPlan {
  FREE = 'FREE',
  STARTER = 'STARTER',
  PROFESSIONAL = 'PROFESSIONAL',
  PREMIUM = 'PREMIUM',
}

export interface Subscription {
  id: string;
  shopId: string;
  plan: SubscriptionPlan;
  amount: number;
  razorpaySubId?: string | null;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  createdAt: Date;
}

export interface SubscriptionPlanDetails {
  plan: SubscriptionPlan;
  name: string;
  price: number; // monthly in ₹
  features: string[];
  maxProducts: number;
  analyticsLevel: 'none' | 'basic' | 'advanced' | 'premium';
  deliverySupport: boolean;
  promotedListings: boolean;
  dedicatedSupport: boolean;
  priorityPlacement: boolean;
}
