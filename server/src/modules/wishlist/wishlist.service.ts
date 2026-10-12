import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler.middleware';

class WishlistService {
  async getWishlist(userId: string) {
    const items = await prisma.wishlist.findMany({
      where: { userId },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            price: true,
            images: true,
            shop: { select: { name: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    return items
      .filter(item => Boolean(item.product))
      .map(item => ({
        id: item.id,
        productId: item.productId,
        name: item.product.name,
        price: item.product.price,
        image: item.product.images?.[0] || null,
        shopName: item.product.shop?.name || '',
        addedAt: item.createdAt
      }));
  }

  async toggleWishlist(userId: string, productId: string) {
    const existing = await prisma.wishlist.findUnique({
      where: {
        userId_productId: {
          userId,
          productId
        }
      }
    });

    if (existing) {
      await prisma.wishlist.delete({
        where: { id: existing.id }
      });
      return { isWishlisted: false };
    } else {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { id: true, isActive: true },
      });

      if (!product) {
        throw new AppError('Product not found', 404);
      }

      await prisma.wishlist.create({
        data: {
          userId,
          productId
        }
      });
      return { isWishlisted: true };
    }
  }

  async clearWishlist(userId: string) {
    await prisma.wishlist.deleteMany({
      where: { userId }
    });
    return { success: true };
  }
}

export default new WishlistService();
