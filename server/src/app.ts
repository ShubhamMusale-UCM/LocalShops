import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { createServer } from 'http';
import path from 'path';

// Load environment variables
dotenv.config();

import prisma, { connectDatabase } from './config/database';
import redis from './config/redis';
import env from './config/env';
import { randomUUID } from 'crypto';
import { initializeFirebase } from './config/firebase';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.middleware';
import { generalLimiter } from './middleware/rateLimiter.middleware';

// Import routes
import authRoutes from './modules/auth/auth.routes';
import userRoutes from './modules/user/user.routes';
import wishlistRoutes from './modules/wishlist/wishlist.routes';
import shopRoutes from './modules/shop/shop.routes';
import productRoutes from './modules/product/product.routes';
import adminRoutes from './modules/admin/admin.routes';
import notificationRoutes from './modules/notification/notification.routes';
import orderRoutes from './modules/order/order.routes';
import reviewRoutes from './modules/review/review.routes';
import cartRoutes from './modules/cart/cart.routes';
import paymentRoutes from './modules/payment/payment.routes';
import searchRoutes from './modules/search/search.routes';

import analyticsRoutes from './modules/analytics/analytics.routes';
import adsRoutes from './modules/ads/ads.routes';
import subscriptionRoutes from './modules/subscription/subscription.routes';
import systemRoutes from './modules/system/system.routes';
import flashSaleRoutes from './modules/flashsale/flashsale.routes';
import walletRoutes from './modules/wallet/wallet.routes';
import kycRoutes from './modules/kyc/kyc.routes';
import supportRoutes from './modules/support/support.routes';
import networkRoutes from './modules/network/network.routes';

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 5000;

// Required when running behind ngrok/reverse proxies so rate-limiter sees real client IP.
app.set('trust proxy', 1);

// ============= MIDDLEWARE =============

// Security & Request ID
app.use((req, res, next) => {
  const reqId = (req.headers['x-request-id'] as string) || randomUUID();
  res.setHeader('x-request-id', reqId);
  next();
});
app.use(helmet({
  crossOriginResourcePolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (
      env.NODE_ENV !== 'production' ||
      env.CORS_ORIGINS.includes('*') ||
      env.CORS_ORIGINS.includes(origin)
    ) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

// Body parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Compression
app.use(compression());

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Prevent aggressive caching of API responses
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// Rate limiting
app.use('/api/', generalLimiter);

// ============= ROUTES =============

// Health check (liveness)
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'CityLocalShop API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Readiness probe (verifies PostgreSQL + Redis connectivity)
app.get('/api/ready', async (_req, res) => {
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    let redisOk = true;
    try {
      await redis.ping();
    } catch {
      redisOk = false;
    }
    res.status(200).json({
      status: 'ready',
      database: 'connected',
      redis: redisOk ? 'connected' : 'degraded',
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(503).json({
      status: 'not_ready',
      database: 'disconnected',
      error: err?.message || 'Database check failed',
      timestamp: new Date().toISOString(),
    });
  }
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/shops', shopRoutes);
app.use('/api/products', productRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/search', searchRoutes);

app.use('/api/analytics', analyticsRoutes);
app.use('/api/ads', adsRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/flash-sales', flashSaleRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api', kycRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/network', networkRoutes);

// Expose uploaded media with immutable 1-year browser disk caching
app.use('/uploads', express.static(path.resolve(__dirname, '../uploads'), {
  maxAge: '365d',
  immutable: true,
  setHeaders: (res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  },
}));

// ============= ERROR HANDLING =============

app.use(notFoundHandler);
app.use(errorHandler as any);

// ============= START SERVER =============

import { Server as SocketIOServer } from 'socket.io';
import OrderUpdatesSocket from './websockets/orderUpdates.ws';

import cronService from './services/cron.service';
import { initializeBackgroundJobs } from './jobs/index';

export let orderSocket: OrderUpdatesSocket;

const startServer = async () => {
  try {
    // Connect to database
    await connectDatabase();

    // Initialize Firebase (optional, warns if not configured)
    initializeFirebase();
    
    // Start Cron Jobs
    cronService.start();

    // Start BullMQ background jobs (wallet expiry, analytics sync, etc)
    await initializeBackgroundJobs();

    // Start HTTP server
    httpServer.listen(Number(PORT), '0.0.0.0', () => {
      console.log(`
╔══════════════════════════════════════════════════╗
║                                                  ║
║   🏪 CityLocalShop API Server                   ║
║   Running on: http://localhost:${PORT}              ║
║   Environment: ${process.env.NODE_ENV || 'development'}                ║
║                                                  ║
╚══════════════════════════════════════════════════╝
      `);
      
      // Initialize WebSockets after HTTP server starts
      const io = new SocketIOServer(httpServer, {
        cors: { origin: process.env.CORS_ORIGIN || '*', methods: ["GET", "POST"] }
      });
      orderSocket = new OrderUpdatesSocket(io);
      console.log('✅ WebSocket server initialized.');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

if (process.env.NODE_ENV !== 'test' && require.main === module) {
  startServer();
}

// Graceful shutdown for SIGTERM (Docker/production)
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  httpServer.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
});

// Graceful shutdown for SIGUSR2 (nodemon / ts-node-dev restarts)
process.once('SIGUSR2', () => {
  console.log('SIGUSR2 received. Shutting down for restart...');
  httpServer.close(() => {
    console.log('Server closed. Restarting...');
    process.kill(process.pid, 'SIGUSR2');
  });
});

export default app;

