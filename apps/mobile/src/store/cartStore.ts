import { create } from 'zustand';

export interface CartItem {
  productId: string;
  shopId: string;
  shopName: string;
  name: string;
  price: number;
  mrp?: number;
  image: string;
  quantity: number;
  unit?: string;
  inStock: boolean;
  campaignId?: string;
}

interface CartState {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'quantity'>) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  clearShopItems: (shopId: string) => void;
  getItemsByShop: () => Record<string, CartItem[]>;
  getTotal: () => number;
  getItemCount: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],

  addItem: (item) => {
    const items = get().items;
    const existing = items.find(i => i.productId === item.productId);
    if (existing) {
      set({
        items: items.map(i =>
          i.productId === item.productId ? { ...i, quantity: i.quantity + 1 } : i
        ),
      });
    } else {
      set({ items: [...items, { ...item, quantity: 1 }] });
    }
  },

  removeItem: (productId) => {
    set({ items: get().items.filter(i => i.productId !== productId) });
  },

  updateQuantity: (productId, quantity) => {
    if (quantity <= 0) {
      set({ items: get().items.filter(i => i.productId !== productId) });
    } else {
      set({
        items: get().items.map(i =>
          i.productId === productId ? { ...i, quantity } : i
        ),
      });
    }
  },

  clearCart: () => set({ items: [] }),

  clearShopItems: (shopId) => {
    set({ items: get().items.filter(i => i.shopId !== shopId) });
  },

  getItemsByShop: () => {
    return get().items.reduce((acc, item) => {
      if (!acc[item.shopId]) acc[item.shopId] = [];
      acc[item.shopId].push(item);
      return acc;
    }, {} as Record<string, CartItem[]>);
  },

  getTotal: () => {
    return get().items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  },

  getItemCount: () => {
    return get().items.reduce((sum, item) => sum + item.quantity, 0);
  },
}));
