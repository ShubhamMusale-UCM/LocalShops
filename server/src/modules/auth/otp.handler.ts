import redis from '../../config/redis';
import { AppError } from '../../middleware/errorHandler.middleware';

const OTP_LENGTH = 6;
const OTP_EXPIRY = 10 * 60; // 10 minutes

export class OTPHandler {
  /**
   * Generate and store OTP for a phone number
   */
  async generateOTP(phone: string): Promise<string> {
    // Validate phone format (10 digits)
    if (!/^\d{10}$/.test(phone)) {
      throw new AppError('Invalid phone number format.', 400);
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store OTP in Redis with expiry
    const key = `otp:${phone}`;
    await redis.setex(key, OTP_EXPIRY, otp);

    // Log for development (in production, would send via SMS)
    console.log(`[DEV] OTP for ${phone}: ${otp}`);

    return otp;
  }

  /**
   * Verify OTP for a phone number
   */
  async verifyOTP(phone: string, otp: string): Promise<boolean> {
    if (!/^\d{10}$/.test(phone)) {
      throw new AppError('Invalid phone number format.', 400);
    }

    if (!/^\d{6}$/.test(otp)) {
      throw new AppError('Invalid OTP format.', 400);
    }

    const key = `otp:${phone}`;
    const storedOTP = await redis.get(key);

    if (!storedOTP) {
      throw new AppError('OTP has expired. Please request a new one.', 400);
    }

    if (storedOTP !== otp) {
      throw new AppError('Invalid OTP. Please try again.', 400);
    }

    // Delete OTP after successful verification
    await redis.del(key);

    return true;
  }

  /**
   * Check if OTP is available for a phone number
   */
  async hasOTP(phone: string): Promise<boolean> {
    const key = `otp:${phone}`;
    const exists = await redis.exists(key);
    return exists > 0;
  }
}

export default new OTPHandler();
