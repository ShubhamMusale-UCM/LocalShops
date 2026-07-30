import { Linking, Platform, Share, Alert } from 'react-native';

/**
 * Open Google Maps with directions
 */
export const openDirections = (latitude: number, longitude: number, label?: string) => {
  const url = Platform.select({
    ios: `maps:0,0?q=${label || 'Shop'}@${latitude},${longitude}`,
    android: `geo:0,0?q=${latitude},${longitude}(${label || 'Shop'})`,
    default: `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`,
  });
  Linking.openURL(url!);
};

/**
 * Open WhatsApp chat
 */
export const openWhatsApp = (phone: string, message?: string) => {
  const url = `whatsapp://send?phone=91${phone}${message ? `&text=${encodeURIComponent(message)}` : ''}`;
  Linking.openURL(url).catch(() => {
    Alert.alert('WhatsApp not installed', 'Please install WhatsApp to chat with this shop.');
  });
};

/**
 * Make a phone call
 */
export const makeCall = (phone: string) => {
  Linking.openURL(`tel:+91${phone}`);
};

/**
 * Share content
 */
export const shareContent = async (title: string, message: string, url?: string) => {
  try {
    await Share.share({ title, message: url ? `${message}\n${url}` : message });
  } catch { /* User cancelled */ }
};

/**
 * Truncate text with ellipsis
 */
export const truncate = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
};

/**
 * Generate initials from name
 */
export const getInitials = (name: string): string => {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
};

/**
 * Debounce function
 */
export const debounce = <T extends (...args: any[]) => any>(fn: T, delay: number) => {
  let timeoutId: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
};
