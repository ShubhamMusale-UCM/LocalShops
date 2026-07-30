import { Request, Response, NextFunction } from 'express';
import { cacheGet, cacheSet } from '../config/redis';

export const cacheMiddleware = (ttlSeconds: number = 300) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    const key = `cache:${req.originalUrl || req.url}`;
    
    try {
      const cachedResponse = await cacheGet<any>(key);
      if (cachedResponse) {
        res.json(cachedResponse);
        return;
      }
      
      // Override res.json to automatically cache the payload before sending
      const originalJson = res.json.bind(res);
      res.json = ((body: any) => {
        // Only cache successful responses (status 200-299)
        if (res.statusCode >= 200 && res.statusCode < 300) {
          cacheSet(key, body, ttlSeconds).catch((err) => 
            console.error('Failed to cache response in middleware:', err)
          );
        }
        return originalJson(body);
      }) as any;
      
      next();
    } catch (error) {
      // Proceed if Redis fails
      next();
    }
  };
};
