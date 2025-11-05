import express from 'express';
import { requireAuth, requireRole } from '../../middlewares/auth.js';
import { getJackpotMetrics, listStars, createWithdrawal, listWithdrawals, retryWithdrawal, approveWithdrawal, rejectWithdrawal } from '../../controllers/adminJackpot.js';

const router = express.Router();

router.use(requireAuth);
router.use(requireRole('admin'));

router.get('/metrics', getJackpotMetrics);
router.get('/stars', listStars);
router.post('/withdrawals', createWithdrawal);
router.get('/withdrawals', listWithdrawals);
router.patch('/withdrawals/:id/retry', retryWithdrawal);
router.patch('/withdrawals/:id/approve', approveWithdrawal);
router.patch('/withdrawals/:id/reject', rejectWithdrawal);

export default router;


