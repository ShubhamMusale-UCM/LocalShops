import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { setAuthToken } from '../services/api';

/**
 * Hook to initialize auth state when app starts.
 * This ensures that persisted auth tokens are restored to the API interceptor.
 */
export const useAuthInit = () => {
  const [isHydrated, setIsHydrated] = useState(
    useAuthStore.persist?.hasHydrated?.() ?? true
  );
  const accessToken = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    const unsubscribe = useAuthStore.persist?.onFinishHydration?.((state) => {
      setAuthToken(state?.accessToken || null);
      setIsHydrated(true);
    });

    if (useAuthStore.persist?.hasHydrated?.()) {
      setIsHydrated(true);
    }

    return () => {
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    setAuthToken(accessToken || null);
  }, [accessToken]);

  return isHydrated;
};
