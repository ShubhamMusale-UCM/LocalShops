import api from './api';

export const authService = {
  sendOTP: (phone: string) =>
    api.post('/auth/send-otp', { phone }),

  verifyOTP: (phone: string, otp: string) =>
    api.post('/auth/verify-otp', { phone, otp }),

  register: (data: { phone: string; name: string; role?: string; email?: string; referralCode?: string; idToken: string }) =>
    api.post('/auth/register', data),

  refreshToken: (refreshToken: string) =>
    api.post('/auth/refresh-token', { refreshToken }),
};

export default authService;
