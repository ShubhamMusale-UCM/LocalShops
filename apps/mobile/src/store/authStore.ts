import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import authService from '../services/authService';
import { setAuthToken, setRefreshHandler } from '../services/api';

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
  isLoading: boolean;

  setUser: (user: User) => void;
  setTokens: (access: string, refresh: string) => void;
  login: (user: User, accessToken: string, refreshToken: string) => void;
  logout: () => void;
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
      isLoading: false,

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
        });
      },

      logout: () => {
        setAuthToken(null);
        set({
          user: null,
          activeRole: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        });
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
          set({ user: updated, activeRole: updated.role as AppRole });
        }
      },
    }),
    {
      name: 'auth-store',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      partialize: (state) => ({
        user: state.user,
        activeRole: state.activeRole,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        setAuthToken(state?.accessToken || null);
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
