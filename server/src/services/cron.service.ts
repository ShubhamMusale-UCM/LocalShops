import cron from 'node-cron';
import prisma from '../config/database';

class CronService {
  public start() {
    // Run every night at 2:00 AM
    cron.schedule('0 2 * * *', async () => {
      console.log('--- Running Nightly CRON: Ad Quality Score Decay & Ad Settlements ---');
      await this.decayAdQualityScores();
      await this.settleEndedAdBudgets();
      await this.deleteOldAdImpressionLogs();
    });
  }

  private async deleteOldAdImpressionLogs() {
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const { count } = await prisma.adImpressionLog.deleteMany({
        where: { timestamp: { lt: sevenDaysAgo } }
      });
      console.log(`Deleted ${count} old AdImpressionLogs.`);
    } catch (err) {
      console.error('Failed to run deleteOldAdImpressionLogs cron job:', err);
    }
  }

  private async decayAdQualityScores() {
    try {
      const activeAds = await prisma.promotedListing.findMany({
        where: { isActive: true },
        select: { id: true, impressions: true, clicks: true, qualityScore: true }
      });

      for (const ad of activeAds) {
        // We only evaluate ads with at least 100 impressions to be statistically significant
        if (ad.impressions > 100) {
          const ctr = (ad.clicks / ad.impressions) * 100;
          let newScore = ad.qualityScore || 5;

          if (ctr < 1.0) {
            // Terrible CTR: Buyers hate it. Penalize it.
            newScore = Math.max(1, newScore - 1);
          } else if (ctr > 3.0) {
            // Great CTR: Buyers love it. Reward it.
            newScore = Math.min(10, newScore + 1);
          }

          if (newScore !== ad.qualityScore) {
            await prisma.promotedListing.update({
              where: { id: ad.id },
              data: { qualityScore: newScore }
            });
          }
        }
      }
      console.log(`Processed Ad Quality Score Decay for ${activeAds.length} active campaigns.`);
    } catch (err) {
      console.error('Failed to run Ad Quality Score Decay cron job:', err);
    }
  }

  private async settleEndedAdBudgets() {
    try {
      const { default: walletService } = await import('../modules/wallet/wallet.service');

      // 1. Deactivate ads that are exhausted (spent >= budget) or expired but still marked active
      const now = new Date();
      await prisma.promotedListing.updateMany({
        where: {
          isActive: true,
          OR: [
            { endDate: { lt: now } },
            // Cannot use field references in Prisma updateMany where, so this requires a raw query or just picking them up next
          ]
        },
        data: { isActive: false }
      });
      // Raw query for spent >= budget
      await prisma.$executeRaw`UPDATE "PromotedListing" SET "isActive" = false WHERE "isActive" = true AND "spent" >= "budget"`;

      // 2. Find all inactive ads that have unspent budget
      const endedAds = await prisma.promotedListing.findMany({
        where: {
          isActive: false,
        },
        select: { id: true, shopId: true, budget: true, spent: true }
      });

      let settledCount = 0;
      for (const ad of endedAds) {
        if (ad.budget > ad.spent) {
          try {
            await prisma.$transaction(async (tx) => {
              // Lock the ad to safely calculate unspent budget
              const [lockedAd] = await tx.$queryRaw<any[]>`SELECT spent, budget FROM "PromotedListing" WHERE id = ${ad.id} FOR UPDATE`;
              const unspent = lockedAd.budget - lockedAd.spent;
              
              if (unspent > 0) {
                // Adjust budget to match spent so it no longer has unspent funds
                await tx.promotedListing.update({
                  where: { id: ad.id },
                  data: { budget: lockedAd.spent }
                });

                // Lock the shop to safely refund the wallet
                const [lockedShop] = await tx.$queryRaw<any[]>`SELECT "adWalletBalance" FROM "Shop" WHERE id = ${ad.shopId} FOR UPDATE`;
                const newBalance = lockedShop.adWalletBalance + unspent;

                await tx.shop.update({
                  where: { id: ad.shopId },
                  data: { adWalletBalance: newBalance }
                });

                await tx.sellerAdWalletTransaction.create({
                  data: {
                    shopId: ad.shopId,
                    type: 'SELLER_AD_CREDIT',
                    amount: unspent,
                    direction: 'CREDIT',
                    balanceAfter: newBalance,
                    description: `Refund of unspent budget for expired ad campaign (Ad: ${ad.id})`,
                    referenceType: 'AD_CAMPAIGN',
                    referenceId: `${ad.id}_refund`,
                  }
                });
                settledCount++;
              }
            });
          } catch (e) {
            console.error(`Failed to settle budget for ad ${ad.id}:`, e);
          }
        }
      }
      
      if (settledCount > 0) {
        console.log(`Settled unspent budgets for ${settledCount} expired campaigns.`);
      }
    } catch (err) {
      console.error('Failed to run Ad Budget Settlement cron job:', err);
    }
  }
}

export default new CronService();
