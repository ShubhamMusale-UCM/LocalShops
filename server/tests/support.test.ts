import request from 'supertest';
import app from '../src/app';
import { prismaMock } from './setup';
import { mockAuthUser } from './utils';

describe('Support Flow', () => {
  const userId = 'user-support-123';
  let token: string;

  beforeEach(() => {
    token = mockAuthUser(userId, 'BUYER', 'Jane Doe');
  });

  describe('POST /api/users/support', () => {
    it('should create a support ticket successfully', async () => {
      prismaMock.supportTicket.create.mockResolvedValue({
        id: 'ticket-1',
        userId,
        subject: 'App crashes on checkout',
        description: 'When I click pay, it crashes.',
        status: 'OPEN',
        createdAt: new Date(),
        updatedAt: new Date(),
        orderId: null,
      } as any);

      const res = await request(app)
        .post('/api/users/support')
        .set('Authorization', `Bearer ${token}`)
        .send({
          subject: 'App crashes on checkout',
          description: 'When I click pay, it crashes.',
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id', 'ticket-1');
      expect(res.body.subject).toBe('App crashes on checkout');
      expect(prismaMock.supportTicket.create).toHaveBeenCalledTimes(1);
    });

    it('should return 400 if subject or description is missing', async () => {
      const res = await request(app)
        .post('/api/users/support')
        .set('Authorization', `Bearer ${token}`)
        .send({ subject: 'Only subject provided' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/required/i);
    });
  });

  describe('GET /api/users/support', () => {
    it('should retrieve tickets for the logged in user', async () => {
      prismaMock.supportTicket.findMany.mockResolvedValue([
        { id: 'ticket-1', subject: 'Issue 1', status: 'OPEN' } as any,
        { id: 'ticket-2', subject: 'Issue 2', status: 'RESOLVED' } as any,
      ]);

      const res = await request(app)
        .get('/api/users/support')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBe(2);
      expect(res.body[0].subject).toBe('Issue 1');
      expect(prismaMock.supportTicket.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
    });
  });
});
