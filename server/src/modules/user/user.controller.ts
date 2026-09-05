import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';
import userService from './user.service';

export class UserController {
  async getProfile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const user = await userService.getUserById(req.user!.id);
      res.json(user);
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  }

  async updateProfile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const user = await userService.updateUser(req.user!.id, req.body);
      res.json(user);
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  }

  async upgradeToSeller(req: AuthRequest, res: Response): Promise<void> {
    try {
      const user = await userService.upgradeToSeller(req.user!.id);
      res.json(user);
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  }

  async updateLocation(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { latitude, longitude, address } = req.body;
      if (!latitude || !longitude) {
        res.status(400).json({ error: 'Latitude and longitude are required.' });
        return;
      }
      const user = await userService.updateLocation(req.user!.id, latitude, longitude, address);
      res.json(user);
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  }

  async getReferrals(req: AuthRequest, res: Response): Promise<void> {
    try {
      const data = await userService.getReferralInfo(req.user!.id);
      res.json(data);
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  }
  async createSupportTicket(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { subject, description, orderId } = req.body;
      if (!subject || !description) {
        res.status(400).json({ error: 'Subject and description are required.' });
        return;
      }
      const ticket = await userService.createSupportTicket(req.user!.id, { subject, description, orderId });
      res.status(201).json(ticket);
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  }

  async getSupportTickets(req: AuthRequest, res: Response): Promise<void> {
    try {
      const tickets = await userService.getSupportTickets(req.user!.id);
      res.json(tickets);
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  }
}

export default new UserController();
