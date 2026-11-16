import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';
import kycService from './kyc.service';
import { AppError } from '../../middleware/errorHandler.middleware';

export class KycController {
  async submitKyc(req: AuthRequest, res: Response): Promise<void> {
    try {
      const shopId = req.params.shopId || req.params.id;
      const userId = req.user!.id;
      const { type, value, legalEntityName, documentUrl, accountNumber, ifscCode } = req.body;

      if (!shopId) {
        throw new AppError('Shop ID is required', 400);
      }
      if (!type || !value) {
        throw new AppError('Document type and value are required', 400);
      }

      const result = await kycService.submitKycDocument(shopId, userId, {
        type,
        value,
        legalEntityName,
        documentUrl,
        accountNumber,
        ifscCode,
      });

      res.status(200).json({ status: 'success', data: result });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  }

  async getShopKyc(req: AuthRequest, res: Response): Promise<void> {
    try {
      const shopId = req.params.shopId || req.params.id;
      if (!shopId) {
        throw new AppError('Shop ID is required', 400);
      }

      const result = await kycService.getShopKyc(shopId);
      res.status(200).json({ status: 'success', data: result });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  }

  async reviewKyc(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const adminId = req.user!.id;
      const { decision, reason } = req.body;

      if (req.user?.role !== 'ADMIN') {
        throw new AppError('Admin authorization required', 403);
      }
      if (!decision || (decision !== 'APPROVED' && decision !== 'REJECTED')) {
        throw new AppError('Decision must be APPROVED or REJECTED', 400);
      }

      const result = await kycService.reviewKyc(id, adminId, decision, reason);
      res.status(200).json({ status: 'success', data: result });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  }

  async getAdminQueue(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (req.user?.role !== 'ADMIN') {
        throw new AppError('Admin authorization required', 403);
      }
      const { status, page, limit } = req.query;
      const result = await kycService.getAdminQueue({
        status: status as string,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 20,
      });

      res.status(200).json({ status: 'success', data: result });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  }
}

export default new KycController();
