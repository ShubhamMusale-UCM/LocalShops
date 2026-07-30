import { Router } from 'express';

const router = Router();

// In a real production app, these values would come from a database table
// or a Redis cache so admins can update them without deploying code.
// For now, we use constants.
const SYSTEM_CONFIG = {
  minAppVersion: '1.0.0', // If user's app version is lower than this, force update
  latestAppVersion: '1.0.0',
  maintenanceMode: false,
  supportPhone: '+919876543210',
  supportEmail: 'support@citylocalshop.com',
};

router.get('/config', (req, res) => {
  res.json({
    success: true,
    data: SYSTEM_CONFIG,
  });
});

export default router;
