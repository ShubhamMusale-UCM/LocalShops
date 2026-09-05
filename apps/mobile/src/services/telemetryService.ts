import apiClient from './api';

export interface TelemetryEvent {
  campaignId: string;
  productId: string;
  type: 'impression' | 'click' | 'conversion';
  keyword?: string;
  timestamp: number;
}

class TelemetryService {
  private queue: TelemetryEvent[] = [];
  private isProcessing = false;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  // Prevent duplicate impressions in the same session, with 1-hour TTL
  private trackedImpressions = new Map<string, number>();
  // Prevent click fraud, with 5-minute debounce
  private trackedClicks = new Map<string, number>();

  constructor() {
    this.startBatching();
  }

  private startBatching() {
    if (!this.intervalId) {
      this.intervalId = setInterval(() => this.processQueue(), 5000);
    }
  }

  trackImpression(campaignId: string, productId: string, keyword?: string) {
    const key = `${campaignId}_${keyword || ''}`;
    const now = Date.now();
    const lastTracked = this.trackedImpressions.get(key);
    
    // 1-hour TTL for impressions
    if (lastTracked && now - lastTracked < 60 * 60 * 1000) {
      return; 
    }
    this.trackedImpressions.set(key, now);

    this.queue.push({
      campaignId,
      productId,
      type: 'impression',
      keyword,
      timestamp: Date.now(),
    });
  }

  trackClick(campaignId: string, productId: string, keyword?: string) {
    const key = `${campaignId}_${keyword || ''}`;
    const now = Date.now();
    const lastClicked = this.trackedClicks.get(key);
    
    // 5-minute debounce for clicks
    if (lastClicked && now - lastClicked < 5 * 60 * 1000) {
      return;
    }
    this.trackedClicks.set(key, now);

    this.queue.push({
      campaignId,
      productId,
      type: 'click',
      keyword,
      timestamp: Date.now(),
    });
  }

  trackConversion(campaignId: string, productId: string, keyword?: string) {
    this.queue.push({
      campaignId,
      productId,
      type: 'conversion',
      keyword,
      timestamp: Date.now(),
    });
  }

  private async processQueue() {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const batch = [...this.queue];
    this.queue = [];

    try {
      await apiClient.post('/ads/telemetry/batch', { events: batch });
    } catch (error) {
      console.warn('Failed to send telemetry batch, requeuing...', error);
      // Put back in queue if failed (avoid growing too large though)
      if (this.queue.length < 1000) {
        this.queue = [...batch, ...this.queue];
      }
    } finally {
      this.isProcessing = false;
    }
  }
}

export default new TelemetryService();
