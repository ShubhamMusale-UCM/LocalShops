export type Category = 'all' | 'audio' | 'wearable' | 'design';

export interface Product {
  id: string;
  title: string;
  price: number;
  category: Category;
  image: string;
  images?: string[];
  shop?: {
    id?: string;
    name: string;
    avatar: string;
    logo?: string;
    rating: string;
    responseTime: string;
    location: string;
    description?: string;
    category?: string;
  };
  desc: string;
  badge?: string;
  badgeColor?: string;
  subtitle?: string;
  isBoosted?: boolean;
  campaignId?: string;
  variants?: any[];
}

export interface CartItem {
  id: string;
  title: string;
  price: number;
  qty: number;
  image: string;
  category?: Category;
  desc?: string;
  isBoosted?: boolean;
  campaignId?: string;
  shopId?: string;
  variantId?: string;
  variantName?: string;
}

export type AuthState = 'unauthenticated' | 'otp_verification' | 'register' | 'authenticated';
