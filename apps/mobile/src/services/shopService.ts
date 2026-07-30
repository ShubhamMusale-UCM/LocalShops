import api from './api';
import { API_BASE_URL } from '../utils/constants';
import { getAuthToken } from './api';

const inferMimeType = (uri: string): string => {
  const normalized = uri.toLowerCase();
  if (normalized.endsWith('.png')) return 'image/png';
  if (normalized.endsWith('.webp')) return 'image/webp';
  if (normalized.endsWith('.heic')) return 'image/heic';
  if (normalized.endsWith('.gif')) return 'image/gif';
  return 'image/jpeg';
};

const getUploadUri = (uri: string): string => {
  if (
    uri.startsWith('file://') ||
    uri.startsWith('content://') ||
    uri.startsWith('http://') ||
    uri.startsWith('https://')
  ) {
    return uri;
  }
  return `file://${uri}`;
};

const getFileExtension = (uri: string): string => {
  const safeUri = uri.split('?')[0];
  if (!safeUri.includes('.')) return 'jpg';
  const ext = safeUri.substring(safeUri.lastIndexOf('.') + 1).toLowerCase();
  return ext || 'jpg';
};

export const shopService = {
  getNearby: (params: { lat: number; lng: number; radius?: number; category?: string; page?: number; sort?: string; limit?: number }) =>
    api.get('/shops/nearby', { params }),

  getById: (id: string) => api.get(`/shops/${id}`),

  getBySlug: (slug: string) => api.get(`/shops/slug/${slug}`),

  create: (data: any) => api.post('/shops', data),

  update: (id: string, data: any) => api.put(`/shops/${id}`, data),

  getMyShops: () => api.get('/shops/me/shops'),

  getProducts: (shopId: string, params?: { category?: string; sort?: string; page?: number }) =>
    api.get(`/products/shop/${shopId}`, { params }),

  uploadImage: async (imageUri: string) => {
    const token = getAuthToken();
    if (!token) {
      throw new Error('Unauthorized - missing auth token. Please login again.');
    }

    const uri = getUploadUri(imageUri);
    const ext = getFileExtension(uri);
    const mime = inferMimeType(uri);
    const endpoint = `${API_BASE_URL}/shops/upload-image`;

    const formData = new FormData();
    formData.append('image', {
      uri,
      name: `shop-image-${Date.now()}.${ext}`,
      type: mime,
    } as any);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'ngrok-skip-browser-warning': '1',
      },
      body: formData,
    });

    const rawText = await response.text();
    let payload: any = null;
    try {
      payload = rawText ? JSON.parse(rawText) : null;
    } catch {
      payload = { raw: rawText };
    }

    if (!response.ok) {
      throw new Error(payload?.error || `Shop image upload failed with status ${response.status}`);
    }

    if (!payload?.image) {
      throw new Error('Shop image upload failed - server did not return image URL.');
    }

    return payload.image as string;
  },

  getAnalytics: (shopId: string, days?: number) =>
    api.get(`/shops/${shopId}/analytics`, { params: { days } }),

  toggleSave: (shopId: string) => api.post(`/shops/${shopId}/save`),

  getSaved: () => api.get('/shops/me/saved'),
};

export default shopService;
