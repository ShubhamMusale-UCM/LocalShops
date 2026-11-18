import { Request, Response } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';
import shopService from './shop.service';
import { createShopSchema, updateShopSchema, nearbyShopsSchema } from './shop.validator';
import { processAndUploadImage } from '../../utils/imageProcessor';
import { ShopMemberService } from './shopMember.service';

const shopMemberService = new ShopMemberService();

export class ShopController {
  async uploadShopImage(req: AuthRequest, res: Response): Promise<void> {
    try {
      const file = req.file as Express.Multer.File | undefined;
      if (!file) {
        res.status(400).json({ error: 'Shop image is required.' });
        return;
      }

      const protocol = req.protocol || 'http';
      const host = req.get('host') || 'localhost:5000';
      const publicBaseUrl = `${protocol}://${host}`;

      const processed = await processAndUploadImage(
        file.buffer,
        'shops',
        false,
        publicBaseUrl,
        file.mimetype
      );

      res.status(201).json({ image: processed.full, thumbnail: processed.thumbnail });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ error: error.message || 'Shop image upload failed.' });
    }
  }

  async createShop(req: AuthRequest, res: Response): Promise<void> {
    try {
      const validated = createShopSchema.parse(req.body);
      const shop = await shopService.createShop(req.user!.id, validated);
      res.status(201).json(shop);
    } catch (error: any) {
      res.status(error.statusCode || 400).json({ error: error.message, details: error.errors });
    }
  }

  async getShopById(req: Request, res: Response): Promise<void> {
    try {
      const shop = await shopService.getShopById(req.params.id);
      res.json(shop);
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  }

  async getShopBySlug(req: Request, res: Response): Promise<void> {
    try {
      const shop = await shopService.getShopBySlug(req.params.slug);
      res.json(shop);
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  }

  async searchShops(req: Request, res: Response): Promise<void> {
    try {
      const q = req.query.q as string || '';
      const shops = await shopService.searchShops(q);
      res.json({ data: shops });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  }

  async getNearbyShops(req: Request, res: Response): Promise<void> {
    try {
      const params = nearbyShopsSchema.parse(req.query);
      const result = await shopService.getNearbyShops({
        latitude: params.lat,
        longitude: params.lng,
        radius: params.radius,
        category: params.category,
        page: params.page,
        limit: params.limit,
        sort: params.sort,
      });
      res.json(result);
    } catch (error: any) {
      res.status(error.statusCode || 400).json({ error: error.message, details: error.errors });
    }
  }

  async updateShop(req: AuthRequest, res: Response): Promise<void> {
    try {
      const validated = updateShopSchema.parse(req.body);
      const shop = await shopService.updateShop(req.params.id, req.user!.id, validated);
      res.json(shop);
    } catch (error: any) {
      res.status(error.statusCode || 400).json({ error: error.message });
    }
  }

  async getMyShops(req: AuthRequest, res: Response): Promise<void> {
    try {
      const shops = await shopService.getMyShops(req.user!.id);
      res.json(shops);
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  }

  async toggleSaveShop(req: AuthRequest, res: Response): Promise<void> {
    try {
      const result = await shopService.toggleSaveShop(req.user!.id, req.params.id);
      res.json(result);
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  }

  async getSavedShops(req: AuthRequest, res: Response): Promise<void> {
    try {
      const shops = await shopService.getSavedShops(req.user!.id);
      res.json(shops);
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  }

  async getAnalytics(req: AuthRequest, res: Response): Promise<void> {
    try {
      const rawDays = parseInt(req.query.days as string, 10);
      const days = Number.isFinite(rawDays) ? Math.min(365, Math.max(1, rawDays)) : 30;
      const data = await shopService.getShopAnalytics(req.params.id, req.user!.id, days);
      res.json(data);
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  }

  async getShopFollowers(req: AuthRequest, res: Response): Promise<void> {
    try {
      // Need to verify shop ownership
      const shops = await shopService.getMyShops(req.user!.id);
      if (!shops.find(s => s.id === req.params.id)) {
        res.status(403).json({ error: 'Unauthorized to view this shop followers' });
        return;
      }
      const followers = await shopService.getShopFollowers(req.params.id);
      res.json({ status: 'success', data: followers });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  }

  async broadcastToFollowers(req: AuthRequest, res: Response): Promise<void> {
    try {
      // Need to verify shop ownership
      const shops = await shopService.getMyShops(req.user!.id);
      if (!shops.find(s => s.id === req.params.id)) {
        res.status(403).json({ error: 'Unauthorized to broadcast for this shop' });
        return;
      }
      
      const { title, body, type, city, corridor, productId, imageUrl } = req.body;
      if (!title || !body || !type) {
        res.status(400).json({ error: 'Missing required fields' });
        return;
      }

      const result = await shopService.broadcastToFollowers(req.params.id, {
        title,
        body,
        type,
        city,
        corridor,
        productId,
        imageUrl,
      });
      res.json({ status: 'success', data: result });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  }

  async logShopIntent(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { type, deviceId } = req.body;
      if (!['call', 'whatsapp', 'direction'].includes(type)) {
        res.status(400).json({ error: 'Invalid intent type. Expected call, whatsapp, or direction.' });
        return;
      }
      const userOrDevice = (req as any).user?.id || deviceId || req.ip || 'anon';
      await shopService.logShopIntent(id, type, userOrDevice);
      res.json({ success: true });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  }

  async getShopSettings(req: AuthRequest, res: Response): Promise<void> {
    try {
      const result = await shopService.getPrivateShopSettings(req.params.id, req.user!.id, req.user!.role);
      res.json(result);
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  }

  async getAuditLogs(req: AuthRequest, res: Response): Promise<void> {
    try {
      const logs = await shopService.getShopAuditLogs(req.params.id, req.user!.id);
      res.json({ logs });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  }

  async updateShopSettings(req: AuthRequest, res: Response): Promise<void> {
    try {
      const validated = updateShopSchema.parse(req.body);
      const updated = await shopService.updateShop(req.params.id, req.user!.id, validated);
      res.json(updated);
    } catch (error: any) {
      res.status(error.statusCode || 400).json({ error: error.message, details: error.errors });
    }
  }

  async getDailyDigest(req: AuthRequest, res: Response): Promise<void> {
    try {
      const digest = await shopService.getDailyDigestReport(req.params.id, req.user!.id);
      res.json(digest);
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  }

  async getCartAdders(req: AuthRequest, res: Response): Promise<void> {
    try {
      const result = await shopService.getShopCartAdders(req.params.id, req.user!.id);
      res.json({ status: 'success', data: result });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  }

  async sendCartDiscount(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { userId, productId, cartItemId, discountPercent, maxDiscount, validHours } = req.body;
      const result = await shopService.sendCartDiscountToAdders(req.params.id, req.user!.id, {
        userId,
        productId,
        cartItemId,
        discountPercent: Number(discountPercent) || 10,
        maxDiscount: maxDiscount ? Number(maxDiscount) : undefined,
        validHours: validHours ? Number(validHours) : undefined,
      });
      res.json({ status: 'success', data: result });
    } catch (error: any) {
      res.status(error.statusCode || 400).json({ error: error.message });
    }
  }

  async getShopSlots(req: Request, res: Response): Promise<void> {
    try {
      const date = (req.query.date as string) || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      const slots = await shopService.getShopPickupSlots(req.params.id, date);
      res.json(slots);
    } catch (error: any) {
      res.status(error.statusCode || 400).json({ error: error.message });
    }
  }

  async getShopClosures(req: AuthRequest, res: Response): Promise<void> {
    try {
      const closures = await shopService.getShopClosures(req.params.id, req.user!.id);
      res.json(closures);
    } catch (error: any) {
      res.status(error.statusCode || 400).json({ error: error.message });
    }
  }

  async addShopClosure(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { date, reason } = req.body;
      const closure = await shopService.addShopClosure(req.params.id, req.user!.id, date, reason);
      res.status(201).json(closure);
    } catch (error: any) {
      res.status(error.statusCode || 400).json({ error: error.message });
    }
  }

  async deleteShopClosure(req: AuthRequest, res: Response): Promise<void> {
    try {
      const result = await shopService.deleteShopClosure(req.params.id, req.user!.id, req.params.date);
      res.json(result);
    } catch (error: any) {
      res.status(error.statusCode || 400).json({ error: error.message });
    }
  }

  async getShopMembers(req: AuthRequest, res: Response): Promise<void> {
    try {
      const roster = await shopMemberService.getMembers(req.params.id, req.user!.id);
      res.json(roster);
    } catch (error: any) {
      res.status(error.statusCode || 400).json({ error: error.message });
    }
  }

  async inviteShopMember(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { phone, name, role } = req.body;
      const member = await shopMemberService.inviteMember(req.params.id, req.user!.id, { phone, name, role });
      res.status(201).json({ message: 'Team member invited successfully', member });
    } catch (error: any) {
      res.status(error.statusCode || 400).json({ error: error.message });
    }
  }

  async updateMemberRole(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { role } = req.body;
      const member = await shopMemberService.updateRole(req.params.id, req.params.memberId, req.user!.id, role);
      res.json({ message: 'Member role updated', member });
    } catch (error: any) {
      res.status(error.statusCode || 400).json({ error: error.message });
    }
  }

  async removeShopMember(req: AuthRequest, res: Response): Promise<void> {
    try {
      await shopMemberService.removeMember(req.params.id, req.params.memberId, req.user!.id);
      res.json({ message: 'Team member removed' });
    } catch (error: any) {
      res.status(error.statusCode || 400).json({ error: error.message });
    }
  }
}

export default new ShopController();
