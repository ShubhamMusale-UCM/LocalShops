import { z } from 'zod';

export const createProductSchema = z.object({
  name: z.string().min(2, 'Product name must be at least 2 characters').max(200),
  description: z.string().min(10, 'Description must be at least 10 characters').max(5000),
  shortDescription: z.string().max(200).optional(),
  price: z.number().positive('Price must be positive'),
  mrp: z.number().positive().optional(),
  discount: z.number().min(0).max(100).optional(),
  images: z.array(z.string()).min(1, 'At least one image is required').max(10),
  video: z.string().url().optional(),
  category: z.string().min(2),
  subCategory: z.string().optional(),
  tags: z.array(z.string()).optional(),
  brand: z.string().max(100).optional(),
  quantity: z.number().int().min(0).optional(),
  unit: z.string().max(20).optional(),
});

export const updateProductSchema = createProductSchema.partial().extend({
  inStock: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export const productSearchSchema = z.object({
  q: z.string().optional(),
  lat: z.string().transform(Number).pipe(z.number().min(-90).max(90)).optional(),
  lng: z.string().transform(Number).pipe(z.number().min(-180).max(180)).optional(),
  radius: z.string().transform(Number).pipe(z.number().positive()).optional(),
  minPrice: z.string().transform(Number).pipe(z.number().min(0)).optional(),
  maxPrice: z.string().transform(Number).pipe(z.number().positive()).optional(),
  category: z.string().optional(),
  subCategory: z.string().optional(),
  brand: z.string().optional(),
  inStock: z.string().transform(v => v === 'true').optional(),
  sort: z.enum(['distance', 'price_asc', 'price_desc', 'rating', 'popularity', 'newest', 'relevance']).optional(),
  page: z.string().transform(Number).pipe(z.number().positive()).optional(),
  limit: z.string().transform(Number).pipe(z.number().positive().max(100)).optional(),
});
