import redis from '../../config/redis';
import prisma from '../../config/database';
import { generateTokenPair, verifyRefreshToken } from './jwt.service';
import otpHandler from './otp.handler';
import { nanoid } from 'nanoid';
import { AppError } from '../../middleware/errorHandler.middleware';
import slugify from 'slugify';

const normalizeIndianPhone = (input: string): string => {
  const digits = input.replace(/\D/g, '');
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  throw new AppError('Invalid phone number format.', 400);
};

export class AuthService {
  /**
   * Send OTP to phone number
   */
  async sendOTP(phone: string) {
    // Validate and normalize Indian phone number
    const normalizedPhone = normalizeIndianPhone(phone);

    // Generate and store OTP
    const otp = await otpHandler.generateOTP(normalizedPhone);

    const isDev = process.env.NODE_ENV !== 'production';
    return {
      success: true,
      message: isDev ? 'OTP sent successfully. (Dev: ' + otp + ')' : 'OTP sent successfully.',
    };
  }

  /**
   * Verify OTP and return user (or indicate new user)
   */
  async verifyOTP(phone: string, otp: string) {
    // Validate and normalize phone number
    const normalizedPhone = normalizeIndianPhone(phone);

    // Verify OTP
    await otpHandler.verifyOTP(normalizedPhone, otp);

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { phone: normalizedPhone },
    });

    if (existingUser) {
      const tokens = generateTokenPair({
        userId: existingUser.id,
        phone: existingUser.phone,
        role: existingUser.role,
      });

      return {
        isNewUser: false,
        user: existingUser,
        ...tokens,
      };
    }

    // New user — generate a temporary token for registration
    const tempToken = nanoid();
    await otpHandler.generateTempToken(normalizedPhone, tempToken);

    return {
      isNewUser: true,
      phone: normalizedPhone,
      tempToken,
      message: 'OTP verified. Please complete registration.',
    };
  }

  /**
   * Register a new user after OTP verification
   */
  async register(data: {
    phone: string;
    name: string;
    role?: string;
    email?: string;
    referralCode?: string;
    city?: string;
    idToken?: string; // Optional for backward compatibility with tempToken
    deviceId?: string;
  }) {
    const normalizedPhone = normalizeIndianPhone(data.phone);
    const normalizedRole = String(data.role || 'BUYER').toUpperCase();

    // Verify temp token (which client passes as idToken)
    if (!data.idToken) {
      throw new AppError('Registration token is required. Please verify OTP first.', 401);
    }
    await otpHandler.verifyTempToken(normalizedPhone, data.idToken);

    // Check if user already exists
    const existing = await prisma.user.findUnique({ where: { phone: normalizedPhone } });
    if (existing) {
      throw new AppError('User already registered with this phone number.', 409);
    }

    // Generate unique referral code
    const referralCode = `CLS${nanoid(6).toUpperCase()}`;

    // Handle referral (with device abuse protection)
    let referredBy: string | null = null;
    if (data.referralCode) {
      const referrer = await prisma.user.findUnique({
        where: { referralCode: data.referralCode },
      });
      
      if (referrer) {
        let isAbuse = false;
        const deviceId = data.deviceId || 'unknown';
        
        if (deviceId !== 'unknown') {
          const deviceKey = `referral_device_count:${deviceId}`;
          const count = await redis.incr(deviceKey);
          if (count === 1) {
            await redis.expire(deviceKey, 60 * 60 * 24 * 30); // 30 days
          }
          if (count > 2) {
            isAbuse = true;
            console.warn(`[Anti-Fraud] Blocked referral reward for device ${deviceId}. Too many signups.`);
          }
        }
        
        if (!isAbuse) {
          referredBy = referrer.id;
        }
      }
    }

    const user = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          phone: normalizedPhone,
          name: data.name,
          role: normalizedRole as any,
          email: data.email,
          city: data.city,
          referralCode,
          referredBy,
        },
      });

      if (referredBy) {
        await tx.referralEarning.create({
          data: {
            referrerId: referredBy,
            referredUserId: createdUser.id,
            type: 'USER_SIGNUP',
            amount: 50,
          },
        });
      }

      if (normalizedRole === 'SELLER') {
        const defaultShopName = `${data.name}'s Shop`;
        const defaultSlug = `${slugify(defaultShopName, { lower: true, strict: true })}-${nanoid(4)}`;

        await tx.shop.create({
          data: {
            ownerId: createdUser.id,
            name: defaultShopName,
            slug: defaultSlug,
            description: 'Local seller shop. Update details from shop customization.',
            phone: normalizedPhone,
            address: 'Address pending update',
            city: data.city || 'Bengaluru',
            state: 'Karnataka',
            pincode: '560001',
            latitude: 12.9716,
            longitude: 77.5946,
            category: 'General Store',
            subCategories: [],
            operatingHours: {
              monday: { open: '09:00', close: '21:00', isClosed: false },
              tuesday: { open: '09:00', close: '21:00', isClosed: false },
              wednesday: { open: '09:00', close: '21:00', isClosed: false },
              thursday: { open: '09:00', close: '21:00', isClosed: false },
              friday: { open: '09:00', close: '21:00', isClosed: false },
              saturday: { open: '09:00', close: '21:00', isClosed: false },
              sunday: { open: '09:00', close: '21:00', isClosed: false },
            },
          },
        });
      }

      // Create buyer wallet for every new user (used for referral coins)
      await tx.buyerWallet.create({
        data: { userId: createdUser.id, balance: 0, lifetime: 0, spent: 0, expired: 0 },
      });

      return createdUser;
    });

    const tokens = generateTokenPair({
      userId: user.id,
      phone: user.phone,
      role: user.role,
    });

    return { user, ...tokens };
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string) {
    try {
      const payload = verifyRefreshToken(refreshToken);

      const user = await prisma.user.findUnique({ where: { id: payload.userId } });
      if (!user) throw new AppError('User not found.', 404);

      const tokens = generateTokenPair({
        userId: user.id,
        phone: user.phone,
        role: user.role,
      });

      return tokens;
    } catch (error) {
      throw new AppError('Invalid refresh token.', 401);
    }
  }
}

export default new AuthService();
