import api from './api';

export interface RazorpayOrderResponse {
  id: string;
  orderId?: string;
  localOrderId?: string;
  orderNumber?: string;
  pickupFallback?: boolean;
  entity: string;
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string;
  offer_id?: string;
  status: string;
  attempts: number;
  notes?: Record<string, any>;
  created_at: number;
}

export interface PaymentVerificationPayload {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  orderId?: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  billingCycle: 'monthly' | 'yearly';
  features: string[];
  maxProducts: number;
}

export interface PaymentResponse {
  success: boolean;
  orderId?: string;
  transactionId?: string;
  message: string;
}

class PaymentService {
  /**
   * Create a Razorpay order for product purchase
   */
  async createProductOrder(payload: {
    amount: number;
    clientRequestId?: string;
    cartItems: Array<{
      productId: string;
      shopId: string;
      quantity: number;
      price: number;
      name?: string;
      campaignId?: string;
    }>;
    deliveryAddress: {
      address: string;
      latitude: number;
      longitude: number;
      pincode: string;
    };
    paymentMethod: 'COD' | 'ONLINE';
    deliveryType?: 'DELIVERY' | 'PICKUP';
  }): Promise<RazorpayOrderResponse> {
    const { data } = await api.post('/payment/create-order', payload);
    const localOrderId = data?.orderId || data?.id;
    return {
      ...data,
      id: data?.id || data?.orderId,
      orderId: localOrderId,
      localOrderId,
    };
  }

  /**
   * Verify payment after Razorpay success
   */
  async verifyPayment(payload: PaymentVerificationPayload): Promise<PaymentResponse> {
    const { data } = await api.post('/payment/verify', payload);
    return data;
  }

  /**
   * Create a subscription order (for sellers)
   */
  async createSubscription(payload: {
    planId: string;
    billingCycle: 'monthly' | 'yearly';
  }): Promise<RazorpayOrderResponse> {
    const { data } = await api.post('/payment/subscription', payload);
    return data;
  }

  /**
   * Activate a subscription after payment verification
   */
  async activateSubscription(payload: {
    planId: string;
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }): Promise<PaymentResponse> {
    const { data } = await api.post('/payment/subscription/activate', payload);
    return data;
  }

  /**
   * Get subscription plans
   */
  async getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    const { data } = await api.get('/payment/plans');
    return data;
  }

  /**
   * Get user's payment history
   */
  async getPaymentHistory(params?: {
    page?: number;
    limit?: number;
    status?: 'pending' | 'success' | 'failed';
  }): Promise<{
    payments: Array<{
      id: string;
      amount: number;
      status: string;
      type: 'product' | 'subscription';
      createdAt: string;
    }>;
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const { data } = await api.get('/payment/history', { params });
    return data;
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(): Promise<PaymentResponse> {
    const { data } = await api.post('/payment/subscription/cancel');
    return data;
  }

  /**
   * Get current subscription details
   */
  async getCurrentSubscription(): Promise<{
    id: string;
    userId: string;
    plan: SubscriptionPlan;
    status: 'active' | 'cancelled' | 'expired';
    startDate: string;
    endDate: string;
  } | null> {
    const { data } = await api.get('/payment/subscription/current');
    return data;
  }

  /**
   * Request refund for an order
   */
  async requestRefund(orderId: string, reason: string): Promise<PaymentResponse> {
    const { data } = await api.post(`/payment/refund/${orderId}`, { reason });
    return data;
  }
}

export default new PaymentService();
