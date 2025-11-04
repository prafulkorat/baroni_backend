import express from 'express';
import { requireAuth, requireRole } from '../../middlewares/auth.js';
import {
  getCommissionConfig,
  updateGlobalCommission,
  updateServiceDefaults,
  upsertCountryOverride,
  deleteCountryOverride
} from '../../controllers/commission.js';

const router = express.Router();

router.use(requireAuth);
router.use(requireRole('admin'));

router.get('/', getCommissionConfig);
router.put('/global', updateGlobalCommission);
router.put('/services', updateServiceDefaults);
router.post('/countries', upsertCountryOverride);
router.delete('/countries/:countryCode', deleteCountryOverride);

export default router;


