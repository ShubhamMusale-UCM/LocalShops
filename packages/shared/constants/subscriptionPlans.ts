import { SubscriptionPlan, SubscriptionPlanDetails } from '../types/subscription';

export const SUBSCRIPTION_PLANS: SubscriptionPlanDetails[] = [
  {
    plan: SubscriptionPlan.FREE,
    name: 'Free',
    price: 0,
    maxProducts: 10,
    analyticsLevel: 'none',
    deliverySupport: false,
    promotedListings: false,
    dedicatedSupport: false,
    priorityPlacement: false,
    features: [
      'List up to 10 products',
      'Basic shop profile',
      'Receive orders',
      'Customer reviews',
    ],
  },
  {
    plan: SubscriptionPlan.STARTER,
    name: 'Starter',
    price: 499,
    maxProducts: 50,
    analyticsLevel: 'basic',
    deliverySupport: false,
    promotedListings: false,
    dedicatedSupport: false,
    priorityPlacement: false,
    features: [
      'List up to 50 products',
      'Basic analytics dashboard',
      'Priority listing in search',
      'Customer reviews with sentiment',
      'Shop stories (24hr)',
      'WhatsApp order alerts',
    ],
  },
  {
    plan: SubscriptionPlan.PROFESSIONAL,
    name: 'Professional',
    price: 1999,
    maxProducts: -1, // Unlimited
    analyticsLevel: 'advanced',
    deliverySupport: false,
    promotedListings: true,
    dedicatedSupport: false,
    priorityPlacement: false,
    features: [
      'Unlimited products',
      'Advanced analytics & insights',
      'Promoted listing credits (₹500/month)',
      'WhatsApp Business integration',
      'Sentiment analysis dashboard',
      'Product bundles & offers',
      'Priority customer support',
      'Bulk product upload (CSV/Excel)',
    ],
  },
  {
    plan: SubscriptionPlan.PREMIUM,
    name: 'Premium',
    price: 4999,
    maxProducts: -1, // Unlimited
    analyticsLevel: 'premium',
    deliverySupport: true,
    promotedListings: true,
    dedicatedSupport: true,
    priorityPlacement: true,
    features: [
      'Everything in Professional',
      'Delivery support & fleet management',
      'Top placement in search results',
      'Featured shop badge ⭐',
      'Dedicated account manager',
      'Custom shop page design',
      'Advanced CRM & customer insights',
      'Promoted listing credits (₹2000/month)',
      'Priority verification',
    ],
  },
];

export const getPlanByType = (plan: SubscriptionPlan): SubscriptionPlanDetails | undefined =>
  SUBSCRIPTION_PLANS.find(p => p.plan === plan);

export const getMaxProducts = (plan: SubscriptionPlan): number => {
  const planDetails = getPlanByType(plan);
  return planDetails?.maxProducts ?? 10;
};
