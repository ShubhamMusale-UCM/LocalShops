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
  if (uri.startsWith('file://') || uri.startsWith('content://') || uri.startsWith('http://') || uri.startsWith('https://')) {
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

export const productService = {
  search: (params: {
    q?: string; lat?: number; lng?: number; radius?: number;
    minPrice?: number; maxPrice?: number; category?: string;
    sort?: string; page?: number; limit?: number;
  }) => {
    const allowedSorts = new Set([
      'distance',
      'price_asc',
      'price_desc',
      'rating',
      'popularity',
      'newest',
      'relevance',
    ]);

    const sanitized: Record<string, any> = {};

    const query = typeof params.q === 'string' ? params.q.trim() : '';
    if (query) sanitized.q = query;

    if (typeof params.lat === 'number' && Number.isFinite(params.lat)) sanitized.lat = params.lat;
    if (typeof params.lng === 'number' && Number.isFinite(params.lng)) sanitized.lng = params.lng;
    if (typeof params.radius === 'number' && Number.isFinite(params.radius) && params.radius > 0) sanitized.radius = params.radius;
    if (typeof params.minPrice === 'number' && Number.isFinite(params.minPrice) && params.minPrice >= 0) sanitized.minPrice = params.minPrice;
    if (typeof params.maxPrice === 'number' && Number.isFinite(params.maxPrice) && params.maxPrice > 0) sanitized.maxPrice = params.maxPrice;

    if (typeof params.category === 'string' && params.category.trim()) sanitized.category = params.category.trim();
    if (typeof params.sort === 'string' && allowedSorts.has(params.sort)) sanitized.sort = params.sort;
    if (typeof params.page === 'number' && Number.isInteger(params.page) && params.page > 0) sanitized.page = params.page;

    const rawLimit = typeof params.limit === 'number' && Number.isFinite(params.limit)
      ? Math.trunc(params.limit)
      : 20;
    sanitized.limit = Math.min(Math.max(rawLimit, 1), 50);

    return api.get('/products/search', { params: sanitized });
  },

  getById: (id: string) => api.get(`/products/${id}`),

  compare: (id: string, lat?: number, lng?: number) =>
    api.get(`/products/${id}/compare`, { params: { lat, lng } }),

  getTrending: (lat: number, lng: number, radius?: number) => {
    const params: Record<string, number> = { lat, lng };
    if (typeof radius === 'number' && Number.isFinite(radius) && radius > 0) {
      params.radius = radius;
    }
    return api.get('/products/trending', { params });
  },

  uploadImages: async (imageUris: string[]) => {
    const token = getAuthToken();
    if (!token) {
      throw new Error('Unauthorized - missing auth token. Please login again.');
    }

    const uploadedUrls: string[] = [];
    const uploadEndpoint = `${API_BASE_URL}/products/upload-images`;

    console.log('[ProductService] Uploading', imageUris.length, 'images to', uploadEndpoint);

    for (let index = 0; index < imageUris.length; index += 1) {
      const originalUri = imageUris[index];
      const uri = getUploadUri(originalUri);
      const ext = getFileExtension(uri);
      const mime = inferMimeType(uri);

      const formData = new FormData();
      formData.append('images', {
        uri,
        name: `product-${Date.now()}-${index}.${ext}`,
        type: mime,
      } as any);

      console.log('[ProductService] Uploading image', `${index + 1}/${imageUris.length}`, 'uri:', uri);

      let response: Response;
      try {
        response = await fetch(uploadEndpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'ngrok-skip-browser-warning': '1',
          },
          body: formData,
        });
      } catch (networkError: any) {
        console.error('[ProductService] Upload network failure:', networkError?.message || networkError);
        throw new Error(`Network connectivity error: ${networkError?.message || 'Upload request failed'} . Check internet and ngrok tunnel.`);
      }

      const rawText = await response.text();
      let payload: any = null;
      try {
        payload = rawText ? JSON.parse(rawText) : null;
      } catch {
        payload = { raw: rawText };
      }

      if (!response.ok) {
        console.error('[ProductService] Upload HTTP failure:', response.status, payload);
        if (response.status === 401) {
          throw new Error('Unauthorized - login expired. Please login again.');
        }
        if (response.status === 403) {
          throw new Error('Forbidden - you do not have permission to upload images.');
        }
        throw new Error(payload?.error || `Image upload failed with status ${response.status}`);
      }

      const currentBatch = Array.isArray(payload?.images) ? payload.images : [];
      if (!currentBatch.length) {
        throw new Error('Image upload failed - server did not return image URL.');
      }

      uploadedUrls.push(...currentBatch);
    }

    console.log('[ProductService] Upload successful. Uploaded URLs:', uploadedUrls.length);
    return {
      data: {
        images: uploadedUrls,
      },
    };
  },

  create: (shopId: string, data: any) => api.post(`/products/shop/${shopId}`, data),

  update: (id: string, data: any) => api.put(`/products/${id}`, data),

  bulkUpdateProducts: (shopId: string, updates: {id: string, price?: number, mrp?: number, quantity?: number, inStock?: boolean}[]) => 
    api.put(`/products/shop/${shopId}/bulk-update`, { updates }),

  delete: (id: string) => api.delete(`/products/${id}`),
};

export default productService;
