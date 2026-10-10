import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from './api';

export interface TelemetryEvent {
  campaignId: string;
  productId: string;
  type: 'impression' | 'click' | 'view' | 'cart_add' | 'conversion';
  keyword?: string;
  productPrice?: number;
  timestamp: number;
  deviceId?: string;
}

class TelemetryService {
  private queue: TelemetryEvent[] = [];
  private isProcessing = false;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  // Prevent duplicate impressions in the same session, with 1-hour TTL
  private trackedImpressions = new Map<string, number>();
  // Prevent click fraud, with 5-minute debounce
  private trackedClicks = new Map<string, number>();
  private deviceId: string | null = null;

  constructor() {
    this.initDeviceId();
    this.startBatching();
  }

  private async initDeviceId() {
    try {
      let id = await AsyncStorage.getItem('@device_id');
      if (!id) {
        id = `dev_${Math.random().toString(36).substring(2, 15)}_${Date.now()}`;
        await AsyncStorage.setItem('@device_id', id);
      }
      this.deviceId = id;
    } catch (e) {
      this.deviceId = `dev_fallback_${Date.now()}`;
    }
  }

  private startBatching() {
    if (!this.intervalId) {
      this.intervalId = setInterval(() => {
        this.processQueue();
        this.clearExpiredCaches();
      }, 5000);
    }
  }

  private clearExpiredCaches() {
    const now = Date.now();
    // 1-hour TTL for impressions
    for (const [key, timestamp] of this.trackedImpressions.entries()) {
      if (now - timestamp >= 60 * 60 * 1000) {
        this.trackedImpressions.delete(key);
      }
    }
    // 30-second debounce for clicks
    for (const [key, timestamp] of this.trackedClicks.entries()) {
      if (now - timestamp >= 30 * 1000) {
        this.trackedClicks.delete(key);
      }
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
      deviceId: this.deviceId || undefined,
    });
  }

  trackClick(campaignId: string, productId: string, keyword?: string) {
    const key = `${campaignId}_${productId}_${keyword || ''}`;
    const now = Date.now();
    const lastClicked = this.trackedClicks.get(key);
    
    // 30-second debounce for clicks
    if (lastClicked && now - lastClicked < 30 * 1000) {
      return;
    }
    this.trackedClicks.set(key, now);

    this.queue.push({
      campaignId,
      productId,
      type: 'click',
      keyword,
      timestamp: Date.now(),
      deviceId: this.deviceId || undefined,
    });
  }

  trackView(campaignId: string, productId: string) {
    this.queue.push({
      campaignId,
      productId,
      type: 'view',
      timestamp: Date.now(),
      deviceId: this.deviceId || undefined,
    });
  }

  trackCartAdd(campaignId: string, productId: string, keyword?: string) {
    this.queue.push({
      campaignId,
      productId,
      type: 'cart_add',
      keyword,
      timestamp: Date.now(),
      deviceId: this.deviceId || undefined,
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
