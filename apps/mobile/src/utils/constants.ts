import Constants from 'expo-constants';

const productionApiBase = 'https://api.citylocalshop.com/api';

const getRuntimeHost = (): string => {
  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as any).manifest2?.debuggerHost ||
    (Constants as any).manifest?.debuggerHost ||
    '';

  if (!hostUri) return '';

  const host = hostUri
    .replace(/^https?:\/\//, '')
    .replace(/^exp:\/\//, '')
    .split(':')[0]
    .split('/')[0]
    .trim();

  return host;
};

const getDevApiBase = (): string => {
  const runtimeHost = getRuntimeHost();

  if (runtimeHost && runtimeHost !== 'localhost' && runtimeHost !== '127.0.0.1') {
    return `http://${runtimeHost}:5000/api`;
  }

  return 'http://10.0.2.2:5000/api';
};

const normalizeBaseUrl = (value?: string): string => {
  if (!value) return '';
  return value
    .trim()
    .replace(/^['\"]+|['\"]+$/g, '')
    .replace(/\/+$/, '');
};

const envApiBase = normalizeBaseUrl(process.env.EXPO_PUBLIC_API_BASE_URL);
const envSocketBase = normalizeBaseUrl(process.env.EXPO_PUBLIC_SOCKET_URL);

export const API_BASE_URL = envApiBase || (__DEV__
  ? getDevApiBase()
  : productionApiBase);

export const SOCKET_URL = envSocketBase || API_BASE_URL.replace(/\/api\/?$/, '');

export const DEFAULT_SEARCH_RADIUS = 5; // km
export const MAX_SEARCH_RADIUS = 25; // km
export const ITEMS_PER_PAGE = 20;
export const MAX_PRODUCT_IMAGES = 10;
export const OTP_LENGTH = 6;
export const OTP_RESEND_COOLDOWN = 60; // seconds

export const RAZORPAY_KEY = '';
export const GOOGLE_MAPS_API_KEY = '';

export const APP_STORE_URL = '';
export const PLAY_STORE_URL = '';

export const SUPPORT_PHONE = '+919876543210';
export const SUPPORT_EMAIL = 'support@citylocalshop.com';
export const SUPPORT_WHATSAPP = '919876543210';
