import { Request, Response, NextFunction } from 'express';

export interface LocationRequest extends Request {
  userLocation?: {
    latitude: number;
    longitude: number;
  };
}

export const extractLocation = (req: LocationRequest, _res: Response, next: NextFunction): void => {
  const lat = parseFloat(req.query.lat as string || req.headers['x-user-lat'] as string);
  const lng = parseFloat(req.query.lng as string || req.headers['x-user-lng'] as string);

  if (!isNaN(lat) && !isNaN(lng)) {
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      req.userLocation = { latitude: lat, longitude: lng };
    }
  }

  next();
};

export const requireLocation = (req: LocationRequest, res: Response, next: NextFunction): void => {
  const lat = parseFloat(req.query.lat as string || req.headers['x-user-lat'] as string);
  const lng = parseFloat(req.query.lng as string || req.headers['x-user-lng'] as string);

  if (isNaN(lat) || isNaN(lng)) {
    res.status(400).json({
      error: 'Location required. Provide lat/lng as query parameters or x-user-lat/x-user-lng headers.',
    });
    return;
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    res.status(400).json({ error: 'Invalid coordinates.' });
    return;
  }

  req.userLocation = { latitude: lat, longitude: lng };
  next();
};
