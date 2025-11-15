import { validationResult } from 'express-validator';
import { getFirstValidationError } from '../utils/validationHelper.js';
import JackpotWithdrawalRequest from '../models/JackpotWithdrawalRequest.js';
import StarWallet from '../models/StarWallet.js';
import { getOrCreateStarWallet } from '../services/starWalletService.js';

/**
 * Create jackpot withdrawal request (Star side)
 * POST /api/star/jackpot/withdrawal-request
 */
export const createWithdrawalRequest = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessage = getFirstValidationError(errors);
      return res.status(400).json({
        success: false,
        message: errorMessage || 'Validation failed'
      });
    }

    // Only stars can create withdrawal requests
    if (req.user.role !== 'star') {
      return res.status(403).json({
        success: false,
        message: 'Only stars can create withdrawal requests'
      });
    }

    const { amount, note } = req.body;
    const numericAmount = Number(amount);
    
    if (!numericAmount || numericAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid amount. Amount must be greater than 0'
      });
    }

    const starId = req.user._id;

    // Check if star has sufficient jackpot balance
    const wallet = await getOrCreateStarWallet(starId);
    if (!wallet) {
      return res.status(404).json({
        success: false,
        message: 'Star wallet not found'
      });
    }

    if (wallet.jackpot < numericAmount) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient jackpot balance',
        data: {
          availableBalance: wallet.jackpot,
          requestedAmount: numericAmount
        }
      });
    }

    // Check if there's already a pending request
    const existingPendingRequest = await JackpotWithdrawalRequest.findOne({
      starId,
      status: 'pending'
    });

    if (existingPendingRequest) {
      return res.status(400).json({
        success: false,
        message: 'You already have a pending withdrawal request. Please wait for admin approval or cancel the existing request.',
        data: {
          existingRequestId: existingPendingRequest._id,
          existingAmount: existingPendingRequest.amount
        }
      });
    }

    // Create withdrawal request with pending status
    const withdrawalRequest = await JackpotWithdrawalRequest.create({
      starId,
      amount: numericAmount,
      status: 'pending',
      note: note || undefined
    });

    // Populate star details
    await withdrawalRequest.populate('starId', 'name pseudo profilePic baroniId country contact');

    return res.status(201).json({
      success: true,
      message: 'Withdrawal request created successfully. Waiting for admin approval.',
      data: {
        id: withdrawalRequest._id,
        amount: withdrawalRequest.amount,
        status: withdrawalRequest.status,
        note: withdrawalRequest.note,
        createdAt: withdrawalRequest.createdAt,
        availableBalance: wallet.jackpot
      }
    });
  } catch (err) {
    console.error('Error creating withdrawal request:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to create withdrawal request',
      error: err.message
    });
  }
};

/**
 * Get star's withdrawal requests (Star side)
 * GET /api/star/jackpot/withdrawal-requests
 */
export const getMyWithdrawalRequests = async (req, res) => {
  try {
    // Only stars can view their own requests
    if (req.user.role !== 'star') {
      return res.status(403).json({
        success: false,
        message: 'Only stars can view withdrawal requests'
      });
    }

    const { status, page = 1, limit = 20 } = req.query;
    const starId = req.user._id;

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));

    const filter = { starId };
    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      filter.status = status;
    }

    const total = await JackpotWithdrawalRequest.countDocuments(filter);
    const requests = await JackpotWithdrawalRequest.find(filter)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean();

    // Get current wallet balance
    const wallet = await getOrCreateStarWallet(starId);

    return res.json({
      success: true,
      message: 'Withdrawal requests retrieved successfully',
      data: {
        items: requests,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(total / limitNum),
          totalCount: total,
          limit: limitNum,
          hasNextPage: pageNum < Math.ceil(total / limitNum),
          hasPrevPage: pageNum > 1
        },
        currentBalance: {
          jackpot: wallet.jackpot,
          escrow: wallet.escrow,
          totalEarned: wallet.totalEarned,
          totalWithdrawn: wallet.totalWithdrawn
        }
      }
    });
  } catch (err) {
    console.error('Error getting withdrawal requests:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve withdrawal requests',
      error: err.message
    });
  }
};

/**
 * Get star's wallet balance (Star side)
 * GET /api/star/jackpot/balance
 */
export const getMyWalletBalance = async (req, res) => {
  try {
    // Only stars can view their wallet
    if (req.user.role !== 'star') {
      return res.status(403).json({
        success: false,
        message: 'Only stars can view wallet balance'
      });
    }

    const starId = req.user._id;
    const wallet = await getOrCreateStarWallet(starId);

    // Get pending withdrawal requests count and total amount
    const pendingRequests = await JackpotWithdrawalRequest.aggregate([
      {
        $match: {
          starId: wallet.starId,
          status: 'pending'
        }
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);

    const pendingInfo = pendingRequests[0] || { count: 0, totalAmount: 0 };

    return res.json({
      success: true,
      message: 'Wallet balance retrieved successfully',
      data: {
        wallet: {
          jackpot: wallet.jackpot,
          escrow: wallet.escrow,
          totalEarned: wallet.totalEarned,
          totalWithdrawn: wallet.totalWithdrawn,
          availableForWithdrawal: wallet.jackpot - pendingInfo.totalAmount
        },
        pendingWithdrawals: {
          count: pendingInfo.count,
          totalAmount: pendingInfo.totalAmount
        }
      }
    });
  } catch (err) {
    console.error('Error getting wallet balance:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve wallet balance',
      error: err.message
    });
  }
};

