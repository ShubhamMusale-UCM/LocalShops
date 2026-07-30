import 'react-native-url-polyfill/auto';
import React from 'react';
import * as Sentry from '@sentry/react-native';
import { useFonts as usePoppins, Poppins_700Bold, Poppins_600SemiBold } from '@expo-google-fonts/poppins';
import { useFonts as useInter, Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Location from 'expo-location';
import { RootNavigator } from './src/navigation/RootNavigator';
import { ErrorBoundary } from './src/components/ui/ErrorBoundary';
import { useAuthStore } from './src/store/authStore';
import { useLocationStore } from './src/store/locationStore';
import { useAuthInit } from './src/hooks/useAuthInit';
import { socketService } from './src/services/socketService';
import { registerPushToken, setupNotificationListeners } from './src/services/notificationSetupService';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000,   // 10 minutes
    },
  },
});

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN || '',
  debug: process.env.NODE_ENV === 'development',
  tracesSampleRate: 1.0,
});

const App = () => {
  const enableSocket = process.env.EXPO_PUBLIC_ENABLE_SOCKET === 'true';
  const isAuthHydrated = useAuthInit(); // Initialize auth from persisted storage
  const [poppinsLoaded] = usePoppins({
    Poppins_700Bold,
    Poppins_600SemiBold,
  });
  const [interLoaded] = useInter({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });
  const fontsLoaded = poppinsLoaded && interLoaded;
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const setPermission = useLocationStore((s) => s.setPermission);
  const setLocation = useLocationStore((s) => s.setLocation);
  const setLoading = useLocationStore((s) => s.setLoading);

  React.useEffect(() => {
    if (!enableSocket || !accessToken) {
      socketService.disconnect();
      return;
    }

    socketService.connect(accessToken);

    return () => {
      socketService.disconnect();
    };
  }, [accessToken, enableSocket]);

  React.useEffect(() => {
    if (!accessToken) return;

    let cleanup: (() => void) | undefined;

    const bootstrapNotifications = async () => {
      await registerPushToken();
      cleanup = setupNotificationListeners();
    };

    bootstrapNotifications().catch(() => {
      // Keep app usable even if notification registration fails on this device.
    });

    return () => {
      cleanup?.();
    };
  }, [accessToken]);

  React.useEffect(() => {
    let watcher: Location.LocationSubscription | null = null;
    let mounted = true;

    const bootstrapLocation = async () => {
      setLoading(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      const granted = status === 'granted';
      setPermission(granted);

      if (!granted) {
        setLoading(false);
        return;
      }

      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (mounted) {
        setLocation(current.coords.latitude, current.coords.longitude);
      }

      watcher = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 10000,
          distanceInterval: 25,
        },
        (pos) => {
          setLocation(pos.coords.latitude, pos.coords.longitude);
        }
      );

      if (mounted) {
        setLoading(false);
      }
    };

    bootstrapLocation().catch(() => {
      setLoading(false);
    });

    return () => {
      mounted = false;
      watcher?.remove();
    };
  }, [setLoading, setLocation, setPermission]);

  if (!fontsLoaded || !isAuthHydrated) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            <StatusBar style="dark" translucent={true} backgroundColor="transparent" />
            <RootNavigator />
          </QueryClientProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

export default Sentry.wrap(App);
