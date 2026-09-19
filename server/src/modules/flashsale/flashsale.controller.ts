import { Request, Response, NextFunction } from "express";
import { AuthRequest } from "../../middleware/auth.middleware";
import { AppError } from "../../middleware/errorHandler.middleware";
import prisma from "../../config/database";
import flashSaleService from "./flashsale.service";

export const FlashSaleController = {
  // POST /flash-sales  (seller)
  createFlashSale: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { shopId, productId, discount, startTime, endTime } = req.body;
      if (!shopId || !productId || discount == null || !startTime || !endTime)
        throw new AppError("Missing required fields", 400);

      const shop = await prisma.shop.findUnique({ where: { id: shopId } });
      if (!shop || shop.ownerId !== req.user!.id) throw new AppError("Unauthorized", 403);

      const sale = await flashSaleService.createFlashSale(
        shopId, productId, Number(discount), new Date(startTime), new Date(endTime)
      );
      res.status(201).json({ status: "success", data: sale });
    } catch (e) { next(e); }
  },

  // GET /flash-sales/shop/:shopId  (seller)
  getShopFlashSales: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { shopId } = req.params;
      const shop = await prisma.shop.findUnique({ where: { id: shopId } });
      if (!shop || shop.ownerId !== req.user!.id) throw new AppError("Unauthorized", 403);
      const sales = await flashSaleService.getShopFlashSales(shopId);
      res.json({ status: "success", data: sales });
    } catch (e) { next(e); }
  },

  // POST /flash-sales/:saleId/end  (seller)
  endFlashSale: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { saleId } = req.params;
      const { shopId } = req.body;
      if (!shopId) throw new AppError("shopId required", 400);
      const shop = await prisma.shop.findUnique({ where: { id: shopId } });
      if (!shop || shop.ownerId !== req.user!.id) throw new AppError("Unauthorized", 403);
      const sale = await flashSaleService.endFlashSale(shopId, saleId);
      res.json({ status: "success", data: sale });
    } catch (e) { next(e); }
  },

  // GET /flash-sales/live  (public — buyer)
  getLiveFlashSales: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      const sales = await flashSaleService.getLiveFlashSales(limit);
      res.json({ status: "success", data: sales });
    } catch (e) { next(e); }
  },
};

export default FlashSaleController;
