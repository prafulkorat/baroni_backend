import express from 'express';
import { requireAuth, requireRole } from '../../middlewares/auth.js';
import { getRefundMetrics, listRefundables, triggerRefund } from '../../controllers/adminRefunds.js';

const router = express.Router();

router.use(requireAuth);
router.use(requireRole('admin'));

router.get('/metrics', getRefundMetrics);
router.get('/', listRefundables);
router.post('/:transactionId/trigger', triggerRefund);

export default router;


