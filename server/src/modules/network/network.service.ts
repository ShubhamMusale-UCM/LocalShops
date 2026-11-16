import prisma from '../../config/database';
import { ConnectionStatus } from '@prisma/client';
import { NotificationService } from '../notification/notification.service';

const notificationService = new NotificationService();

export class NetworkService {
  /**
   * Update shop merchant network opt-in status & business profile (SEL-9)
   */
  async updateNetworkProfile(
    shopId: string,
    ownerId: string,
    data: { networkOptIn: boolean; networkDescription?: string; networkCategory?: string }
  ) {
    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: { id: true, ownerId: true },
    });

    if (!shop) throw new Error('Shop not found');
    if (shop.ownerId !== ownerId) throw new Error('Unauthorized to update this shop');

    return prisma.shop.update({
      where: { id: shopId },
      data: {
        networkOptIn: data.networkOptIn,
        networkDescription: data.networkDescription?.trim() || null,
        networkCategory: data.networkCategory?.trim() || null,
      },
      select: {
        id: true,
        name: true,
        networkOptIn: true,
        networkDescription: true,
        networkCategory: true,
      },
    });
  }

  /**
   * Get opt-in merchant network directory with category filters.
   * PRIVACY GUARANTEE (SEL-9):
   * Contact details (phone, WhatsApp) are strictly redacted/omitted
   * unless a mutual connection with status 'ACCEPTED' exists!
   */
  async getDirectory(
    currentShopId?: string,
    filters?: { category?: string; query?: string; page?: number; limit?: number }
  ) {
    const page = Math.max(1, filters?.page || 1);
    const limit = Math.max(1, Math.min(50, filters?.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {
      networkOptIn: true,
      isActive: true,
    };

    if (currentShopId) {
      where.id = { not: currentShopId };
    }

    if (filters?.category) {
      where.networkCategory = { contains: filters.category, mode: 'insensitive' };
    }

    if (filters?.query) {
      where.OR = [
        { name: { contains: filters.query, mode: 'insensitive' } },
        { networkDescription: { contains: filters.query, mode: 'insensitive' } },
        { address: { contains: filters.query, mode: 'insensitive' } },
      ];
    }

    const [shops, total] = await Promise.all([
      prisma.shop.findMany({
        where,
        select: {
          id: true,
          name: true,
          address: true,
          logo: true,
          coverImage: true,
          networkCategory: true,
          networkDescription: true,
          isVerified: true,
          averageRating: true,
          totalReviews: true,
          createdAt: true,
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.shop.count({ where }),
    ]);

    // If currentShopId is provided, check existing connection states
    let connectionMap: Record<string, { status: ConnectionStatus; connectionId: string; isSender: boolean }> = {};
    if (currentShopId) {
      const connections = await prisma.merchantConnection.findMany({
        where: {
          OR: [
            { senderShopId: currentShopId },
            { receiverShopId: currentShopId },
          ],
        },
      });

      for (const c of connections) {
        const otherId = c.senderShopId === currentShopId ? c.receiverShopId : c.senderShopId;
        connectionMap[otherId] = {
          status: c.status,
          connectionId: c.id,
          isSender: c.senderShopId === currentShopId,
        };
      }
    }

    const directory = shops.map((s) => {
      const conn = connectionMap[s.id];
      let connectionState: 'NONE' | 'PENDING_SENT' | 'PENDING_RECEIVED' | 'ACCEPTED' | 'DECLINED' = 'NONE';
      if (conn) {
        if (conn.status === ConnectionStatus.ACCEPTED) connectionState = 'ACCEPTED';
        else if (conn.status === ConnectionStatus.DECLINED) connectionState = 'DECLINED';
        else if (conn.isSender) connectionState = 'PENDING_SENT';
        else connectionState = 'PENDING_RECEIVED';
      }

      return {
        ...s,
        connectionState,
        connectionId: conn?.connectionId || null,
        // Phone numbers strictly withheld in public directory (SEL-9 compliance)
        phone: null,
      };
    });

    return {
      directory,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Send mutual B2B connection request to another merchant
   */
  async sendConnectionRequest(
    senderShopId: string,
    senderOwnerId: string,
    receiverShopId: string,
    note?: string
  ) {
    if (senderShopId === receiverShopId) {
      throw new Error('Cannot connect to your own showroom');
    }

    const senderShop = await prisma.shop.findUnique({
      where: { id: senderShopId },
      select: { id: true, name: true, ownerId: true },
    });

    if (!senderShop || senderShop.ownerId !== senderOwnerId) {
      throw new Error('Unauthorized: you do not own the sender shop');
    }

    const receiverShop = await prisma.shop.findUnique({
      where: { id: receiverShopId },
      select: { id: true, name: true, ownerId: true, networkOptIn: true },
    });

    if (!receiverShop) throw new Error('Target showroom not found');
    if (!receiverShop.networkOptIn) {
      throw new Error('Target showroom has not opted into the Merchant Network');
    }

    // Check existing connection
    const existing = await prisma.merchantConnection.findFirst({
      where: {
        OR: [
          { senderShopId, receiverShopId },
          { senderShopId: receiverShopId, receiverShopId: senderShopId },
        ],
      },
    });

    if (existing) {
      if (existing.status === ConnectionStatus.ACCEPTED) {
        throw new Error('Showrooms are already mutually connected');
      }
      if (existing.status === ConnectionStatus.PENDING) {
        throw new Error('A connection request is already pending between these showrooms');
      }
      // Re-open if previously declined
      return prisma.merchantConnection.update({
        where: { id: existing.id },
        data: {
          senderShopId,
          receiverShopId,
          status: ConnectionStatus.PENDING,
          note: note?.trim() || null,
        },
      });
    }

    const connection = await prisma.merchantConnection.create({
      data: {
        senderShopId,
        receiverShopId,
        status: ConnectionStatus.PENDING,
        note: note?.trim() || null,
      },
    });

    // Notify receiver shop owner
    try {
      await notificationService.sendNotification({
        userId: receiverShop.ownerId,
        title: 'New Merchant Network Connect Request',
        body: `${senderShop.name} requested to connect with your showroom.`,
        type: 'SYSTEM',
        data: { connectionId: connection.id, senderShopId },
      });
    } catch {}

    return connection;
  }

  /**
   * List all inbound and outbound connections for a shop.
   * Contact info is ONLY revealed if status === 'ACCEPTED'!
   */
  async getShopConnections(shopId: string, ownerId: string) {
    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: { id: true, ownerId: true },
    });
    if (!shop || shop.ownerId !== ownerId) {
      throw new Error('Unauthorized: you do not own this shop');
    }

    const connections = await prisma.merchantConnection.findMany({
      where: {
        OR: [{ senderShopId: shopId }, { receiverShopId: shopId }],
      },
      include: {
        senderShop: {
          select: {
            id: true,
            name: true,
            logo: true,
            address: true,
            phone: true,
            networkCategory: true,
            networkDescription: true,
          },
        },
        receiverShop: {
          select: {
            id: true,
            name: true,
            logo: true,
            address: true,
            phone: true,
            networkCategory: true,
            networkDescription: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return connections.map((c) => {
      const isSender = c.senderShopId === shopId;
      const partner = isSender ? c.receiverShop : c.senderShop;
      const isAccepted = c.status === ConnectionStatus.ACCEPTED;

      return {
        id: c.id,
        status: c.status,
        note: c.note,
        isSender,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        partner: {
          id: partner.id,
          name: partner.name,
          logo: partner.logo,
          address: partner.address,
          networkCategory: partner.networkCategory,
          networkDescription: partner.networkDescription,
          // Privacy policy: only reveal verified phone/WhatsApp once accepted!
          phone: isAccepted ? partner.phone : null,
        },
      };
    });
  }

  /**
   * Accept or decline a connection request
   */
  async respondToConnection(
    connectionId: string,
    receiverOwnerId: string,
    action: 'ACCEPT' | 'DECLINE'
  ) {
    const connection = await prisma.merchantConnection.findUnique({
      where: { id: connectionId },
      include: {
        receiverShop: true,
        senderShop: true,
      },
    });

    if (!connection) throw new Error('Connection request not found');
    if (connection.receiverShop.ownerId !== receiverOwnerId) {
      throw new Error('Unauthorized to respond to this request');
    }

    const newStatus = action === 'ACCEPT' ? ConnectionStatus.ACCEPTED : ConnectionStatus.DECLINED;

    const updated = await prisma.merchantConnection.update({
      where: { id: connectionId },
      data: { status: newStatus },
    });

    // Notify sender
    try {
      await notificationService.sendNotification({
        userId: connection.senderShop.ownerId,
        title: action === 'ACCEPT' ? 'Merchant Connection Accepted! 🎉' : 'Connection Request Update',
        body: action === 'ACCEPT'
          ? `${connection.receiverShop.name} accepted your connection. You can now coordinate directly!`
          : `${connection.receiverShop.name} was unable to accept your connection at this time.`,
        type: 'SYSTEM',
        data: { connectionId, status: newStatus },
      });
    } catch {}

    return updated;
  }
}
