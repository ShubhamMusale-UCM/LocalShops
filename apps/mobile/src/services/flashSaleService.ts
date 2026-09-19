import api from './api';

export const flashSaleService = {
  getLiveFlashSales: (limit: number = 20) => api.get('/flash-sales/live', { params: { limit } }),

  getShopFlashSales: (shopId: string) => api.get(`/flash-sales/shop/${shopId}`),

  createFlashSale: (data: {
    shopId: string;
    productId: string;
    discount: number;
    startTime: string;
    endTime: string;
  }) => api.post('/flash-sales', data),

  endFlashSale: (saleId: string, shopId: string) => api.post(`/flash-sales/${saleId}/end`, { shopId }),
};

export default flashSaleService;
