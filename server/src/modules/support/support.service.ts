import prisma from '../../config/database';
import { TicketAudience, TicketPriority, TicketStatus } from '@prisma/client';
import { NotificationService } from '../notification/notification.service';

const notificationService = new NotificationService();

export interface CreateTicketDto {
  subject: string;
  description: string;
  audience?: 'BUYER' | 'SELLER';
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  shopId?: string;
  orderId?: string;
}

export interface ReplyTicketDto {
  message: string;
  isInternal?: boolean;
}

export class SupportService {
  /**
   * Create support ticket with SLA enforcement (SEL-9)
   * Sellers receive guaranteed 4-hour first-response SLA.
   */
  async createTicket(userId: string, data: CreateTicketDto) {
    const audience: TicketAudience = data.audience === 'SELLER' ? TicketAudience.SELLER : TicketAudience.BUYER;

    // Default priority: HIGH for sellers, MEDIUM for buyers
    let priority: TicketPriority = TicketPriority.MEDIUM;
    if (data.priority && Object.values(TicketPriority).includes(data.priority as TicketPriority)) {
      priority = data.priority as TicketPriority;
    } else if (audience === TicketAudience.SELLER) {
      priority = TicketPriority.HIGH;
    }

    // SLA Calculation: 4 hours for sellers, 24 hours for buyers
    const slaHours = audience === TicketAudience.SELLER ? 4 : 24;
    const slaDueAt = new Date(Date.now() + slaHours * 60 * 60 * 1000);

    const ticket = await prisma.supportTicket.create({
      data: {
        userId,
        shopId: data.shopId,
        orderId: data.orderId,
        subject: data.subject.trim(),
        description: data.description.trim(),
        audience,
        priority,
        status: TicketStatus.OPEN,
        slaDueAt,
        messages: {
          create: {
            senderId: userId,
            senderRole: audience === TicketAudience.SELLER ? 'SELLER' : 'BUYER',
            message: data.description.trim(),
            isInternal: false,
          },
        },
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
        user: {
          select: { id: true, name: true, phone: true, email: true },
        },
        shop: {
          select: { id: true, name: true, phone: true },
        },
      },
    });

    return ticket;
  }

