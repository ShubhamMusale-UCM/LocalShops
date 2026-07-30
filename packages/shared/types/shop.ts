import { SubscriptionPlan } from './subscription';

export interface OperatingHours {
  [day: string]: { open: string; close: string; isClosed?: boolean };
}

export interface Shop {
  id: string;
  ownerId: string;
  name: string;
  slug: string;
  description: string;
  logo?: string | null;
  coverImage?: string | null;
  photos: string[];

  // Contact
  phone: string;
  whatsapp?: string | null;
  email?: string | null;
  website?: string | null;

  // Location
  address: string;
  landmark?: string | null;
  city: string;
  state: string;
  pincode: string;
  latitude: number;
  longitude: number;

  // Business Info
  category: string;
  subCategories: string[];
  gstNumber?: string | null;
  operatingHours: OperatingHours;
  isOpen: boolean;

  // Trust & Ratings
  trustScore: number;
  averageRating: number;
  totalReviews: number;
  totalOrders: number;
  isVerified: boolean;
  verifiedAt?: Date | null;

  // Subscription
  subscriptionPlan: SubscriptionPlan;
  subscriptionStart?: Date | null;
  subscriptionEnd?: Date | null;

  // Delivery
  deliveryEnabled: boolean;
  deliveryRadius?: number | null;
  minOrderDelivery?: number | null;

  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;

  // Computed (from geo queries)
  distance_km?: number;
}

export interface ShopCreateInput {
  name: string;
  description: string;
  phone: string;
  whatsapp?: string;
  email?: string;
  website?: string;
  address: string;
  landmark?: string;
  city: string;
  state: string;
  pincode: string;
  latitude: number;
  longitude: number;
  category: string;
  subCategories?: string[];
  gstNumber?: string;
  operatingHours: OperatingHours;
  logo?: string;
  coverImage?: string;
  photos?: string[];
}

export interface ShopUpdateInput extends Partial<ShopCreateInput> {
  isOpen?: boolean;
  deliveryEnabled?: boolean;
  deliveryRadius?: number;
  minOrderDelivery?: number;
}

export interface NearbyShopsQuery {
  latitude: number;
  longitude: number;
  radius?: number; // in km, default 5
  category?: string;
  page?: number;
  limit?: number;
  sort?: 'distance' | 'rating' | 'popularity' | 'newest';
}
