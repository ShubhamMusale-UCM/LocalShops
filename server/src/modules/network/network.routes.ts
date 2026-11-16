import { Router } from 'express';
import { NetworkController } from './network.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();
const networkController = new NetworkController();

// Directory (publicly browseable by authenticated users/sellers)
router.get('/directory', authenticate, networkController.getDirectory.bind(networkController));

// Shop-specific network management
router.patch('/shops/:shopId/profile', authenticate, networkController.updateProfile.bind(networkController));
router.get('/shops/:shopId/connections', authenticate, networkController.getConnections.bind(networkController));

// Connection request workflow
router.post('/connect', authenticate, networkController.sendRequest.bind(networkController));
router.patch('/requests/:id', authenticate, networkController.respondRequest.bind(networkController));

export default router;
