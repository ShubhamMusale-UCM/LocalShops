import request from 'supertest';
import app from '../src/app';
import { prismaMock } from './setup';
import { mockAuthUser } from './utils';

// Mock Razorpay config
jest.mock('../src/config/razorpay', () => ({
  createRazorpayOrder: jest.fn().mockResolvedValue({ id: 'rzp_order_mock' }),
  verifyPaymentSignature: jest.fn().mockReturnValue(true),
  verifyWebhookSignature: jest.fn().mockReturnValue(true),
}));

describe('Checkout Flow', () => {
  const buyerId = 'user-buyer-123';
  let token: string;

  beforeEach(() => {
    token = mockAuthUser(buyerId, 'BUYER', 'John Doe');
  });

  describe('POST /api/orders', () => {
    it('should create an order successfully', async () => {
      prismaMock.shop.findUnique.mockResolvedValue({
        id: '550e8400-e29b-41d4-a716-446655440000',
        isActive: true,
      } as any);

      prismaMock.product.findMany.mockResolvedValue([
        {
          id: '550e8400-e29b-41d4-a716-446655440001',
          shopId: '550e8400-e29b-41d4-a716-446655440000',
          price: 100,
          inStock: true,
          quantity: 10,
        } as any,
      ]);

      prismaMock.$transaction.mockResolvedValue({
        id: 'order-123',
        orderNumber: 'ORD-12345678',
        userId: buyerId,
        shopId: '550e8400-e29b-41d4-a716-446655440000',
        total: 100,
        status: 'PLACED',
        paymentStatus: 'PENDING',
      } as any);

      const payload = {
        shopId: '550e8400-e29b-41d4-a716-446655440000',
        items: [{ 
          productId: '550e8400-e29b-41d4-a716-446655440001', 
          quantity: 1, 
          price: 100,
          name: 'Test Product'
        }],
        deliveryType: 'PICKUP',
        paymentMethod: 'ONLINE',
      };

      const res = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${token}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id', 'order-123');
      expect(res.body.paymentStatus).toBe('PENDING');
    });

    it('should return 400 if validation fails', async () => {
      const res = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({ shopId: 'shop-1' });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('POST /api/payment/create-payment-order', () => {
    it('should initialize razorpay order and update DB', async () => {
      prismaMock.order.findUnique.mockResolvedValue({
        id: 'order-123',
        userId: buyerId,
        total: 100,
        orderNumber: 'ORD-123',
        paymentStatus: 'PENDING',
      } as any);

      prismaMock.order.update.mockResolvedValue({
        id: 'order-123',
        razorpayOrderId: 'rzp_order_mock',
        paymentStatus: 'INITIATED',
      } as any);

      const res = await request(app)
        .post('/api/payment/create-payment-order')
        .set('Authorization', `Bearer ${token}`)
        .send({ orderId: 'order-123' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('razorpayOrderId', 'rzp_order_mock');
    });
  });
});
