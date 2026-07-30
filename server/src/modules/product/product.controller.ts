import { Request, Response } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';
import productService from './product.service';
import { createProductSchema, updateProductSchema, productSearchSchema } from './product.validator';
import { processAndUploadImage } from '../../utils/imageProcessor';

export class ProductController {
  async uploadProductImages(req: AuthRequest, res: Response): Promise<void> {
    try {
      const files = (req.files as Express.Multer.File[]) || [];
      if (!files.length) {
        res.status(400).json({ error: 'At least one image is required.' });
        return;
      }

      const protocol = req.protocol || 'http';
      const host = req.get('host') || 'localhost:5000';
      const publicBaseUrl = `${protocol}://${host}`;

      const uploaded = await Promise.all(
        files.map(async (file) => {
          const processed = await processAndUploadImage(file.buffer, 'products', false, publicBaseUrl, file.mimetype);
          return processed.full;
        })
      );

      res.status(201).json({ images: uploaded });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ error: error.message || 'Image upload failed.' });
    }
  }

  async createProduct(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { shopId } = req.params;
      const validated = createProductSchema.parse(req.body);
      const product = await productService.createProduct(shopId, req.user!.id, validated);
      res.status(201).json(product);
    } catch (error: any) {
      const statusCode = error.statusCode || 400;
      const errorMessage = error.message || 'Failed to create product';
      const details = error.issues || error.errors; // Zod uses 'issues', custom errors might use 'errors'
      res.status(statusCode).json({ error: errorMessage, details });
    }
  }

  async getProduct(req: Request, res: Response): Promise<void> {
    try {
      const product = await productService.getProductById(req.params.id);
      res.json(product);
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  }

  async searchProducts(req: Request, res: Response): Promise<void> {
    try {
      const params = productSearchSchema.parse(req.query);
      const result = await productService.search({
        query: params.q,
        latitude: params.lat,
        longitude: params.lng,
        radius: params.radius,
        minPrice: params.minPrice,
        maxPrice: params.maxPrice,
        category: params.category,
        subCategory: params.subCategory,
        brand: params.brand,
        inStock: params.inStock,
        sort: params.sort,
        page: params.page,
        limit: params.limit,
      });
      res.json(result);
    } catch (error: any) {
      const statusCode = error.statusCode || 400;
      const errorMessage = error.message || 'Failed to search products';
      const details = error.issues || error.errors;
      res.status(statusCode).json({ error: errorMessage, details });
    }
  }

  async compareProducts(req: Request, res: Response): Promise<void> {
    try {
      const lat = parseFloat(req.query.lat as string);
      const lng = parseFloat(req.query.lng as string);
      const products = await productService.compareProducts(
        req.params.id,
        isNaN(lat) ? undefined : lat,
        isNaN(lng) ? undefined : lng
      );
      res.json(products);
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  }

  async updateProduct(req: AuthRequest, res: Response): Promise<void> {
    try {
      const validated = updateProductSchema.parse(req.body);
      const product = await productService.updateProduct(req.params.id, req.user!.id, validated);
      res.json(product);
    } catch (error: any) {
      const statusCode = error.statusCode || 400;
      const errorMessage = error.message || 'Failed to update product';
      const details = error.issues || error.errors;
      res.status(statusCode).json({ error: errorMessage, details });
    }
  }

  async deleteProduct(req: AuthRequest, res: Response): Promise<void> {
    try {
      const result = await productService.deleteProduct(req.params.id, req.user!.id);
      res.json(result);
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  }

  async getShopProducts(req: Request, res: Response): Promise<void> {
    try {
      const { shopId } = req.params;
      const { category, sort, page, limit } = req.query;
      const result = await productService.getShopProducts(shopId, {
        category: category as string,
        sort: sort as string,
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
      });
      res.json(result);
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  }

  async getTrending(req: Request, res: Response): Promise<void> {
    try {
      const lat = parseFloat(req.query.lat as string);
      const lng = parseFloat(req.query.lng as string);
      const radius = req.query.radius ? parseFloat(req.query.radius as string) : 50;
      if (isNaN(lat) || isNaN(lng)) {
        res.status(400).json({ error: 'lat and lng query parameters required.' });
        return;
      }
      const result = await productService.getTrendingNearby(lat, lng, radius);
      res.json(result);
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  }
}

export default new ProductController();
