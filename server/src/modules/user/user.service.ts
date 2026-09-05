import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler.middleware';

export class UserService {
  async getUserById(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        shops: { where: { isActive: true }, select: { id: true, name: true, slug: true } },
        _count: { select: { orders: true, reviews: true, savedShops: true } },
        addressBook: true,
      },
    });
    if (!user) throw new AppError('User not found.', 404);
    return user;
  }

  async updateUser(userId: string, data: {
    name?: string; email?: string; avatar?: string;
    fcmToken?: string; latitude?: number; longitude?: number;
    address?: string; city?: string; pincode?: string;
  }) {
    return prisma.user.update({ where: { id: userId }, data });
  }

  async upgradeToSeller(userId: string) {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { role: 'SELLER' },
    });
    
    // Check if shop already exists
    const existingShop = await prisma.shop.findFirst({ where: { ownerId: userId } });
    if (!existingShop) {
       await prisma.shop.create({
          data: {
             ownerId: userId,
             name: user.name ? `${user.name}'s Shop` : 'My Store',
             slug: `shop-${userId}-${Date.now()}`,
             description: 'Welcome to my shop!',
             category: 'General',
             phone: user.phone || '0000000000',
             address: user.address || '123 Local Street',
             city: user.city || 'City',
             state: 'State',
             pincode: user.pincode || '000000',
             latitude: user.latitude || 0,
             longitude: user.longitude || 0,
             operatingHours: { "monday": "9 AM - 6 PM" }
          }
       });
    }

    return user;
  }

  async updateLocation(userId: string, latitude: number, longitude: number, address?: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { latitude, longitude, address },
    });
  }

  async getReferralInfo(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { referralCode: true },
    });
    if (!user) throw new AppError('User not found.', 404);

    const earnings = await prisma.referralEarning.findMany({
      where: { referrerId: userId },
      orderBy: { createdAt: 'desc' },
    });

    const totalEarnings = earnings.reduce((sum, e) => sum + e.amount, 0);
    const pendingEarnings = earnings.filter(e => !e.isPaid).reduce((sum, e) => sum + e.amount, 0);

    return {
      referralCode: user.referralCode,
      totalReferrals: earnings.length,
      totalEarnings,
      pendingEarnings,
      earnings,
    };
  }
  async createSupportTicket(userId: string, data: { subject: string; description: string; orderId?: string }) {
    return prisma.supportTicket.create({
      data: {
        userId,
        subject: data.subject,
        description: data.description,
        orderId: data.orderId,
      }
    });
  }

  async getSupportTickets(userId: string) {
    return prisma.supportTicket.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
  }
}

export default new UserService();
