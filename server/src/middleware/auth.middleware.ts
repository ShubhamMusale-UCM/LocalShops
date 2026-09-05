import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../config/database';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    phone: string;
    role: string;
    name: string;
  };
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Access denied. No token provided.' });
      return;
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-super-secret-jwt-key') as {
      userId: string;
      phone: string;
      role: string;
    };

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, phone: true, role: true, name: true, isActive: true },
    });

    if (!user) {
      res.status(401).json({ error: 'Invalid token. User not found.' });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({ error: 'Account has been banned. Please contact support.' });
      return;
    }

    req.user = user;
    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      res.status(401).json({ error: 'Token expired.' });
    } else {
      res.status(401).json({ error: 'Invalid token.' });
    }
  }
};

export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated.' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Not authorized for this action.' });
      return;
    }
    next();
  };
};

export const optionalAuth = async (req: AuthRequest, _res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-super-secret-jwt-key') as {
        userId: string;
        phone: string;
        role: string;
      };
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, phone: true, role: true, name: true },
      });
      if (user) req.user = user;
    }
  } catch { /* Silently continue without auth */ }
  next();
};
