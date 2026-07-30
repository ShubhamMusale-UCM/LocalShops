import api from './api';

export const orderService = {
  create: (data: any) => api.post('/orders', data),
  getMyOrders: (page?: number) => api.get('/orders', { params: { page } }),
  getShopOrders: (shopId: string, page?: number, status?: string) =>
    api.get(`/orders/shop/${shopId}`, { params: { page, status } }),
  getById: (id: string) => api.get(`/orders/${id}`),
  updateStatus: (id: string, status: string, note?: string) => api.put(`/orders/${id}/status`, { status, note }),
  cancel: (id: string, reason?: string) => api.post(`/orders/${id}/cancel`, { reason }),
};

export const reviewService = {
  create: (data: any) => api.post('/reviews', data),
  getByShop: (shopId: string, params?: any) => api.get(`/reviews/shop/${shopId}`, { params }),
  getByProduct: (productId: string) => api.get(`/reviews/product/${productId}`),
  markHelpful: (id: string) => api.post(`/reviews/${id}/helpful`),
  reply: (id: string, reply: string) => api.post(`/reviews/${id}/reply`, { reply }),
};

export const paymentService = {
  createOrder: (amount: number, orderId: string) => api.post('/payments/create-order', { amount, orderId }),
  verify: (data: any) => api.post('/payments/verify', data),
  subscribe: (shopId: string, plan: string) => api.post('/payments/subscription', { shopId, plan }),
};

export const locationService = {
  updateLocation: (latitude: number, longitude: number, address?: string) =>
    api.put('/users/location', { latitude, longitude, address }),
};

export const notificationService = {
  getAll: (page?: number) => api.get('/notifications', { params: { page } }),
  markRead: (id: string) => api.put(`/notifications/${id}/read`),
  registerToken: (fcmToken: string) => api.post('/notifications/register-token', { fcmToken }),
};
