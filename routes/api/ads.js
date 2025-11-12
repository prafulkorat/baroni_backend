import express from 'express';
import { requireAuth } from '../../middlewares/auth.js';
import { uploadMixed } from '../../middlewares/upload.js';
import {
  createAd,
  getUserAds,
  getAd,
  updateAd,
  deleteAd,
  getActiveAds,
  trackAdClick,
  getAdAnalytics
} from '../../controllers/ads.js';
import {
  createAdValidation,
  updateAdValidation,
  getAdValidation,
  deleteAdValidation,
  getUserAdsValidation,
  getActiveAdsValidation,
  trackAdClickValidation,
  getAdAnalyticsValidation
} from '../../validators/adsValidators.js';

const router = express.Router();

// Public routes (no authentication required)
router.get('/public/active', getActiveAdsValidation, getActiveAds);
router.post('/:id/click', trackAdClickValidation, trackAdClick);

// Protected routes (authentication required)
router.use(requireAuth);

// User's ads management routes
router.post('/', uploadMixed.single('image'), createAdValidation, createAd);
router.get('/', getUserAdsValidation, getUserAds);
router.get('/:id', getAdValidation, getAd);
router.put('/:id', uploadMixed.single('image'), updateAdValidation, updateAd);
router.delete('/:id', deleteAdValidation, deleteAd);
router.get('/:id/analytics', getAdAnalyticsValidation, getAdAnalytics);

export default router;
