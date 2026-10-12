import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { MMKV } from 'react-native-mmkv';
import api from '../services/api';

const storage = new MMKV({ id: 'wishlist-store' });
const mmkvStorage = {
  setItem: (name: string, value: string) => storage.set(name, value),
  getItem: (name: string) => storage.getString(name) ?? null,
  removeItem: (name: string) => storage.delete(name),
};

export interface WishlistItem {
  productId: string;
  name: string;
  price: number;
  image?: string;
  shopName?: string;
  addedAt: string;
}

interface WishlistState {
  items: WishlistItem[];
  toggleItem: (item: Omit<WishlistItem, 'addedAt'>) => void;
  removeItem: (productId: string) => void;
  isWishlisted: (productId: string) => boolean;
  clearWishlist: () => void;
  syncWithBackend: () => Promise<void>;
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      items: [],
      toggleItem: (item) => {
        const exists = get().items.some((entry) => entry.productId === item.productId);
        if (exists) {
          set({ items: get().items.filter((entry) => entry.productId !== item.productId) });
          api.post('/wishlist/toggle', { productId: item.productId }).catch(() => {});
          return;
        }

        set({
          items: [
            {
              ...item,
              addedAt: new Date().toISOString(),
            },
            ...get().items,
          ],
        });
        // Sync with backend
        api.post('/wishlist/toggle', { productId: item.productId }).catch(() => {});
      },
      removeItem: (productId) => {
        set({ items: get().items.filter((entry) => entry.productId !== productId) });
        api.post('/wishlist/toggle', { productId }).catch(() => {});
      },
      isWishlisted: (productId) => get().items.some((entry) => entry.productId === productId),
      clearWishlist: () => {
        set({ items: [] });
      },
      syncWithBackend: async () => {
        try {
          const res = await api.get('/wishlist');
          if (res.data?.data) {
            set({
              items: res.data.data.map((w: any) => ({
                productId: w.productId,
                name: w.name,
                price: w.price,
                image: w.image,
                shopName: w.shopName,
                addedAt: w.addedAt
              }))
            });
          }
        } catch (e) {
          console.log('Failed to sync wishlist with backend', e);
        }
      },
    }),
    {
      name: 'citylocalshop-wishlist',
      storage: createJSONStorage(() => mmkvStorage),
    }
  )
);

export default useWishlistStore;
