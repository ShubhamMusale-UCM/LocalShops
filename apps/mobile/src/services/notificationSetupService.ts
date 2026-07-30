import { Platform, Linking } from 'react-native';
import * as Notifications from 'expo-notifications';
import { notificationService } from './orderService';
import { useNotificationStore } from '../store/notificationStore';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const ensureAndroidChannel = async () => {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync('citylocalshop', {
    name: 'CityLocalShop Notifications',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#FF6B35',
  });
};

export const registerPushToken = async (): Promise<string | null> => {
  try {
    await ensureAndroidChannel();

    const permission = await Notifications.getPermissionsAsync();
    let finalStatus = permission.status;

    if (finalStatus !== 'granted') {
      const requested = await Notifications.requestPermissionsAsync();
      finalStatus = requested.status;
    }

    if (finalStatus !== 'granted') {
      return null;
    }

    const deviceToken = await Notifications.getDevicePushTokenAsync();
    const token = typeof deviceToken.data === 'string' ? deviceToken.data : null;

    if (!token) {
      return null;
    }

    await notificationService.registerToken(token);
    return token;
  } catch {
    return null;
  }
};

export const setupNotificationListeners = () => {
  const receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
    const content = notification.request.content;
    useNotificationStore.getState().addNotification({
      id: notification.request.identifier,
      title: content.title || 'Notification',
      body: content.body || '',
      type: String(content.data?.type || 'SYSTEM'),
      data: content.data,
      isRead: false,
      createdAt: new Date().toISOString(),
    });
  });

  const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const content = response.notification.request.content;
    useNotificationStore.getState().addNotification({
      id: response.notification.request.identifier,
      title: content.title || 'Notification',
      body: content.body || '',
      type: String(content.data?.type || 'SYSTEM'),
      data: content.data,
      isRead: false,
      createdAt: new Date().toISOString(),
    });
    
    // Handle deep linking for tapped notifications
    if (content.data?.actionUrl) {
      const url = `citylocalshop://${String(content.data.actionUrl).replace(/^\//, '')}`;
      Linking.openURL(url).catch((err: unknown) => console.error('Failed to open deep link', err));
    }
  });

  return () => {
    receivedSubscription.remove();
    responseSubscription.remove();
  };
};
