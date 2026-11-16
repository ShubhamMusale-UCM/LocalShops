import { Router } from 'express';
import { SupportController } from './support.controller';
import { authenticate, authorizeRole } from '../../middleware/auth.middleware';

const router = Router();
const supportController = new SupportController();

// User & Seller routes
router.post('/', authenticate, supportController.createTicket.bind(supportController));
router.get('/', authenticate, supportController.getMyTickets.bind(supportController));
router.get('/:id', authenticate, supportController.getTicketDetails.bind(supportController));
router.post('/:id/reply', authenticate, supportController.replyTicket.bind(supportController));
router.post('/:id/rate', authenticate, supportController.rateTicket.bind(supportController));

// Admin routes
router.get('/admin/queue', authenticate, authorizeRole(['ADMIN']), supportController.adminGetQueue.bind(supportController));
router.patch('/admin/:id', authenticate, authorizeRole(['ADMIN']), supportController.adminUpdateTicket.bind(supportController));

export default router;
