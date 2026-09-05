import jwt from 'jsonwebtoken';
import { prismaMock } from './setup';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';

export const generateTestToken = (userId: string, role = 'BUYER', phone = '1234567890') => {
  return jwt.sign({ userId, role, phone }, JWT_SECRET, { expiresIn: '1h' });
};

export const mockAuthUser = (userId: string, role = 'BUYER', name = 'Test User') => {
  prismaMock.user.findUnique.mockResolvedValue({
    id: userId,
    role,
    name,
    phone: '1234567890',
  } as any);
  
  return generateTestToken(userId, role);
};
