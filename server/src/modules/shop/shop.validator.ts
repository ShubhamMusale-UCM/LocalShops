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
  description: z.string().max(2000).optional(),
  phone: z.string().max(25).optional(),
  whatsapp: z.string().max(25).optional().nullable(),
  pincode: z.string().max(15).optional(),
  gstNumber: z
    .string()
    .max(30)
    .refine(
      (v) => !v || /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}$/i.test(v.trim()),
      'Invalid GSTIN format (15 alphanumeric characters, e.g. 29AAAAA0000A1Z5)'
    )
    .optional()
    .nullable(),
  razorpayAccountId: z.string().max(100).optional().nullable(),
  // Extended Compliance & Legal fields
  fssaiNumber: z
    .string()
    .max(30)
    .refine((v) => !v || /^\d{10,14}$/.test(v.trim()), 'Invalid FSSAI license number (10-14 digits)')
    .optional()
    .nullable(),
  panNumber: z
    .string()
    .max(20)
    .refine((v) => !v || /^[A-Z]{5}[0-9]{4}[A-Z]$/i.test(v.trim()), 'Invalid PAN format (e.g., ABCDE1234F)')
    .optional()
    .nullable(),
  legalEntityName: z.string().max(150).optional().nullable(),
  grievanceOfficerName: z.string().max(120).optional().nullable(),
  grievanceEmail: z.string().max(150).optional().nullable(),
  grievancePhone: z.string().max(25).optional().nullable(),
  // Extended Payout & Banking fields
  bankName: z.string().max(120).optional().nullable(),
  accountHolder: z.string().max(120).optional().nullable(),
  accountNumber: z
    .string()
    .max(40)
    .refine((v) => !v || /^\d{6,22}$/.test(v.trim()), 'Invalid bank account number (6-22 digits)')
    .optional()
    .nullable(),
  ifscCode: z
    .string()
    .max(20)
    .refine((v) => !v || /^[A-Z]{4}0[A-Z0-9]{6}$/i.test(v.trim()), 'Invalid IFSC code (e.g., HDFC0001234)')
    .optional()
    .nullable(),
  upiId: z
    .string()
    .max(100)
    .refine((v) => !v || /^[\w.-]+@[\w.-]+$/.test(v.trim()), 'Invalid UPI VPA format (e.g., store@okaxis)')
    .optional()
    .nullable(),
  // Extended Schedule & Booking Operations fields
  openingTime: z.string().max(20).optional().nullable(),
  closingTime: z.string().max(20).optional().nullable(),
  workingDays: z.union([z.string().max(100), z.array(z.string())]).optional().nullable(),
  orderAcceptanceStart: z.string().max(20).optional().nullable(),
  orderAcceptanceEnd: z.string().max(20).optional().nullable(),
  orderTimingType: z.enum(['always', 'store_hours', 'custom_window']).optional().nullable(),
  closedDates: z.union([z.array(z.string()), z.string()]).optional().nullable(),
  defaultBookingAmount: z.number().min(0).optional().nullable(),
  autoConfirmBookings: z.boolean().optional(),
  slotDuration: z.union([z.string().max(20), z.number()]).optional().nullable(),
  maxPerSlot: z.union([z.string().max(20), z.number()]).optional().nullable(),
  allowWalkIns: z.boolean().optional(),
  advanceNotice: z.union([z.string().max(20), z.number()]).optional().nullable(),
  // Extended Notification & Alert Toggles
  soundAlerts: z.boolean().optional(),
  bookingAlerts: z.boolean().optional(),
  dailyDigest: z.boolean().optional(),
  // Abandoned Cart Recovery Configuration
  abandonedCartRecoveryEnabled: z.boolean().optional(),
  abandonedCartDiscountPercent: z.number().min(1).max(50).optional().nullable(),
  abandonedCartHours: z.number().min(1).max(168).optional().nullable(),
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
