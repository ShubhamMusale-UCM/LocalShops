import Razorpay from 'razorpay';
import crypto from 'crypto';

let razorpayClient: Razorpay | null = null;

const getRazorpayClient = (): Razorpay => {
  if (!razorpayClient) {
    const key_id = process.env.RAZORPAY_KEY_ID;
    const key_secret = process.env.RAZORPAY_KEY_SECRET;
    if (!key_id || !key_secret) {
      throw new Error('Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.');
    }
    razorpayClient = new Razorpay({ key_id, key_secret });
  }
  return razorpayClient;
};

export const createRazorpayOrder = async (
  amount: number, // in ₹
  receipt: string,
  notes?: Record<string, string>,
  transfers?: any[]
) => {
  return getRazorpayClient().orders.create({
    amount: Math.round(amount * 100), // Razorpay uses paise
    currency: 'INR',
    receipt,
    notes,
    ...(transfers && transfers.length > 0 ? { transfers } : {})
  });
};

export const verifyPaymentSignature = (
  orderId: string,
  paymentId: string,
  signature: string
): boolean => {
  const body = orderId + '|' + paymentId;
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
    .update(body)
    .digest('hex');

  return expectedSignature === signature;
};

export const createSubscription = async (planId: string, totalCount: number = 12) => {
  return getRazorpayClient().subscriptions.create({
    plan_id: planId,
    total_count: totalCount,
    quantity: 1,
  });
};

export const verifyWebhookSignature = (body: string, signature: string): boolean => {
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET || '')
    .update(body)
    .digest('hex');

  return expectedSignature === signature;
};

export const createRazorpayRefund = async (paymentId: string, amount: number, notes?: Record<string, string>) => {
  return getRazorpayClient().payments.refund(paymentId, {
    amount: Math.round(amount * 100), // in paise
    notes
  });
};

export default getRazorpayClient;
