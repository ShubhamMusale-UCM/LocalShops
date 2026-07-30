import axios from 'axios';

interface SMSResponse {
  success: boolean;
  requestId?: string;
  error?: string;
}

/**
 * Send OTP via MSG91
 */
export const sendOTP = async (phone: string, otp: string): Promise<SMSResponse> => {
  try {
    // In development, log OTP instead of sending
    if (process.env.NODE_ENV === 'development') {
      console.log(`📱 OTP for ${phone}: ${otp}`);
      return { success: true, requestId: 'dev-' + Date.now() };
    }

    const authKey = process.env.MSG91_AUTH_KEY;
    const templateId = process.env.MSG91_TEMPLATE_ID;

    if (!authKey || !templateId) {
      console.warn('⚠️  SMS credentials not configured');
      return { success: false, error: 'SMS service not configured' };
    }

    const response = await axios.post(
      'https://control.msg91.com/api/v5/otp',
      null,
      {
        params: {
          template_id: templateId,
          mobile: `91${phone}`,
          authkey: authKey,
          otp,
        },
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000,
      }
    );

    return { success: response.data.type === 'success', requestId: response.data.request_id };
  } catch (error: any) {
    console.error('SMS send error:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Generate a random 6-digit OTP
 */
export const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Send a general SMS
 */
export const sendSMS = async (phone: string, message: string): Promise<SMSResponse> => {
  try {
    if (process.env.NODE_ENV === 'development') {
      console.log(`📱 SMS to ${phone}: ${message}`);
      return { success: true };
    }

    const authKey = process.env.MSG91_AUTH_KEY;
    const senderId = process.env.MSG91_SENDER_ID || 'CLSHOP';

    if (!authKey) return { success: false, error: 'SMS service not configured' };

    const response = await axios.post(
      'https://control.msg91.com/api/v5/flow/',
      {
        sender: senderId,
        route: '4',
        country: '91',
        sms: [{ message, to: [phone] }],
      },
      {
        headers: {
          'Content-Type': 'application/json',
          authkey: authKey,
        },
        timeout: 10000,
      }
    );

    return { success: response.status === 200 };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};
