import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { MMKV } from 'react-native-mmkv';
import authService from '../services/authService';
import { setAuthToken, setRefreshHandler } from '../services/api';
import { useWishlistStore } from './wishlistStore';
import { clearPrimarySellerShopCache } from '../services/sellerShopContext';

const storage = new MMKV();
const zustandStorage = {
  setItem: (name: string, value: string) => storage.set(name, value),
  getItem: (name: string) => storage.getString(name) ?? null,
  removeItem: (name: string) => storage.delete(name),
};

interface User {
  id: string;
  phone: string;
  name: string;
  role: string;
  email?: string;
  avatar?: string;
  referralCode?: string;
  city?: string;
}

export type AppRole = 'BUYER' | 'SELLER' | 'DELIVERY_PARTNER' | 'ADMIN';

interface AuthState {
  user: User | null;
  activeRole: AppRole | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isGuest: boolean;
  isLoading: boolean;
  _hasHydrated: boolean;

  setHasHydrated: (state: boolean) => void;
  setUser: (user: User) => void;
  setTokens: (access: string, refresh: string) => void;
  login: (user: User, accessToken: string, refreshToken: string) => void;
  logout: () => void;
  continueAsGuest: () => void;
  switchRole: (role: AppRole) => void;
  updateUser: (data: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      activeRole: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isGuest: false,
      isLoading: false,
      _hasHydrated: false,

      setHasHydrated: (state) => set({ _hasHydrated: state }),

      setUser: (user) => set({ user, activeRole: user.role as AppRole }),

      setTokens: (accessToken, refreshToken) => {
        setAuthToken(accessToken);
        set({ accessToken, refreshToken });
      },

      login: (user, accessToken, refreshToken) => {
        setAuthToken(accessToken);
        set({
          user,
          activeRole: (user.role as AppRole) || 'BUYER',
          accessToken,
          refreshToken,
          isAuthenticated: true,
          isGuest: false,
        });
        
        // Sync wishlist
        useWishlistStore.getState().syncWithBackend();
      },

      logout: () => {
        setAuthToken(null);
        clearPrimarySellerShopCache();
        set({
          user: null,
          activeRole: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          isGuest: false,
        });
        
        // Clear local wishlist
        useWishlistStore.getState().clearWishlist();
      },

      continueAsGuest: () => {
        set({ isGuest: true });
      },

      switchRole: (role) => {
        const user = get().user;
        if (!user) return;

        if (user.role === 'SELLER' && (role === 'BUYER' || role === 'SELLER')) {
          set({ activeRole: role });
          return;
        }

        if (role === (user.role as AppRole)) {
          set({ activeRole: role });
        }
      },

      updateUser: (data) => {
        const current = get().user;
        if (current) {
          const updated = { ...current, ...data };
          set({ user: updated });
        }
      },
    }),
    {
      name: 'auth-store',
      storage: createJSONStorage(() => zustandStorage),
      version: 1,
      partialize: (state) => ({
        user: state.user,
        activeRole: state.activeRole,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
        isGuest: state.isGuest,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
        setAuthToken(state?.accessToken || null);
        
        // Sync wishlist on app load if authenticated
        if (state?.isAuthenticated) {
          useWishlistStore.getState().syncWithBackend();
        }
      },
    }
  )
);

let refreshInFlight: Promise<void> | null = null;

setRefreshHandler(async () => {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = (async () => {
    const { refreshToken, logout, setTokens } = useAuthStore.getState();

    if (!refreshToken) {
      logout();
      throw new Error('Missing refresh token.');
    }

    try {
      const response = await authService.refreshToken(refreshToken);
      const nextAccessToken = response.data?.accessToken as string | undefined;
      const nextRefreshToken = (response.data?.refreshToken as string | undefined) || refreshToken;

      if (!nextAccessToken) {
        throw new Error('Invalid refresh response.');
      }

      setTokens(nextAccessToken, nextRefreshToken);
    } catch (error) {
      logout();
      throw error;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
});
