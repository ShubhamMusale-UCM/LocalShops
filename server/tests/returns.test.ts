import request from 'supertest';
import app from '../src/app';
import { prismaMock } from './setup';
import { mockAuthUser } from './utils';

describe('Returns Flow', () => {
  const buyerId = 'user-buyer-123';
  const sellerId = 'user-seller-456';
  const orderId = 'order-ret-123';
  const returnId = 'ret-req-123';
  
  let buyerToken: string;
  let sellerToken: string;

  beforeEach(() => {
    buyerToken = mockAuthUser(buyerId, 'BUYER', 'John Buyer');
    // For the seller request, we'll re-mock just before we need it, 
    // but we can generate tokens now
    sellerToken = mockAuthUser(sellerId, 'SELLER', 'Jane Seller');
  });

  describe('POST /api/orders/:id/return (Buyer Request)', () => {
    it('should create a return request successfully for a DELIVERED order', async () => {
      // We must re-mock for the buyer for this test
      mockAuthUser(buyerId, 'BUYER');

      prismaMock.order.findUnique.mockResolvedValue({
        id: orderId,
        userId: buyerId,
        status: 'DELIVERED',
        shopId: 'shop-1',
      } as any);

      prismaMock.returnRequest.findFirst.mockResolvedValue(null);

      prismaMock.returnRequest.create.mockResolvedValue({
        id: returnId,
        orderId,
        reason: 'Defective item',
        status: 'REQUESTED',
      } as any);

      const res = await request(app)
        .post(`/api/orders/${orderId}/return`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ reason: 'Defective item', description: 'Item came broken' });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id', returnId);
      expect(res.body.status).toBe('REQUESTED');
    });

    it('should throw 400 if order is not DELIVERED', async () => {
      mockAuthUser(buyerId, 'BUYER');

      prismaMock.order.findUnique.mockResolvedValue({
        id: orderId,
        userId: buyerId,
        status: 'SHIPPED', // Not delivered
        shopId: 'shop-1',
      } as any);

      const res = await request(app)
        .post(`/api/orders/${orderId}/return`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ reason: 'Defective item' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Can only return delivered orders/i);
    });
  });

  describe('PUT /api/orders/return/:returnId/status (Seller Approval)', () => {
    it('should allow seller to approve return and refund order', async () => {
      mockAuthUser(sellerId, 'SELLER');

      prismaMock.returnRequest.findUnique.mockResolvedValue({
        id: returnId,
        orderId,
        status: 'REQUESTED',
        order: {
          shop: { ownerId: sellerId },
          statusHistory: []
        }
      } as any);

      prismaMock.returnRequest.update.mockResolvedValue({
        id: returnId,
        status: 'APPROVED'
      } as any);

      const res = await request(app)
        .put(`/api/orders/return/${returnId}/status`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({ status: 'APPROVED', note: 'We will refund you' });

      expect(res.status).toBe(200);
      expect(prismaMock.returnRequest.update).toHaveBeenCalled();
    });

    it('should deny a buyer from approving returns', async () => {
      mockAuthUser(buyerId, 'BUYER');

      prismaMock.returnRequest.findUnique.mockResolvedValue({
        id: returnId,
        order: { shop: { ownerId: sellerId } } // different owner
      } as any);

      const res = await request(app)
        .put(`/api/orders/return/${returnId}/status`)
        .set('Authorization', `Bearer ${buyerToken}`) // trying to use buyer token
        .send({ status: 'APPROVED' });

      expect(res.status).toBe(403);
    });
  });
});
