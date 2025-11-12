import { validationResult } from 'express-validator';
import { getFirstValidationError } from '../utils/validationHelper.js';
import StarWallet from '../models/StarWallet.js';
import StarTransaction from '../models/StarTransaction.js';
import Withdrawal from '../models/Withdrawal.js';
import { withdrawFromJackpot } from '../services/starWalletService.js';

export const getAdminReport = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { starId, page = 1, limit = 20 } = req.query || {};
    const filter = {};
    if (starId) filter.starId = starId;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const skip = (pageNum - 1) * limitNum;

    const [walletAgg, txnAgg, wallets, transactions] = await Promise.all([
      StarWallet.aggregate([
        { $match: filter },
        { $group: { _id: null, escrow: { $sum: '$escrow' }, jackpot: { $sum: '$jackpot' }, totalEarned: { $sum: '$totalEarned' }, totalWithdrawn: { $sum: '$totalWithdrawn' } } }
      ]),
      StarTransaction.aggregate([
        { $match: { ...(starId ? { starId } : {}) } },
        { $group: { _id: '$type', amount: { $sum: '$amount' }, count: { $sum: 1 } } }
      ]),
      StarWallet.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limitNum),
      StarTransaction.find({ ...(starId ? { starId } : {}) }).sort({ createdAt: -1 }).skip(skip).limit(limitNum)
    ]);

    return res.json({
      success: true,
      message: 'Admin wallet report',
      data: {
        summary: walletAgg[0] || { escrow: 0, jackpot: 0, totalEarned: 0, totalWithdrawn: 0 },
        transactionsByType: txnAgg,
        wallets,
        transactions,
        pagination: { page: pageNum, limit: limitNum }
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const createWithdrawal = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessage = getFirstValidationError(errors);
      return res.status(400).json({ success: false, message: errorMessage || 'Validation failed' });
    }

    const { starId, amount, note } = req.body;
    const numericAmount = Number(amount);
    if (!starId) return res.status(400).json({ success: false, message: 'starId required' });
    if (!numericAmount || numericAmount <= 0) return res.status(400).json({ success: false, message: 'Invalid amount' });

    // Ensure jackpot has sufficient balance before creating request
    const wallet = await StarWallet.findOne({ starId });
    if (!wallet) return res.status(400).json({ success: false, message: 'Star wallet not found' });
    if (wallet.jackpot < numericAmount) return res.status(400).json({ success: false, message: 'Insufficient jackpot balance' });

    // Record withdrawal request
    const withdrawal = await Withdrawal.create({ starId, adminId: req.user._id, amount: numericAmount, status: 'approved', note });

    // Execute payout logically by moving funds from jackpot
    let payout;
    try {
      payout = await withdrawFromJackpot(starId, numericAmount, { adminId: req.user._id });
    } catch (err) {
      await Withdrawal.findByIdAndUpdate(withdrawal._id, { status: 'failed', processedAt: new Date(), metadata: { error: err.message } });
      return res.status(400).json({ success: false, message: 'Withdrawal failed: ' + err.message });
    }

    await Withdrawal.findByIdAndUpdate(withdrawal._id, { status: 'completed', processedAt: new Date() });

    return res.status(201).json({
      success: true,
      message: 'Withdrawal completed',
      data: {
        withdrawalId: withdrawal._id,
        wallet: payout.wallet,
        transaction: payout.starTransaction
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const listWithdrawals = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const { starId, status, page = 1, limit = 20 } = req.query || {};
    const filter = {};
    if (starId) filter.starId = starId;
    if (status) filter.status = status;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const skip = (pageNum - 1) * limitNum;

    const [totalCount, items] = await Promise.all([
      Withdrawal.countDocuments(filter),
      Withdrawal.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum)
    ]);

    return res.json({
      success: true,
      message: 'Withdrawals list',
      data: items,
      pagination: { page: pageNum, total: totalCount, limit: limitNum }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};


