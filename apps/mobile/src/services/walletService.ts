import api from './api';

export interface WalletTransaction {
  id: string;
  amount: number;
  type: string;
  direction: 'CREDIT' | 'DEBIT';
  description: string | null;
  createdAt: string;
  isExpired: boolean;
  expiresAt: string | null;
}

export interface BuyerWalletBalance {
  balance: number;
  lifetime: number;
  spent: number;
  expired: number;
  nextExpiry: { amount: number; expiresAt: string } | null;
}

export interface SellerAdWalletBalance {
  shopId: string;
  adWalletBalance: number;
}

export interface ReferralStatus {
  totalReferrals: number;
  totalEarned: number;
  pendingReferrals: { id: string; referredUser: { name: string; avatar: string | null }; status: string }[];
  completedReferrals: { id: string; referredUser: { name: string; avatar: string | null }; amountCredited: number }[];
  referralCode: string;
  walletBalance: number;
  pendingAmount: number;
  rewardPerReferral: number;
}

export const walletService = {
  getBuyerBalance: async (): Promise<BuyerWalletBalance> => {
    const response = await api.get('/wallet/balance');
    return response.data.data;
  },

  getBuyerHistory: async (page = 1, limit = 20) => {
    const response = await api.get(`/wallet/history?page=${page}&limit=${limit}`);
    return response.data.data;
  },

  getReferralStatus: async (): Promise<ReferralStatus> => {
    const response = await api.get('/wallet/referral-status');
    return response.data.data;
  },

  calculateUsage: async (orderTotal: number) => {
    const response = await api.post('/wallet/calculate-usage', { orderTotal });
    return response.data.data;
  },

  getAdWalletBalance: async (shopId: string): Promise<SellerAdWalletBalance> => {
    const response = await api.get(`/wallet/ad-wallet/${shopId}`);
    return response.data.data;
  },

  getAdWalletHistory: async (shopId: string, page = 1, limit = 20) => {
    const response = await api.get(`/wallet/ad-wallet/${shopId}/history?page=${page}&limit=${limit}`);
    return response.data.data;
  },

  calculateAdSplit: async (shopId: string, budget: number) => {
    const response = await api.post(`/wallet/ad-wallet/${shopId}/calculate-split`, { adBudget: budget });
    return response.data.data;
  },
};
