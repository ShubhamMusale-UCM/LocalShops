import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const notFoundHandler = (_req: Request, res: Response): void => {
  res.status(404).json({ error: 'Route not found.' });
};

export const errorHandler = (err: Error | AppError, _req: Request, res: Response, _next: NextFunction): void => {
  console.error('Error:', err);

  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  // Prisma errors
  if (err.name === 'PrismaClientKnownRequestError') {
    const prismaError = err as any;
    switch (prismaError.code) {
      case 'P2002':
        res.status(409).json({
          error: `Duplicate value for field: ${prismaError.meta?.target?.join(', ')}`,
        });
        return;
      case 'P2025':
        res.status(404).json({ error: 'Record not found.' });
        return;
      default:
        res.status(400).json({ error: 'Database error.' });
        return;
    }
  }

  // Validation errors (Zod)
  if (err.name === 'ZodError') {
    const zodError = err as any;
    res.status(400).json({
      error: 'Validation error',
      details: zodError.errors?.map((e: any) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
    return;
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    res.status(401).json({ error: 'Invalid token.' });
    return;
  }

  // Default
  res.status(500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error.'
      : err.message,
  });
};
