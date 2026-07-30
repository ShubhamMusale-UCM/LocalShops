import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler.middleware';

export class UserService {
  async getUserById(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        shops: { where: { isActive: true }, select: { id: true, name: true, slug: true } },
        _count: { select: { orders: true, reviews: true, savedShops: true } },
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
}

export default new UserService();