  /**
   * List tickets for user or seller with SLA countdown
   */
  async getUserTickets(userId: string, audienceFilter?: string) {
    const where: any = { userId };
    if (audienceFilter) {
      where.audience = audienceFilter as TicketAudience;
    }

    const tickets = await prisma.supportTicket.findMany({
      where,
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        shop: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const now = Date.now();
    return tickets.map((t) => {
      const msRemaining = t.slaDueAt ? t.slaDueAt.getTime() - now : 0;
      return {
        ...t,
        slaRemainingMinutes: Math.round(msRemaining / (60 * 1000)),
        isSlaBreached: msRemaining < 0 && t.status !== TicketStatus.RESOLVED && t.status !== TicketStatus.CLOSED,
      };
    });
  }

  /**
   * Get single ticket with full message thread
   */
  async getTicketDetails(ticketId: string, userId: string, isAdmin = false) {
    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: {
        user: {
          select: { id: true, name: true, phone: true, email: true },
        },
        shop: {
          select: { id: true, name: true, phone: true, ownerId: true },
        },
        messages: {
          where: isAdmin ? undefined : { isInternal: false },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!ticket) {
      throw new Error('Support ticket not found');
    }

    if (!isAdmin && ticket.userId !== userId && ticket.shop?.ownerId !== userId) {
      throw new Error('Unauthorized to view this ticket');
    }

    const now = Date.now();
    const msRemaining = ticket.slaDueAt ? ticket.slaDueAt.getTime() - now : 0;

    return {
      ...ticket,
      slaRemainingMinutes: Math.round(msRemaining / (60 * 1000)),
      isSlaBreached: msRemaining < 0 && ticket.status !== TicketStatus.RESOLVED && ticket.status !== TicketStatus.CLOSED,
    };
  }

  /**
   * Post message / reply on a ticket
   */
  async replyTicket(ticketId: string, senderId: string, senderRole: 'BUYER' | 'SELLER' | 'ADMIN', data: ReplyTicketDto) {
    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: { shop: true },
    });

    if (!ticket) {
      throw new Error('Support ticket not found');
    }

    if (ticket.status === TicketStatus.CLOSED) {
      throw new Error('Ticket is closed. Please open a new ticket.');
    }

    if (senderRole !== 'ADMIN' && ticket.userId !== senderId && ticket.shop?.ownerId !== senderId) {
      throw new Error('Unauthorized to reply to this ticket');
    }

    const message = await prisma.ticketMessage.create({
      data: {
        ticketId,
        senderId,
        senderRole,
        message: data.message.trim(),
        isInternal: Boolean(data.isInternal && senderRole === 'ADMIN'),
      },
    });

    // If admin replies and ticket was OPEN, move to IN_PROGRESS
    if (senderRole === 'ADMIN' && !data.isInternal && ticket.status === TicketStatus.OPEN) {
      await prisma.supportTicket.update({
        where: { id: ticketId },
        data: { status: TicketStatus.IN_PROGRESS },
      });

      // Send push/in-app notification to ticket creator
      try {
        await notificationService.sendNotification({
          userId: ticket.userId,
          title: `Support Update: Ticket #${ticket.id.slice(0, 8).toUpperCase()}`,
          body: data.message.slice(0, 120),
          type: 'SYSTEM',
          data: { ticketId: ticket.id },
        });
      } catch {}
    }

    return message;
  }

  /**
   * Rate and close ticket upon resolution
   */
  async rateAndCloseTicket(ticketId: string, userId: string, rating: number, feedback?: string) {
    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new Error('Support ticket not found');
    }

    if (ticket.userId !== userId) {
      throw new Error('Only the ticket creator can rate and close this ticket');
    }

    if (rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5 stars');
    }

    const updated = await prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        status: TicketStatus.CLOSED,
        closedAt: new Date(),
        satisfactionRating: Math.round(rating),
        satisfactionFeedback: feedback?.trim() || null,
      },
    });

    return updated;
  }

  /**
   * Admin console: get tickets queue with SLA status
   */
  async getAdminQueue(filter?: {
    audience?: string;
    status?: string;
    priority?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, filter?.page || 1);
    const limit = Math.max(1, Math.min(100, filter?.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (filter?.audience) where.audience = filter.audience as TicketAudience;
    if (filter?.status) where.status = filter.status as TicketStatus;
    if (filter?.priority) where.priority = filter.priority as TicketPriority;

    const [tickets, total] = await Promise.all([
      prisma.supportTicket.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, phone: true } },
          shop: { select: { id: true, name: true } },
          _count: { select: { messages: true } },
        },
        orderBy: [{ status: 'asc' }, { slaDueAt: 'asc' }],
        skip,
        take: limit,
      }),
      prisma.supportTicket.count({ where }),
    ]);

    const now = Date.now();
    const items = tickets.map((t) => {
      const msRemaining = t.slaDueAt ? t.slaDueAt.getTime() - now : 0;
      return {
        ...t,
        slaRemainingMinutes: Math.round(msRemaining / (60 * 1000)),
        isSlaBreached: msRemaining < 0 && t.status !== TicketStatus.RESOLVED && t.status !== TicketStatus.CLOSED,
      };
    });

    return {
      items,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Admin console: update ticket status, assignment, internal notes, resolution
   */
  async updateTicketAdmin(
    ticketId: string,
    adminId: string,
    data: {
      status?: TicketStatus;
      priority?: TicketPriority;
      assignedTo?: string;
      internalNotes?: string;
      resolution?: string;
    }
  ) {
    const updateData: any = {};
    if (data.status) updateData.status = data.status;
    if (data.priority) updateData.priority = data.priority;
    if (data.assignedTo !== undefined) updateData.assignedTo = data.assignedTo;
    if (data.internalNotes !== undefined) updateData.internalNotes = data.internalNotes;
    if (data.resolution !== undefined) {
      updateData.resolution = data.resolution;
      if (data.status === TicketStatus.RESOLVED || data.status === TicketStatus.CLOSED) {
        updateData.closedAt = new Date();
      }
    }

    const updated = await prisma.supportTicket.update({
      where: { id: ticketId },
      data: updateData,
    });

    if (data.internalNotes) {
      await prisma.ticketMessage.create({
        data: {
          ticketId,
          senderId: adminId,
          senderRole: 'ADMIN',
          message: `[Internal Note] ${data.internalNotes}`,
          isInternal: true,
        },
      });
    }

    return updated;
  }
}
