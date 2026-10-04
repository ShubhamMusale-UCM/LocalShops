import { z } from 'zod';

export const createOrderSchema = z.object({
  shopId: z.string().uuid(),
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().positive(),
    price: z.number().positive(),
    name: z.string(),
  })).min(1, 'At least one item required'),
  deliveryType: z.enum(['PICKUP', 'DELIVERY']),
  deliveryAddress: z.object({
    address: z.string().min(5),
    landmark: z.string().optional(),
    city: z.string(),
    pincode: z.string().regex(/^\d{6}$/),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }).optional(),
  paymentMethod: z.enum(['COD', 'ONLINE', 'UPI']),
  notes: z.string().max(500).optional(),
  couponCode: z.string().optional(),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum([
    'CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY',
    'DELIVERED', 'CANCELLED', 'REFUNDED',
  ]),
  note: z.string().max(500).optional(),
});

export const orderQuerySchema = z.object({
  status: z.enum([
    'PLACED', 'CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP',
    'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'REFUNDED',
  ]).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(50).optional(),
});
