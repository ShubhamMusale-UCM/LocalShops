import Razorpay from 'razorpay';
import crypto from 'crypto';

const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;

const razorpay =
  razorpayKeyId && razorpayKeySecret
    ? new Razorpay({
        key_id: razorpayKeyId,
        key_secret: razorpayKeySecret,
      })
    : null;

const getRazorpayClient = (): Razorpay => {
  if (!razorpay) {
    throw new Error('Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.');
  }
  return razorpay;
};

export const createRazorpayOrder = async (
  amount: number, // in ₹
  receipt: string,
  notes?: Record<string, string>
) => {
  return getRazorpayClient().orders.create({
    amount: Math.round(amount * 100), // Razorpay uses paise
    currency: 'INR',
    receipt,
    notes,
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

export default razorpay;
