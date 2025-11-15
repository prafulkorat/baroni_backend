import express from 'express';
import { requireAuth, requireRole } from '../../middlewares/auth.js';
import { getJackpotMetrics, listStars, createWithdrawal, listWithdrawals, retryWithdrawal, approveWithdrawal, rejectWithdrawal } from '../../controllers/adminJackpot.js';
import { 
  getWithdrawalMetrics, 
  listWithdrawalRequests, 
  approveWithdrawalRequest, 
  rejectWithdrawalRequest, 
  retryWithdrawalRequest,
  getWithdrawalRequestDetails 
} from '../../controllers/adminJackpotWithdrawal.js';
import {
  listWithdrawalRequestsValidator,
  approveWithdrawalRequestValidator,
  rejectWithdrawalRequestValidator,
  getWithdrawalRequestDetailsValidator,
  getWithdrawalMetricsValidator
} from '../../validators/jackpotWithdrawalValidators.js';

const router = express.Router();

router.use(requireAuth);
router.use(requireRole('admin'));

// Old jackpot APIs (keep as is)
router.get('/metrics', getJackpotMetrics);
router.get('/stars', listStars);
router.post('/withdrawals', createWithdrawal);
router.get('/withdrawals', listWithdrawals);
router.patch('/withdrawals/:id/retry', retryWithdrawal);
router.patch('/withdrawals/:id/approve', approveWithdrawal);
router.patch('/withdrawals/:id/reject', rejectWithdrawal);

// New jackpot withdrawal request APIs
router.get('/withdrawal-requests/metrics', getWithdrawalMetricsValidator, getWithdrawalMetrics);
router.get('/withdrawal-requests', listWithdrawalRequestsValidator, listWithdrawalRequests);
router.get('/withdrawal-requests/:id', getWithdrawalRequestDetailsValidator, getWithdrawalRequestDetails);
router.patch('/withdrawal-requests/:id/approve', approveWithdrawalRequestValidator, approveWithdrawalRequest);
router.patch('/withdrawal-requests/:id/reject', rejectWithdrawalRequestValidator, rejectWithdrawalRequest);
router.patch('/withdrawal-requests/:id/retry', approveWithdrawalRequestValidator, retryWithdrawalRequest);

export default router;


