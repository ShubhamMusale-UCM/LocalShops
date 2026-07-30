import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface LocationState {
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  city: string | null;
  pincode: string | null;
  permissionGranted: boolean;
  isLoading: boolean;
  setLocation: (lat: number, lng: number, address?: string, city?: string, pincode?: string) => void;
  setPermission: (granted: boolean) => void;
  setLoading: (loading: boolean) => void;
}

export const useLocationStore = create<LocationState>()(
  persist(
    (set) => ({
      latitude: null,
      longitude: null,
      address: null,
      city: null,
      pincode: null,
      permissionGranted: false,
      isLoading: false,
      setLocation: (latitude, longitude, address, city, pincode) =>
        set({
          latitude,
          longitude,
          address: address || null,
          city: city || null,
          pincode: pincode || null,
        }),
      setPermission: (permissionGranted) => set({ permissionGranted }),
      setLoading: (isLoading) => set({ isLoading }),
    }),
    {
      name: 'citylocalshop-location',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
