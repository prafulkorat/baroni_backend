import express from 'express';
import { body, query } from 'express-validator';
import { getAdminReport, createWithdrawal, listWithdrawals } from '../../controllers/adminWallet.js';
import { requireAuth } from '../../middlewares/auth.js';

const router = express.Router();

// All routes require auth and admin role (validated in controller too as defense-in-depth)
router.get(
  '/report',
  requireAuth,
  [
    query('starId').optional().isString(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 })
  ],
  getAdminReport
);

router.post(
  '/withdrawals',
  requireAuth,
  [
    body('starId').isString().notEmpty(),
    body('amount').isNumeric().toFloat().custom((v) => v > 0),
    body('note').optional().isString()
  ],
  createWithdrawal
);

router.get(
  '/withdrawals',
  requireAuth,
  [
    query('starId').optional().isString(),
    query('status').optional().isString(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 })
  ],
  listWithdrawals
);

export default router;


