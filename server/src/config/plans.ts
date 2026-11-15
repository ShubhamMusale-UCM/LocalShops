export interface PlanLimitConfig {
  maxProducts: number;
  maxCsvBatchRows: number;
  maxImagesPerProduct: number;
  maxStaffMembers: number;
}

export const PLAN_LIMITS: Record<string, PlanLimitConfig> = {
  FREE: {
    maxProducts: 1000,
    maxCsvBatchRows: 500,
    maxImagesPerProduct: 10,
    maxStaffMembers: 1,
  },
  STARTER: {
    maxProducts: 5000,
    maxCsvBatchRows: 2000,
    maxImagesPerProduct: 10,
    maxStaffMembers: 3,
  },
  PROFESSIONAL: {
    maxProducts: 999999,
    maxCsvBatchRows: 5000,
    maxImagesPerProduct: 15,
    maxStaffMembers: 10,
  },
  PREMIUM: {
    maxProducts: 999999,
    maxCsvBatchRows: 10000,
    maxImagesPerProduct: 20,
    maxStaffMembers: 25,
  },
};

export function getPlanLimits(plan?: string | null): PlanLimitConfig {
  return PLAN_LIMITS[plan || 'FREE'] || PLAN_LIMITS.FREE;
}
