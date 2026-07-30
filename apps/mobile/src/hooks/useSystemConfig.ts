import { useState, useEffect } from 'react';
import api from '../services/api';

interface SystemConfig {
  minAppVersion: string;
  latestAppVersion: string;
  maintenanceMode: boolean;
  supportPhone: string;
  supportEmail: string;
}

// Hardcode current app version for now (usually comes from expo-constants or package.json)
const CURRENT_APP_VERSION = '1.0.0';

const parseVersion = (v: string) => v.split('.').map(Number);

const isOutdated = (current: string, minimum: string) => {
  const c = parseVersion(current);
  const m = parseVersion(minimum);
  for (let i = 0; i < 3; i++) {
    const cv = c[i] || 0;
    const mv = m[i] || 0;
    if (cv < mv) return true;
    if (cv > mv) return false;
  }
  return false;
};

export const useSystemConfig = () => {
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [needsUpdate, setNeedsUpdate] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await api.get('/system/config');
        if (res.data?.success && res.data?.data) {
          const fetchedConfig = res.data.data;
          setConfig(fetchedConfig);
          if (isOutdated(CURRENT_APP_VERSION, fetchedConfig.minAppVersion)) {
            setNeedsUpdate(true);
          }
        }
      } catch (err) {
        console.error('Failed to fetch system config', err);
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, []);

  return { config, needsUpdate, loading };
};
