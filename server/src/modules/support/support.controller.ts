import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';
import { SupportService } from './support.service';

const supportService = new SupportService();

export class SupportController {
  async createTicket(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { subject, description, audience, priority, shopId, orderId } = req.body;
      if (!subject || !description) {
        res.status(400).json({ error: 'Subject and description are required' });
        return;
      }

      const ticket = await supportService.createTicket(req.user!.id, {
        subject,
        description,
        audience,
        priority,
        shopId,
        orderId,
      });

      res.status(201).json({
        message: 'Support ticket submitted successfully',
        ticket,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to create support ticket' });
    }
  }

  async getMyTickets(req: AuthRequest, res: Response): Promise<void> {
    try {
      const audience = req.query.audience as string | undefined;
      const tickets = await supportService.getUserTickets(req.user!.id, audience);
      res.status(200).json({ tickets });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch support tickets' });
    }
  }

  async getTicketDetails(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const isAdmin = req.user?.role === 'ADMIN';
      const ticket = await supportService.getTicketDetails(id, req.user!.id, isAdmin);
      res.status(200).json({ ticket });
    } catch (err: any) {
      res.status(err.message.includes('Unauthorized') ? 403 : 404).json({ error: err.message });
    }
  }

  async replyTicket(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { message, isInternal } = req.body;
      if (!message || !message.trim()) {
        res.status(400).json({ error: 'Message cannot be empty' });
        return;
      }

      const senderRole = req.user?.role === 'ADMIN' ? 'ADMIN' : (req.user?.role === 'SELLER' ? 'SELLER' : 'BUYER');
      const reply = await supportService.replyTicket(id, req.user!.id, senderRole, { message, isInternal });
      res.status(201).json({ message: 'Reply sent', reply });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to post reply' });
    }
  }

  async rateTicket(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { rating, feedback } = req.body;
      if (!rating || rating < 1 || rating > 5) {
        res.status(400).json({ error: 'Rating must be a number between 1 and 5' });
        return;
      }

      const updated = await supportService.rateAndCloseTicket(id, req.user!.id, Number(rating), feedback);
      res.status(200).json({ message: 'Thank you for your rating! Ticket closed.', ticket: updated });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to rate ticket' });
    }
  }

  // Admin Console Endpoints
  async adminGetQueue(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { audience, status, priority, page, limit } = req.query;
      const result = await supportService.getAdminQueue({
        audience: audience as string,
        status: status as string,
        priority: priority as string,
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
      });
      res.status(200).json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to load support queue' });
    }
  }

  async adminUpdateTicket(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { status, priority, assignedTo, internalNotes, resolution } = req.body;
      const updated = await supportService.updateTicketAdmin(id, req.user!.id, {
        status,
        priority,
        assignedTo,
        internalNotes,
        resolution,
      });
      res.status(200).json({ message: 'Ticket updated successfully', ticket: updated });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to update ticket' });
    }
  }
}
