import rateLimit from 'express-rate-limit';

const isProduction = process.env.NODE_ENV === 'production';

// General API rate limiter
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isProduction ? 100 : 1000, // Keep strict in prod, relaxed for local dev
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Auth endpoints (stricter)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many authentication attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// OTP sending (very strict in prod, relaxed for local dev)
export const otpLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: isProduction ? 2 : 20,
  message: { error: 'Too many OTP requests. Please wait before trying again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Search endpoints
export const searchLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30,
  message: { error: 'Too many search requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Upload endpoints
export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many file uploads. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Order creation endpoints
export const orderLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // Max 20 orders per hour per IP
  message: { error: 'Too many orders placed. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
