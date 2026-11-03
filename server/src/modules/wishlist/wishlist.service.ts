import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler.middleware';
import { haversineDistance } from '../../utils/geoUtils';

class WishlistService {
  async getWishlist(userId: string, lat?: number, lng?: number) {
    const items = await prisma.wishlist.findMany({
      where: { userId },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            price: true,
            images: true,
            shop: { select: { id: true, name: true, latitude: true, longitude: true, city: true, address: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    return items
      .filter(item => Boolean(item.product))
      .map(item => {
        const shop = item.product.shop;
        const dist = (lat != null && lng != null && shop?.latitude != null && shop?.longitude != null)
          ? Number(haversineDistance(lat, lng, shop.latitude, shop.longitude).toFixed(1))
          : null;
        return {
          id: item.id,
          productId: item.productId,
          name: item.product.name,
          price: item.product.price,
          image: item.product.images?.[0] || null,
          images: item.product.images || [],
          shopId: shop?.id || null,
          shopName: shop?.name || '',
          shopDistance_km: dist,
          distance_km: dist,
          addedAt: item.createdAt
        };
      });
  }

  async toggleWishlist(userId: string, productId: string) {
    let targetProductId = productId;

    // 1. Resolve if an ad campaign ID was provided instead of direct product ID
    const directProduct = await prisma.product.findUnique({
      where: { id: targetProductId },
      select: { id: true, isActive: true },
    });

    if (!directProduct) {
      const promoted = await prisma.promotedListing.findUnique({
        where: { id: targetProductId },
        select: { productId: true },
      });
      if (promoted?.productId) {
        targetProductId = promoted.productId;
      }
    }

    const existing = await prisma.wishlist.findUnique({
      where: {
        userId_productId: {
          userId,
          productId: targetProductId,
        }
      }
    });

    if (existing) {
      await prisma.wishlist.delete({
        where: { id: existing.id }
      });
      return { isWishlisted: false, productId: targetProductId };
    } else {
      const product = await prisma.product.findUnique({
        where: { id: targetProductId },
        select: { id: true, isActive: true },
      });

      if (!product) {
        // Handle mock, showcase, and offline catalog pieces without throwing 404
        const isMockOrShowcase =
          targetProductId.startsWith('mock-') ||
          targetProductId.startsWith('hero-') ||
          targetProductId.startsWith('sony-') ||
          targetProductId.startsWith('apple-') ||
          targetProductId.startsWith('bose-') ||
          targetProductId.startsWith('samsung-') ||
          targetProductId.length < 10;

        if (isMockOrShowcase) {
          return { isWishlisted: true, productId: targetProductId, isLocal: true };
        }

        throw new AppError('Product not found', 404);
      }

      await prisma.wishlist.create({
        data: {
          userId,
          productId: targetProductId,
        }
      });
      return { isWishlisted: true, productId: targetProductId };
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
