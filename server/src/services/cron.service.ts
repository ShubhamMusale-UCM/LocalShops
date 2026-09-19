import cron from 'node-cron';
import prisma from '../config/database';

class CronService {
  public start() {
    // Run every night at 2:00 AM
    cron.schedule('0 2 * * *', async () => {
      console.log('--- Running Nightly CRON: Ad Quality Score Decay ---');
      await this.decayAdQualityScores();
    });
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
}

export default new CronService();
