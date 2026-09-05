import axios from 'axios';
import axiosRetry from 'axios-retry';
import { API_BASE_URL } from '../utils/constants';

const API_DEBUG_LOGS = process.env.EXPO_PUBLIC_API_DEBUG === 'true';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'ngrok-skip-browser-warning': '1',
  },
});

if (API_DEBUG_LOGS) {
  console.log('[API] Initialized with BASE_URL:', API_BASE_URL);
}

// Add robust offline/retry logic for API mutations (and queries)
axiosRetry(api, {
  retries: 3, // number of retries
  retryDelay: (retryCount) => {
    return retryCount * 1000; // time interval between retries
  },
  retryCondition: (error) => {
    // Retry on network errors or 5xx status codes
    return axiosRetry.isNetworkOrIdempotentRequestError(error) || error.code === 'ECONNABORTED' || error.message === 'Network Error';
  },
});

const PUBLIC_NO_AUTH_PATHS = [
  '/auth/send-otp',
  '/auth/verify-otp',
  '/auth/register',
  '/health',
];

// Request interceptor — attach auth token
api.interceptors.request.use(
  (config) => {
    // For FormData, let RN/axios set multipart headers and boundary.
    if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
      if (config.headers) {
        delete (config.headers as any)['Content-Type'];
        delete (config.headers as any)['content-type'];
      }
    }

    // Token will be set by authStore
    const token = (api as any).__authToken;
    const requestUrl = String(config.url || '');
    const isPublicNoAuthPath = PUBLIC_NO_AUTH_PATHS.some((path) => requestUrl.includes(path));

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      if (API_DEBUG_LOGS) {
        console.log('[API] Request Token set:', token.substring(0, 20) + '...');
      }
    } else if (!isPublicNoAuthPath) {
      if (API_DEBUG_LOGS) {
        console.warn('[API] WARNING: No auth token set for request!', config.url);
      }
    }

    if (API_DEBUG_LOGS) {
      console.log('[API] Request URL:', config.url);
      console.log('[API] Request Method:', config.method?.toUpperCase());
    }
    
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor — handle errors globally
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const requestUrl = String(error.config?.url || '');
    const isRefreshRequest = requestUrl.includes('/auth/refresh-token');
    const statusCode = error.response?.status;

    if (statusCode === 429) {
      if (API_DEBUG_LOGS) {
        console.warn('[API] Rate limited request:', requestUrl);
      }
      return Promise.reject(error);
    }

    // Detailed error logging
    const errorDetails = {
      url: requestUrl,
      status: statusCode,
      statusText: error.response?.statusText,
      message: error.message,
      data: error.response?.data,
      code: error.code, // Network error code
    };

    if (API_DEBUG_LOGS) {
      console.error('[API] Request Error Details:', JSON.stringify(errorDetails, null, 2));
    }

    if (statusCode === 401 && !isRefreshRequest) {
      // Token expired — attempt refresh handled by authStore
      const refreshFn = (api as any).__refreshHandler;
      if (refreshFn) {
        try {
          await refreshFn();
          const newToken = (api as any).__authToken;
          if (newToken && error.config) {
            error.config.headers.Authorization = `Bearer ${newToken}`;
            return api.request(error.config);
          }
        } catch (refreshError) {
          return Promise.reject(refreshError);
        }
      }
    }
    return Promise.reject(error);
  }
);

export const setAuthToken = (token: string | null) => {
  (api as any).__authToken = token;
};

export const getAuthToken = (): string | null => {
  return (api as any).__authToken || null;
};

export const setRefreshHandler = (handler: () => Promise<void>) => {
  (api as any).__refreshHandler = handler;
};

export default api;
