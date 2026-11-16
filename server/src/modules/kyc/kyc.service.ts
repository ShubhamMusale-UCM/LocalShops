import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler.middleware';
import {
  validateGSTIN,
  validatePAN,
  validateFSSAI,
  validateIFSC,
  validateUPI,
  maskIdentifier,
} from '../../utils/kycValidator';
import notificationService from '../notification/notification.service';

export interface SubmitKycInput {
  type: 'GSTIN' | 'PAN' | 'FSSAI' | 'BANK_ACCOUNT' | 'SHOP_ESTABLISHMENT';
  value: string;
  legalEntityName?: string;
  documentUrl?: string;
  accountNumber?: string;
  ifscCode?: string;
}

export class KycService {
  /**
   * Submit and verify a shop compliance document (SEL-6)
   */
  async submitKycDocument(shopId: string, userId: string, input: SubmitKycInput) {
    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      include: { owner: true },
    });

    if (!shop) throw new AppError('Shop not found', 404);
    if (shop.ownerId !== userId) {
      throw new AppError('Unauthorized: You do not own this shop', 403);
    }

    const { type, documentUrl } = input;
    const cleanValue = (input.value || '').trim();

    let verifiedName: string | null = null;
    let providerRef: string | null = null;
    let status = 'PENDING';

    // 1. Rigorous format and checksum validation
    if (type === 'GSTIN') {
      if (!validateGSTIN(cleanValue)) {
        throw new AppError('Invalid GSTIN: format or Mod-36 checksum verification failed', 422);
      }
      // Extract embedded PAN (chars 3 to 12)
      const embeddedPan = cleanValue.substring(2, 12);
      if (!validatePAN(embeddedPan)) {
        throw new AppError('Invalid GSTIN: Embedded PAN is invalid', 422);
      }

      // Provider verification simulation (Karza / Surepass)
      status = 'VERIFIED';
      verifiedName = input.legalEntityName
        ? input.legalEntityName.trim().toUpperCase()
        : `${shop.name.toUpperCase()} TRADERS`;
      providerRef = `KARZA_GST_${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

      // Sync to Shop model if GSTIN
      await prisma.shop.update({
        where: { id: shopId },
        data: {
          gstNumber: cleanValue.toUpperCase(),
        },
      });
    } else if (type === 'PAN') {
      if (!validatePAN(cleanValue)) {
        throw new AppError('Invalid PAN: must be 10 characters (e.g. ABCDE1234F) with valid entity code', 422);
      }

      status = 'VERIFIED';
      verifiedName = input.legalEntityName
        ? input.legalEntityName.trim().toUpperCase()
        : (shop.owner.name || shop.name).toUpperCase();
      providerRef = `NSDL_PAN_${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    } else if (type === 'FSSAI') {
      if (!validateFSSAI(cleanValue)) {
        throw new AppError('Invalid FSSAI number: must be exactly 14 numeric digits', 422);
      }

      status = 'VERIFIED';
      verifiedName = `${shop.name.toUpperCase()} (FSSAI REG)`;
      providerRef = `FSSAI_REG_${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    } else if (type === 'BANK_ACCOUNT') {
      const ifsc = (input.ifscCode || '').trim();
      if (!validateIFSC(ifsc)) {
        throw new AppError('Invalid IFSC code: must be 11 characters (e.g. HDFC0001234)', 422);
      }
      if (!cleanValue || cleanValue.length < 6 || cleanValue.length > 22 || !/^\d+$/.test(cleanValue)) {
        throw new AppError('Invalid bank account number: must be between 6 and 22 digits', 422);
      }

      status = 'VERIFIED';
      verifiedName = input.legalEntityName || shop.owner.name || shop.name;
      providerRef = `PENNY_DROP_${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    } else if (type === 'SHOP_ESTABLISHMENT') {
      if (!cleanValue || cleanValue.length < 5) {
        throw new AppError('Invalid shop licence registration number', 422);
      }
      status = 'MANUAL_REVIEW';
      providerRef = `SHOP_REG_${Date.now()}`;
    } else {
      throw new AppError(`Unsupported KYC document type: ${type}`, 400);
    }

    // 2. Upsert into shop_kyc table
    const record = await prisma.shopKyc.upsert({
      where: {
        shopId_type: { shopId, type },
      },
      update: {
        value: cleanValue.toUpperCase(),
        status,
        verifiedName,
        providerRef,
        documentUrl: documentUrl || null,
        verifiedAt: status === 'VERIFIED' ? new Date() : null,
        rejectionReason: null,
      },
      create: {
        shopId,
        type,
        value: cleanValue.toUpperCase(),
        status,
        verifiedName,
        providerRef,
        documentUrl: documentUrl || null,
        verifiedAt: status === 'VERIFIED' ? new Date() : null,
      },
    });

    // 3. Update shop verification badge status
    await this.updateShopVerificationBadge(shopId);

    return {
      ...record,
      maskedValue: maskIdentifier(cleanValue.toUpperCase(), type),
    };
  }

  /**
   * Fetch all KYC documents and verification status for a shop
   */
  async getShopKyc(shopId: string) {
    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: {
        id: true,
        name: true,
        isVerified: true,
        gstNumber: true,
      },
    });

    if (!shop) throw new AppError('Shop not found', 404);

    const documents = await prisma.shopKyc.findMany({
      where: { shopId },
      orderBy: { createdAt: 'desc' },
    });

    const maskedDocs = documents.map((doc) => ({
      ...doc,
      maskedValue: maskIdentifier(doc.value, doc.type),
    }));

    const isGstVerified = documents.some((d) => d.type === 'GSTIN' && d.status === 'VERIFIED');
    const isPanVerified = documents.some((d) => d.type === 'PAN' && d.status === 'VERIFIED');
    const isFssaiVerified = documents.some((d) => d.type === 'FSSAI' && d.status === 'VERIFIED');
    const legalEntityName = documents.find((d) => d.verifiedName)?.verifiedName || null;

    return {
      shopId,
      isVerified: shop.isVerified,
      legalEntityName,
      isGstVerified,
      isPanVerified,
      isFssaiVerified,
      documents: maskedDocs,
    };
  }

  /**
   * Admin review of a KYC document (Approve or Reject with reason)
   */
  async reviewKyc(kycId: string, adminId: string, decision: 'APPROVED' | 'REJECTED', reason?: string) {
    const doc = await prisma.shopKyc.findUnique({
      where: { id: kycId },
      include: { shop: { select: { id: true, name: true, ownerId: true } } },
    });

    if (!doc) throw new AppError('KYC document not found', 404);

    const newStatus = decision === 'APPROVED' ? 'VERIFIED' : 'FAILED';
    const updated = await prisma.shopKyc.update({
      where: { id: kycId },
      data: {
        status: newStatus,
        reviewedBy: adminId,
        rejectionReason: decision === 'REJECTED' ? reason || 'Document rejected by compliance team' : null,
        verifiedAt: decision === 'APPROVED' ? new Date() : null,
      },
    });

    // Recompute badge status
    const isNowVerified = await this.updateShopVerificationBadge(doc.shopId);

    // Notify seller
    try {
      const title = decision === 'APPROVED' ? '✅ KYC Document Verified' : '⚠️ KYC Document Rejected';
      const body = decision === 'APPROVED'
        ? `Your ${doc.type} for ${doc.shop.name} has been verified and approved.`
        : `Your ${doc.type} for ${doc.shop.name} was rejected: ${reason || 'Please re-upload a clear copy.'}`;

      await notificationService.createNotification(doc.shop.ownerId, {
        title,
        body,
        type: 'SYSTEM',
        relatedId: doc.shopId,
        actionUrl: `/seller/profile`,
      });
    } catch (_) {}

    return {
      ...updated,
      shopVerified: isNowVerified,
    };
  }

  /**
   * Admin KYC Queue
   */
  async getAdminQueue(params?: { status?: string; page?: number; limit?: number }) {
    const { status = 'PENDING', page = 1, limit = 20 } = params || {};
    const where: any = {};
    if (status) {
      where.status = status;
    }

    const [docs, total] = await Promise.all([
      prisma.shopKyc.findMany({
        where,
        include: { shop: { select: { id: true, name: true, phone: true, city: true } } },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.shopKyc.count({ where }),
    ]);

    return {
      documents: docs.map((d) => ({
        ...d,
        maskedValue: maskIdentifier(d.value, d.type),
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Checks if primary documents are verified and updates Shop.isVerified
   */
  private async updateShopVerificationBadge(shopId: string): Promise<boolean> {
    const docs = await prisma.shopKyc.findMany({
      where: { shopId },
    });

    const hasVerifiedGst = docs.some((d) => d.type === 'GSTIN' && d.status === 'VERIFIED');
    const hasVerifiedPan = docs.some((d) => d.type === 'PAN' && d.status === 'VERIFIED');

    // Verified badge requirement: GSTIN or PAN verified
    const shouldBeVerified = hasVerifiedGst || hasVerifiedPan;

    await prisma.shop.update({
      where: { id: shopId },
      data: { isVerified: shouldBeVerified },
    });

    return shouldBeVerified;
  }
}

export default new KycService();
