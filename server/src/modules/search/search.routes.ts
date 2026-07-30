import { Router } from 'express';
import { SearchController } from './search.controller';

const router = Router();

// Public search routes
router.get('/products', SearchController.searchProducts);
router.get('/nearby-shops', SearchController.searchNearbyShops);
router.get('/nearby-products', SearchController.searchNearbyProducts);
router.get('/suggestions', SearchController.getSuggestions);
router.get('/advanced', SearchController.advancedSearch);

export default router;
