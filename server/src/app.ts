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

import { connectDatabase } from './config/database';
import { initializeFirebase } from './config/firebase';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.middleware';
import { generalLimiter } from './middleware/rateLimiter.middleware';

// Import routes
import authRoutes from './modules/auth/auth.routes';
import userRoutes from './modules/user/user.routes';
import shopRoutes from './modules/shop/shop.routes';
import productRoutes from './modules/product/product.routes';
import adminRoutes from './modules/admin/admin.routes';
import notificationRoutes from './modules/notification/notification.routes';
import orderRoutes from './modules/order/order.routes';
import reviewRoutes from './modules/review/review.routes';
import paymentRoutes from './modules/payment/payment.routes';
import searchRoutes from './modules/search/search.routes';

import analyticsRoutes from './modules/analytics/analytics.routes';
import adsRoutes from './modules/ads/ads.routes';
import subscriptionRoutes from './modules/subscription/subscription.routes';
import systemRoutes from './modules/system/system.routes';

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 5000;

// Required when running behind ngrok/reverse proxies so rate-limiter sees real client IP.
app.set('trust proxy', 1);

// ============= MIDDLEWARE =============

// Security
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Compression
app.use(compression());

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Rate limiting
app.use('/api/', generalLimiter);

// ============= ROUTES =============

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'CityLocalShop API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/shops', shopRoutes);
app.use('/api/products', productRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/search', searchRoutes);

app.use('/api/analytics', analyticsRoutes);
app.use('/api/ads', adsRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/system', systemRoutes);

// Expose uploaded media for local/dev storage fallback.
app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));

// ============= ERROR HANDLING =============

app.use(notFoundHandler);
app.use(errorHandler as any);

// ============= START SERVER =============

const startServer = async () => {
  try {
    // Connect to database
    await connectDatabase();

    // Initialize Firebase (optional, warns if not configured)
    initializeFirebase();

    // Start HTTP server
    httpServer.listen(PORT, () => {
      console.log(`
╔══════════════════════════════════════════════════╗
║                                                  ║
║   🏪 CityLocalShop API Server                   ║
║   Running on: http://localhost:${PORT}              ║
║   Environment: ${process.env.NODE_ENV || 'development'}                ║
║                                                  ║
╚══════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  httpServer.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
});

export default app;

