import apiClient from './api';

interface Ad {
  id: string;
  sellerId: string;
  productId?: string;
  shopId?: string;
  title: string;
  description: string;
  budget: number;
  dailyBudget: number;
  startDate: string;
  endDate: string;
  status: 'PENDING' | 'ACTIVE' | 'PAUSED' | 'ENDED' | 'REJECTED';
  targetAudience: {
    ageGroup?: string[];
    location?: string[];
    interests?: string[];
  };
  metrics: {
    impressions: number;
    clicks: number;
    conversions: number;
    ctr: number;
    conversionRate: number;
  };
  createdAt: string;
  updatedAt: string;
}

interface CreateAdPayload {
  productId?: string;
  shopId?: string;
  title: string;
  description: string;
  budget: number;
  budgetPerDay?: number;
  bidPerClick?: number;
  duration?: number;
  dailyBudget?: number;
  startDate: string;
  endDate: string;
  targetAudience?: {
    ageGroup?: string[];
    location?: string[];
    interests?: string[];
  };
}

interface AdStats {
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  totalSpent: number;
  totalROI: number;
  ads: Ad[];
}

const trackedImpressionsCache = new Set<string>();

const adsService = {
  getTrending: async (limit = 10, query?: string, category?: string, lat?: number, lng?: number) => {
    const params: any = { limit };
    if (query) params.q = query;
    if (category && category !== 'all') params.category = category;
    if (lat !== undefined) params.lat = lat;
    if (lng !== undefined) params.lng = lng;
    const response = await apiClient.get('/ads/trending', { params });
    return response.data?.data || response.data || [];
  },

  getShopAds: async (shopId: string) => {
    const response = await apiClient.get(`/ads/shop/${shopId}`);
    return response.data?.data || response.data || [];
  },

  getShopPromotionAnalytics: async (shopId: string) => {
    const response = await apiClient.get(`/ads/shop/${shopId}/analytics`);
    return response.data?.data || response.data || { summary: {}, campaigns: [] };
  },

  getShopDailyMetrics: async (shopId: string, days = 14) => {
    const response = await apiClient.get(`/ads/shop/${shopId}/daily-metrics`, { params: { days } });
    return response.data?.data || response.data || [];
  },

  getAdAnalytics: async (adId: string) => {
    const response = await apiClient.get(`/ads/${adId}/analytics`);
    return response.data?.data || response.data || {};
  },

  renewBudget: async (adId: string, additionalBudget: number) => {
    const response = await apiClient.post(`/ads/${adId}/renew-budget`, { additionalBudget });
    return response.data?.data || response.data;
  },

  trackClick: async (adId: string) => {
    const response = await apiClient.post(`/ads/${adId}/click`, {});
    return response.data?.data || response.data;
  },

  trackImpressions: async (adIds: string[]) => {
    if (!adIds || adIds.length === 0) return;

    // Deduplicate impressions on the frontend so we don't spam the server
    // for the same ad in a single app session.
    const untrackedIds = adIds.filter((id) => !trackedImpressionsCache.has(id));
    
    if (untrackedIds.length === 0) return;

    // Mark as tracked
    untrackedIds.forEach((id) => trackedImpressionsCache.add(id));

    try {
      await apiClient.post('/ads/impression', { adIds: untrackedIds });
    } catch (error) {
      console.warn('Failed to track impressions', error);
      // If network fails, allow retrying later
      untrackedIds.forEach((id) => trackedImpressionsCache.delete(id));
    }
  },

  /**
   * Get all ads for current seller
   */
  getMyAds: async (filters?: { status?: string; from?: string; to?: string }) => {
    try {
      const response = await apiClient.get<{ data: Ad[] }>('/ads', { params: filters });
      return response.data.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get single ad details
   */
  getAd: async (adId: string) => {
    try {
      const response = await apiClient.get<{ data: Ad }>(`/ads/${adId}`);
      return response.data.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Create a new ad
   */
  createAd: async (payload: CreateAdPayload) => {
    try {
      const response = await apiClient.post<{ data: Ad }>('/ads/create', payload);
      return response.data.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Update ad details
   */
  updateAd: async (adId: string, payload: Partial<CreateAdPayload>) => {
    try {
      const response = await apiClient.put<{ data: Ad }>(`/ads/${adId}`, payload);
      return response.data.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Pause an active ad
   */
  pauseAd: async (adId: string) => {
    try {
      const response = await apiClient.post<{ data: Ad }>(`/ads/${adId}/pause`, {});
      return response.data.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Resume a paused ad
   */
  resumeAd: async (adId: string) => {
    try {
      const response = await apiClient.post<{ data: Ad }>(`/ads/${adId}/resume`, {});
      return response.data.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Delete an ad
   */
  deleteAd: async (adId: string) => {
    try {
      await apiClient.delete(`/ads/${adId}`);
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get ads performance metrics
   */
  getMetrics: async (adId: string, from?: string, to?: string) => {
    try {
      const response = await apiClient.get<{ data: Ad['metrics'] }>(
        `/ads/${adId}/metrics`,
        {
          params: { from, to },
        }
      );
      return response.data.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get aggregate stats for all seller ads
   */
  getStats: async (from?: string, to?: string) => {
    try {
      const response = await apiClient.get<{ data: AdStats }>('/ads/stats', {
        params: { from, to },
      });
      return response.data.data;
    } catch (error) {
      throw error;
    }
  },
};

export default adsService;
