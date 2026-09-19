import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import FlashSaleController from "./flashsale.controller";

const router = Router();

// Public
router.get("/live", FlashSaleController.getLiveFlashSales);

// Seller-protected
router.use(authenticate);
router.post("/", FlashSaleController.createFlashSale);
router.get("/shop/:shopId", FlashSaleController.getShopFlashSales);
router.post("/:saleId/end", FlashSaleController.endFlashSale);

export default router;
