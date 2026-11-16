import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';
import { NetworkService } from './network.service';

const networkService = new NetworkService();

export class NetworkController {
  async updateProfile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { shopId } = req.params;
      const { networkOptIn, networkDescription, networkCategory } = req.body;

      if (typeof networkOptIn !== 'boolean') {
        res.status(400).json({ error: 'networkOptIn boolean is required' });
        return;
      }

      const updated = await networkService.updateNetworkProfile(shopId, req.user!.id, {
        networkOptIn,
        networkDescription,
        networkCategory,
      });

      res.status(200).json({
        message: 'Merchant network settings updated',
        shop: updated,
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to update network settings' });
    }
  }

  async getDirectory(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { currentShopId, category, query, page, limit } = req.query;

      const result = await networkService.getDirectory(currentShopId as string | undefined, {
        category: category as string | undefined,
        query: query as string | undefined,
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
      });

      res.status(200).json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to load merchant network directory' });
    }
  }

  async sendRequest(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { senderShopId, receiverShopId, note } = req.body;
      if (!senderShopId || !receiverShopId) {
        res.status(400).json({ error: 'senderShopId and receiverShopId are required' });
        return;
      }

      const connection = await networkService.sendConnectionRequest(
        senderShopId,
        req.user!.id,
        receiverShopId,
        note
      );

      res.status(201).json({
        message: 'Connection request sent successfully',
        connection,
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to send connection request' });
    }
  }

  async getConnections(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { shopId } = req.params;
      const connections = await networkService.getShopConnections(shopId, req.user!.id);
      res.status(200).json({ connections });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to load connections' });
    }
  }

  async respondRequest(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { action } = req.body;

      if (action !== 'ACCEPT' && action !== 'DECLINE') {
        res.status(400).json({ error: "Action must be 'ACCEPT' or 'DECLINE'" });
        return;
      }

      const updated = await networkService.respondToConnection(id, req.user!.id, action);
      res.status(200).json({
        message: action === 'ACCEPT' ? 'Connection accepted! Contact information unlocked.' : 'Connection request declined.',
        connection: updated,
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to respond to connection request' });
    }
  }
}
