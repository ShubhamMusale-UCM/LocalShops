import prisma from "../../config/database";
import { AppError } from "../../middleware/errorHandler.middleware";

export class FlashSaleService {
  async createFlashSale(shopId: string, productId: string, discount: number, startTime: Date, endTime: Date) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, shopId: true, isActive: true, price: true, name: true },
    });
    if (!product || product.shopId !== shopId) throw new AppError("Product not found for this shop", 404);
    if (!product.isActive) throw new AppError("Cannot create flash sale for an inactive product", 400);
    if (discount <= 0 || discount >= 100) throw new AppError("Discount must be between 1 and 99 percent", 400);
    if (endTime <= startTime) throw new AppError("End time must be after start time", 400);
    if (endTime <= new Date()) throw new AppError("End time must be in the future", 400);

    const existing = await prisma.flashSale.findFirst({
      where: { productId, isActive: true, endTime: { gt: new Date() } },
    });
    if (existing) throw new AppError("This product already has an active flash sale", 409);

    return prisma.flashSale.create({
      data: { shopId, productId, discount, startTime, endTime, isActive: true },
      include: { product: { select: { id: true, name: true, price: true, images: true } } },
    });
  }

  async getShopFlashSales(shopId: string) {
    const sales = await prisma.flashSale.findMany({
      where: { shopId },
      include: { product: { select: { id: true, name: true, price: true, images: true, isActive: true } } },
      orderBy: { createdAt: "desc" },
    });
    const now = new Date();
    return sales.map(s => ({
      ...s,
      isLive: s.isActive && s.startTime <= now && s.endTime >= now,
      isUpcoming: s.startTime > now,
      isEnded: s.endTime < now || !s.isActive,
      msRemaining: Math.max(0, s.endTime.getTime() - now.getTime()),
      discountedPrice: +(s.product.price * (1 - s.discount / 100)).toFixed(2),
    }));
  }

  async endFlashSale(shopId: string, saleId: string) {
    const sale = await prisma.flashSale.findUnique({ where: { id: saleId } });
    if (!sale || sale.shopId !== shopId) throw new AppError("Flash sale not found", 404);
    return prisma.flashSale.update({ where: { id: saleId }, data: { isActive: false } });
  }

  async getLiveFlashSales(limit = 20) {
    const now = new Date();
    const sales = await prisma.flashSale.findMany({
      where: { isActive: true, startTime: { lte: now }, endTime: { gte: now }, product: { isActive: true } },
      include: {
        product: { select: { id: true, name: true, price: true, images: true, category: true } },
        shop: { select: { id: true, name: true, logo: true } },
      },
      orderBy: { endTime: "asc" },
      take: limit,
    });
    return sales.map(s => ({
      ...s,
      msRemaining: Math.max(0, s.endTime.getTime() - now.getTime()),
      discountedPrice: +(s.product.price * (1 - s.discount / 100)).toFixed(2),
    }));
  }
}

export default new FlashSaleService();
