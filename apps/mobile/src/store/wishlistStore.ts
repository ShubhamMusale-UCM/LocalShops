import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      items: [],
      toggleItem: (item) => {
        const exists = get().items.some((entry) => entry.productId === item.productId);
        if (exists) {
          set({ items: get().items.filter((entry) => entry.productId !== item.productId) });
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
      },
      removeItem: (productId) => {
        set({ items: get().items.filter((entry) => entry.productId !== productId) });
      },
      isWishlisted: (productId) => get().items.some((entry) => entry.productId === productId),
      clearWishlist: () => set({ items: [] }),
    }),
    {
      name: 'citylocalshop-wishlist',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

export default useWishlistStore;
