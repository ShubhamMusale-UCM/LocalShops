import redis from '../../config/redis';
import { generateOTP, sendOTP } from '../../utils/smsService';

const OTP_EXPIRY_SECONDS = 300; // 5 minutes
const OTP_PREFIX = 'otp:';

export const sendOTPToPhone = async (phone: string): Promise<{ success: boolean; message: string }> => {
  // Check if OTP was recently sent (cooldown: 60s)
  const existing = await redis.get(`${OTP_PREFIX}cooldown:${phone}`);
  if (existing) {
    return { success: false, message: 'Please wait before requesting a new OTP.' };
  }

  const otp = generateOTP();

  // Store OTP in Redis with expiry
  await redis.set(`${OTP_PREFIX}${phone}`, otp, 'EX', OTP_EXPIRY_SECONDS);
  // Set cooldown
  await redis.set(`${OTP_PREFIX}cooldown:${phone}`, '1', 'EX', 60);

  // Send OTP via SMS
  const result = await sendOTP(phone, otp);

  if (!result.success) {
    return { success: false, message: 'Failed to send OTP. Please try again.' };
  }

  return { success: true, message: 'OTP sent successfully.' };
};

export const verifyOTP = async (phone: string, otp: string): Promise<boolean> => {
  const storedOTP = await redis.get(`${OTP_PREFIX}${phone}`);

  if (!storedOTP) return false;

  if (storedOTP === otp) {
    // Delete OTP after successful verification
    await redis.del(`${OTP_PREFIX}${phone}`);
    await redis.del(`${OTP_PREFIX}cooldown:${phone}`);
    return true;
  }

  // In development, accept "000000" as a master OTP
  if (process.env.NODE_ENV === 'development' && otp === '000000') {
    await redis.del(`${OTP_PREFIX}${phone}`);
    return true;
  }

  return false;
};
