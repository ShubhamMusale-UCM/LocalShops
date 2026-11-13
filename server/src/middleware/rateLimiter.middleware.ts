import rateLimit from 'express-rate-limit';

const isProduction = process.env.NODE_ENV === 'production';

// General API rate limiter
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isProduction ? 1500 : 10000, // High-scale allowance for telemetry batches, pagination & shared NAT/Wi-Fi
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Auth endpoints (stricter)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProduction ? 30 : 200,
  message: { error: 'Too many authentication attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// OTP sending (very strict in prod, relaxed for local dev)
export const otpLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: isProduction ? 5 : 30,
  message: { error: 'Too many OTP requests. Please wait before trying again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Search endpoints
export const searchLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: isProduction ? 180 : 1000,
  message: { error: 'Too many search requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Upload endpoints
export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProduction ? 120 : 500,
  message: { error: 'Too many file uploads. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Order creation endpoints
export const orderLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: isProduction ? 100 : 500,
  message: { error: 'Too many orders placed. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
