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
import { socketService } from './src/services/socketService';
import { registerPushToken, setupNotificationListeners } from './src/services/notificationSetupService';
import * as SplashScreen from 'expo-splash-screen';
import { Asset } from 'expo-asset';
import { ReanimatedWarmup } from './src/components/ui/ReanimatedWarmup';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync().catch(() => {
  // Ignore error if splash screen is already hidden
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 30 * 1000, // 30 seconds
      gcTime: 5 * 60 * 1000, // 5 minutes
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
  const isAuthHydrated = useAuthStore((s) => s._hasHydrated);
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
  
  const [appIsReady, setAppIsReady] = React.useState(false);
  const [assetsLoaded, setAssetsLoaded] = React.useState(false);
  const [reanimatedWarmedUp, setReanimatedWarmedUp] = React.useState(false);

  // Preload local assets
  React.useEffect(() => {
    async function loadAssets() {
      try {
        await Asset.loadAsync([
          require('./assets/avatar.png'),
          require('./assets/products_icon.png'),
          require('./assets/shops_icon.png'),
          require('./assets/explore_icon.png'),
          require('./assets/cat_fruits_veggies.png'),
          require('./assets/cat_dairy_eggs.png'),
          require('./assets/cat_snacks_munchies.png'),
          require('./assets/cat_beverages.png'),
          require('./assets/cat_electronics.png'),
          require('./assets/deal_saver.png'),
          require('./assets/deal_lightning.png'),
          require('./assets/prod_milk.png'),
          require('./assets/prod_bread.png'),
          require('./assets/prod_bananas.png'),
          require('./assets/prod_apple.png'),
        ]);
      } catch (e) {
        console.warn('Asset loading error:', e);
      } finally {
        setAssetsLoaded(true);
      }
    }
    loadAssets();
  }, []);

  // Determine readiness
  React.useEffect(() => {
    if (fontsLoaded && isAuthHydrated && assetsLoaded && reanimatedWarmedUp) {
      setAppIsReady(true);
    }
  }, [fontsLoaded, isAuthHydrated, assetsLoaded, reanimatedWarmedUp]);

  // Hide splash screen
  React.useEffect(() => {
    if (appIsReady) {
      SplashScreen.hideAsync();
    }
  }, [appIsReady]);

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

  if (!appIsReady) {
    return (
      <View style={{ flex: 1 }}>
        <ReanimatedWarmup onWarmupComplete={() => setReanimatedWarmedUp(true)} />
      </View>
    );
  }
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            <StatusBar style="auto" translucent={true} backgroundColor="transparent" />
            <RootNavigator />
          </QueryClientProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

export default Sentry.wrap(App);
