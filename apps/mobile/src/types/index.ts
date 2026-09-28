export type Category = string;

export interface Product {
  id: string;
  title: string;
  price: number;
  category: Category;
  subCategory?: string;
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
  subCategory?: string;
  desc?: string;
  isBoosted?: boolean;
  campaignId?: string;
  shopId?: string;
  variantId?: string;
  variantName?: string;
}

export type AuthState = 'unauthenticated' | 'otp_verification' | 'register' | 'authenticated';
