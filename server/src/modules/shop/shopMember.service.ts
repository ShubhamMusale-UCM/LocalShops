import prisma from '../../config/database';
import { ShopRole } from '@prisma/client';
import { NotificationService } from '../notification/notification.service';

const notificationService = new NotificationService();

export class ShopMemberService {
  /**
   * Invite staff member by phone with specific role tier (SEL-10)
   * Permissions matrix: COUNTER (Order handling, handover) | MANAGER (Catalog, Ops) | OWNER
   */
  async inviteMember(
    shopId: string,
    ownerId: string,
    data: { phone: string; name?: string; role: 'MANAGER' | 'COUNTER' }
  ) {
    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: { id: true, name: true, ownerId: true },
    });

    if (!shop) throw new Error('Shop not found');
    if (shop.ownerId !== ownerId) {
      throw new Error('Only the showroom owner can invite team members');
    }

    const cleanPhone = data.phone.trim();
    if (!cleanPhone || cleanPhone.length < 10) {
      throw new Error('Valid 10-digit phone number is required');
    }

    // Role mapping
    const assignedRole = data.role === 'MANAGER' ? ShopRole.MANAGER : ShopRole.COUNTER;

    // Check if user account already exists with this phone
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { phone: cleanPhone },
          { phone: cleanPhone.replace(/^\+91/, '') },
          { phone: `+91${cleanPhone.replace(/^\+91/, '')}` },
        ],
      },
    });

    // Check if trying to invite owner as counter
    if (existingUser && existingUser.id === shop.ownerId) {
      throw new Error('The owner already has full administrator access');
    }

    const member = await prisma.shopMember.upsert({
      where: {
        shopId_phone: {
          shopId,
          phone: cleanPhone,
        },
      },
      update: {
        role: assignedRole,
        name: data.name?.trim() || undefined,
        userId: existingUser?.id || undefined,
        joinedAt: existingUser ? new Date() : undefined,
      },
      create: {
        shopId,
        phone: cleanPhone,
        name: data.name?.trim() || null,
        role: assignedRole,
        userId: existingUser?.id || null,
        joinedAt: existingUser ? new Date() : null,
      },
    });

    // Send notification if user exists
    if (existingUser) {
      try {
        await notificationService.sendNotification({
          userId: existingUser.id,
          title: 'Showroom Team Invitation',
          body: `You have been added as ${assignedRole} at ${shop.name}.`,
          type: 'SYSTEM',
          data: { shopId, role: assignedRole },
        });
      } catch {}
    }

    return member;
  }

  /**
   * List all staff members for a shop
   */
  async getMembers(shopId: string, requesterId: string) {
    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: { id: true, ownerId: true, owner: { select: { id: true, name: true, phone: true } } },
    });

    if (!shop) throw new Error('Shop not found');

    // Requester must be owner or manager
    const membership = await prisma.shopMember.findFirst({
      where: { shopId, userId: requesterId },
    });

    if (shop.ownerId !== requesterId && membership?.role !== ShopRole.MANAGER) {
      throw new Error('Unauthorized to view showroom team roster');
    }

    const members = await prisma.shopMember.findMany({
      where: { shopId },
      include: {
        user: { select: { id: true, name: true, phone: true, avatar: true } },
      },
      orderBy: { invitedAt: 'asc' },
    });

    return {
      owner: {
        id: shop.owner.id,
        name: shop.owner.name,
        phone: shop.owner.phone,
        role: 'OWNER',
      },
      members: members.map((m) => ({
        id: m.id,
        phone: m.phone,
        name: m.name || m.user?.name || 'Staff Member',
        role: m.role,
        isRegistered: Boolean(m.userId),
        invitedAt: m.invitedAt,
        joinedAt: m.joinedAt,
      })),
    };
  }

  /**
   * Change staff member role
   */
  async updateRole(shopId: string, memberId: string, ownerId: string, newRole: 'MANAGER' | 'COUNTER') {
    const shop = await prisma.shop.findUnique({ where: { id: shopId }, select: { ownerId: true } });
    if (!shop || shop.ownerId !== ownerId) throw new Error('Only the showroom owner can change roles');

    const assignedRole = newRole === 'MANAGER' ? ShopRole.MANAGER : ShopRole.COUNTER;

    return prisma.shopMember.update({
      where: { id: memberId },
      data: { role: assignedRole },
    });
  }

  /**
   * Remove member from showroom team
   */
  async removeMember(shopId: string, memberId: string, ownerId: string) {
    const shop = await prisma.shop.findUnique({ where: { id: shopId }, select: { ownerId: true } });
    if (!shop || shop.ownerId !== ownerId) throw new Error('Only the showroom owner can remove staff');

    return prisma.shopMember.delete({
      where: { id: memberId },
    });
  }

  /**
   * Check if user satisfies required role level for the shop
   * Hierarchy: OWNER >= MANAGER >= COUNTER
   */
  async hasPermission(
    shopId: string,
    userId: string,
    minRequiredRole: 'COUNTER' | 'MANAGER' | 'OWNER'
  ): Promise<boolean> {
    const shop = await prisma.shop.findUnique({ where: { id: shopId }, select: { ownerId: true } });
    if (!shop) return false;
    if (shop.ownerId === userId) return true; // Owner always has all permissions

    if (minRequiredRole === 'OWNER') return false;

    const member = await prisma.shopMember.findFirst({
      where: { shopId, userId },
    });

    if (!member) return false;

    if (minRequiredRole === 'COUNTER') return true; // Both MANAGER and COUNTER satisfy COUNTER
    if (minRequiredRole === 'MANAGER') return member.role === ShopRole.MANAGER;

    return false;
  }
}
