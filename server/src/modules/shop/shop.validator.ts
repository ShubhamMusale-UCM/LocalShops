import { z } from 'zod';

export const createShopSchema = z.object({
  name: z.string().min(2, 'Shop name must be at least 2 characters').max(100),
  description: z.string().min(10, 'Description must be at least 10 characters').max(2000),
  logo: z.string().min(1).optional(),
  coverImage: z.string().min(1).optional(),
  photos: z.array(z.string().min(1)).optional(),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Invalid phone number'),
  whatsapp: z.string().regex(/^[6-9]\d{9}$/).optional(),
  email: z.string().email().optional(),
  website: z.string().url().optional(),
  address: z.string().min(5).max(500),
  landmark: z.string().max(200).optional(),
  city: z.string().min(2).max(100),
  state: z.string().min(2).max(100),
  pincode: z.string().regex(/^\d{6}$/, 'Pincode must be 6 digits'),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  category: z.string().min(2),
  subCategories: z.array(z.string()).optional(),
  gstNumber: z.string().regex(/^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}$/, 'Invalid GST number').optional(),
  operatingHours: z.record(z.object({
    open: z.string(),
    close: z.string(),
    isClosed: z.boolean().optional(),
  })),
});

export const updateShopSchema = createShopSchema.partial().extend({
  isOpen: z.boolean().optional(),
  deliveryEnabled: z.boolean().optional(),
  deliveryRadius: z.number().positive().optional(),
  minOrderDelivery: z.number().positive().optional(),
});

export const nearbyShopsSchema = z.object({
  lat: z.string().transform(Number).pipe(z.number().min(-90).max(90)),
  lng: z.string().transform(Number).pipe(z.number().min(-180).max(180)),
  radius: z.string().transform(Number).pipe(z.number().positive()).optional(),
  category: z.string().optional(),
  page: z.string().transform(Number).pipe(z.number().positive()).optional(),
  limit: z.string().transform(Number).pipe(z.number().positive().max(50)).optional(),
  sort: z.enum(['distance', 'rating', 'popularity', 'newest']).optional(),
});
