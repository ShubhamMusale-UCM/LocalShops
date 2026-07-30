export interface Product {
  id: string;
  shopId: string;
  name: string;
  description: string;
  shortDescription?: string | null;

  // Pricing
  price: number;
  mrp?: number | null;
  discount?: number | null;

  // Media
  images: string[];
  video?: string | null;

  // Categorization
  category: string;
  subCategory?: string | null;
  tags: string[];
  brand?: string | null;

  // Inventory
  inStock: boolean;
  quantity?: number | null;
  unit?: string | null;

  // Stats
  viewCount: number;
  orderCount: number;
  averageRating: number;

  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;

  // Computed / joined fields
  shopName?: string;
  shopDistance_km?: number;
}

export interface ProductCreateInput {
  name: string;
  description: string;
  shortDescription?: string;
  price: number;
  mrp?: number;
  discount?: number;
  images: string[];
  video?: string;
  category: string;
  subCategory?: string;
  tags?: string[];
  brand?: string;
  quantity?: number;
  unit?: string;
}

export interface ProductUpdateInput extends Partial<ProductCreateInput> {
  inStock?: boolean;
  isActive?: boolean;
}

export interface ProductSearchQuery {
  q?: string;
  latitude?: number;
  longitude?: number;
  radius?: number;
  minPrice?: number;
  maxPrice?: number;
  category?: string;
  subCategory?: string;
  brand?: string;
  inStock?: boolean;
  sort?: 'distance' | 'price_asc' | 'price_desc' | 'rating' | 'popularity' | 'newest';
  page?: number;
  limit?: number;
}
