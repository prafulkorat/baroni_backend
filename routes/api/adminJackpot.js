import express from 'express';
import { requireAuth, requireRole } from '../../middlewares/auth.js';
import { getJackpotMetrics, listStars, createWithdrawal, listWithdrawals, retryWithdrawal } from '../../controllers/adminJackpot.js';

const router = express.Router();

router.use(requireAuth);
router.use(requireRole('admin'));

router.get('/metrics', getJackpotMetrics);
router.get('/stars', listStars);
router.post('/withdrawals', createWithdrawal);
router.get('/withdrawals', listWithdrawals);
router.patch('/withdrawals/:id/retry', retryWithdrawal);

export default router;


