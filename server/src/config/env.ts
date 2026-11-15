import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.string().default('5000'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 characters').optional(),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  CORS_ORIGIN: z.string().default('http://localhost:5173,http://localhost:3000,capacitor://localhost,http://localhost'),
  DATA_ENCRYPTION_KEY: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`Invalid environment configuration: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`);
  }
}

const rawJwtSecret = process.env.JWT_SECRET || '';
if (
  process.env.NODE_ENV === 'production' &&
  (!rawJwtSecret || rawJwtSecret.includes('your-super-secret'))
) {
  throw new Error('FATAL: Production environment cannot boot with default fallback JWT_SECRET.');
}

export const env = {
  NODE_ENV: (process.env.NODE_ENV as 'development' | 'test' | 'production') || 'development',
  PORT: Number(process.env.PORT || 5000),
  DATABASE_URL: process.env.DATABASE_URL || '',
  JWT_SECRET: rawJwtSecret || 'dev-only-ephemeral-jwt-secret-key-32bytes',
  JWT_REFRESH_SECRET:
    process.env.JWT_REFRESH_SECRET ||
    (rawJwtSecret ? `${rawJwtSecret}_refresh` : 'dev-only-ephemeral-refresh-secret-32bytes'),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '15m',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  CORS_ORIGINS: (
    process.env.CORS_ORIGIN ||
    'http://localhost:5173,http://localhost:3000,capacitor://localhost,https://localhost,http://localhost'
  )
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  DATA_ENCRYPTION_KEY:
    process.env.DATA_ENCRYPTION_KEY ||
    rawJwtSecret ||
    'dev-only-ephemeral-encryption-key-32b',
};

export default env;
