import { Request, Response } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';
import shopService from './shop.service';
import { createShopSchema, updateShopSchema, nearbyShopsSchema } from './shop.validator';
import { processAndUploadImage } from '../../utils/imageProcessor';

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
      const days = parseInt(req.query.days as string) || 30;
      const data = await shopService.getShopAnalytics(req.params.id, req.user!.id, days);
      res.json(data);
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  }
}

export default new ShopController();
