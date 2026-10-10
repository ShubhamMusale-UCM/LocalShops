import { Request, Response } from 'express';
import authService from './auth.service';

export class AuthController {
  async sendOTP(req: Request, res: Response): Promise<void> {
    try {
      const { phone } = req.body;

      if (!phone) {
        res.status(400).json({ error: 'Phone number is required.' });
        return;
      }

      const result = await authService.sendOTP(phone);
      res.status(result.success ? 200 : 400).json(result);
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  }

  async verifyOTP(req: Request, res: Response): Promise<void> {
    try {
      const { phone, otp } = req.body;

      if (!phone || !otp) {
        res.status(400).json({ error: 'Phone number and OTP are required.' });
        return;
      }

      const result = await authService.verifyOTP(phone, otp);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  }

    async register(req: Request, res: Response): Promise<void> {
    try {
      const { phone, name, role, email, referralCode, idToken, city, deviceId: bodyDeviceId } = req.body;
      const deviceId = bodyDeviceId || req.headers['x-device-id'] || req.ip || 'unknown';

      if (!phone || !name) {
        res.status(400).json({ error: 'Phone and name are required.' });
        return;
      }

      const result = await authService.register({ phone, name, role, email, referralCode, idToken, city, deviceId: deviceId as string });
      res.status(201).json(result);
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  }

  async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        res.status(400).json({ error: 'Refresh token is required.' });
        return;
      }

      const tokens = await authService.refreshToken(refreshToken);
      res.status(200).json(tokens);
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  }
}

export default new AuthController();
