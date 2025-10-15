import express from 'express';
import { requireAuth, requireRole } from '../../middlewares/auth.js';
import { 
  getGlobalConfig, 
  updateGlobalConfig,
  getCategories,
  getCountryServiceConfigs,
  createCountryServiceConfig,
  updateCountryServiceConfig,
  deleteCountryServiceConfig,
  // Legacy methods
  getPublicConfig,
  upsertConfig
} from '../../controllers/config.js';
import { 
  updateGlobalConfigValidation,
  createCountryServiceConfigValidation,
  updateCountryServiceConfigValidation,
  deleteCountryServiceConfigValidation,
  getCountryServiceConfigsValidation,
  // Legacy validator
  upsertConfigValidation
} from '../../validators/configValidators.js';

const router = express.Router();

// Global Configuration Routes
router.get('/', getGlobalConfig);
router.put('/', requireAuth, requireRole('admin'), updateGlobalConfigValidation, updateGlobalConfig);
router.post('/', requireAuth, requireRole('admin'), updateGlobalConfigValidation, updateGlobalConfig);

// Legacy routes for backward compatibility
router.get('/public', getPublicConfig);
router.put('/legacy', requireAuth, requireRole('admin'), upsertConfigValidation, upsertConfig);

// Category Management Routes (using existing category routes)
router.get('/categories', getCategories);

// Country Service Configuration Routes
router.get('/country-services', getCountryServiceConfigsValidation, getCountryServiceConfigs);
router.post('/country-services', requireAuth, requireRole('admin'), createCountryServiceConfigValidation, createCountryServiceConfig);
router.put('/country-services/:configId', requireAuth, requireRole('admin'), updateCountryServiceConfigValidation, updateCountryServiceConfig);
router.delete('/country-services/:configId', requireAuth, requireRole('admin'), deleteCountryServiceConfigValidation, deleteCountryServiceConfig);

export default router;






