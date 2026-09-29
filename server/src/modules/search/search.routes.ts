import { Router } from 'express';
import { SearchController } from './search.controller';
import { optionalAuth } from '../../middleware/auth.middleware';

const router = Router();

// Public search routes
router.get('/products', optionalAuth, SearchController.searchProducts);
router.get('/nearby-shops', SearchController.searchNearbyShops);
router.get('/nearby-products', SearchController.searchNearbyProducts);
router.get('/suggestions', SearchController.getSuggestions);
router.get('/advanced', optionalAuth, SearchController.advancedSearch);

export default router;
