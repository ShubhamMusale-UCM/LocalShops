import api from '../services/api';
import { API_BASE_URL } from './constants';

export const networkDiagnostics = {
  /**
   * Test if server is reachable without authentication
   */
  async testServerConnectivity(): Promise<{
    isReachable: boolean;
    latency: number;
    error?: string;
    apiUrl: string;
  }> {
    console.log('[NetworkDiagnostics] Testing connectivity to:', API_BASE_URL);
    const startTime = Date.now();

    try {
      const response = await api.get('/health', { timeout: 5000 });
      const latency = Date.now() - startTime;
      console.log('[NetworkDiagnostics] Server reachable! Latency:', latency, 'ms');
      console.log('[NetworkDiagnostics] Response:', response.data);
      return {
        isReachable: true,
        latency,
        apiUrl: API_BASE_URL,
      };
    } catch (error: any) {
      const errorMsg = error?.message || 'Unknown error';
      console.error('[NetworkDiagnostics] Server not reachable');
      console.error('[NetworkDiagnostics] Error code:', error?.code);
      console.error('[NetworkDiagnostics] Error message:', errorMsg);
      console.error('[NetworkDiagnostics] Status:', error?.response?.status);

      return {
        isReachable: false,
        latency: Date.now() - startTime,
        error: errorMsg,
        apiUrl: API_BASE_URL,
      };
    }
  },

  /**
   * Test with a simple GET request (no auth required)
   */
  async testSimpleRequest(): Promise<boolean> {
    console.log('[NetworkDiagnostics] Testing simple GET request');
    try {
      const response = await fetch(`${API_BASE_URL}/health`, {
        method: 'GET',
        headers: { 'ngrok-skip-browser-warning': '1' },
        timeout: 5000,
      } as any);
      const isOk = response.ok;
      console.log('[NetworkDiagnostics] Simple request status:', response.status, isOk ? 'OK' : 'FAILED');
      return isOk;
    } catch (error: any) {
      console.error('[NetworkDiagnostics] Simple request failed:', error?.message);
      return false;
    }
  },

  /**
   * Get comprehensive diagnostics
   */
  async runFullDiagnostics() {
    console.log('========== NETWORK DIAGNOSTICS ==========');
    const results = {
      timestamp: new Date().toISOString(),
      apiUrl: API_BASE_URL,
      connectivity: await this.testServerConnectivity(),
      simpleRequest: await this.testSimpleRequest(),
    };
    console.log('========== DIAGNOSTICS RESULT ==========');
    console.log(JSON.stringify(results, null, 2));
    return results;
  },
};
