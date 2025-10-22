import express from 'express';
import {
  adminSignIn,
  adminForgotPassword,
  adminResetPassword,
  adminChangePassword,
  createAdmin,
  getAdminProfile,
  updateAdminProfile,
  databaseCleanup
} from '../../controllers/admin.js';
import {
  toggleFeaturedStar,
  getFeaturedStars,
  bulkUpdateFeaturedStars
} from '../../controllers/starManagement.js';
import adminDashboardRouter from './adminDashboard.js';
import {
  adminSignInValidator,
  adminForgotPasswordValidator,
  adminResetPasswordValidator,
  adminChangePasswordValidator,
  createAdminValidator,
  updateAdminProfileValidator
} from '../../validators/adminValidators.js';
import { requireAuth, requireRole } from '../../middlewares/auth.js';

const router = express.Router();

// Public admin routes (no authentication required)
router.post('/signin', adminSignInValidator, adminSignIn);
router.post('/forgot-password', adminForgotPasswordValidator, adminForgotPassword);
router.post('/reset-password', adminResetPasswordValidator, adminResetPassword);
router.post('/create', createAdminValidator, createAdmin); // For initial admin setup

// Protected admin routes (authentication required)
router.get('/profile', requireAuth, requireRole('admin'), getAdminProfile);
router.put('/profile', requireAuth, requireRole('admin'), updateAdminProfileValidator, updateAdminProfile);
router.post('/change-password', requireAuth, requireRole('admin'), adminChangePasswordValidator, adminChangePassword);

// Database cleanup route (password protected)
router.post('/database-cleanup', databaseCleanup);

// Dashboard routes
router.use('/dashboard', adminDashboardRouter);

// Featured Star Management routes
router.patch('/stars/:starId/feature', requireAuth, requireRole('admin'), toggleFeaturedStar);
router.get('/featured-stars', requireAuth, requireRole('admin'), getFeaturedStars);
router.patch('/stars/bulk-feature', requireAuth, requireRole('admin'), bulkUpdateFeaturedStars);

// Debug endpoint to check featured stars count
router.get('/debug/featured-stars-count', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const User = (await import('../../models/User.js')).default;
    
    const totalFeaturedStars = await User.countDocuments({
      role: 'star',
      feature_star: true,
      isDeleted: { $ne: true }
    });

    const featuredStarsWithCompleteProfile = await User.countDocuments({
      role: 'star',
      feature_star: true,
      isDeleted: { $ne: true },
      name: { $exists: true, $ne: null, $ne: '' },
      pseudo: { $exists: true, $ne: null, $ne: '' },
      about: { $exists: true, $ne: null, $ne: '' },
      profession: { $exists: true, $ne: null }
    });

    const featuredStarsBasic = await User.countDocuments({
      role: 'star',
      feature_star: true,
      isDeleted: { $ne: true },
      name: { $exists: true, $ne: null, $ne: '' },
      pseudo: { $exists: true, $ne: null, $ne: '' }
    });

    res.json({
      success: true,
      data: {
        totalFeaturedStars,
        featuredStarsWithCompleteProfile,
        featuredStarsBasic,
        message: `Total: ${totalFeaturedStars}, Complete Profile: ${featuredStarsWithCompleteProfile}, Basic: ${featuredStarsBasic}`
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to get featured stars count',
      error: err.message
    });
  }
});

// Debug endpoint to test Orange Money API connection
router.get('/debug/orange-money-test', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const orangeMoneyService = (await import('../../services/orangeMoneyService.js')).default;
    
    const testResult = await orangeMoneyService.testConnection();
    
    res.json({
      success: testResult.success,
      message: testResult.message,
      data: testResult
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to test Orange Money connection',
      error: err.message
    });
  }
});

// Debug endpoint to test coin deduction logic
router.post('/debug/test-coin-deduction', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { userId, amount, userPhone } = req.body;
    
    if (!userId || !amount || !userPhone) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: userId, amount, userPhone'
      });
    }

    const User = (await import('../../models/User.js')).default;
    const { createHybridTransaction } = await import('../../services/transactionService.js');
    const { TRANSACTION_TYPES } = await import('../../utils/transactionConstants.js');
    
    // Get user's current coin balance
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const initialCoinBalance = user.coinBalance || 0;
    
    console.log(`[Debug] Testing coin deduction for user ${userId}:`, {
      initialCoinBalance,
      testAmount: amount,
      userPhone
    });

    // Test the transaction (this will actually deduct coins)
    const transactionResult = await createHybridTransaction({
      type: TRANSACTION_TYPES.BECOME_STAR_PAYMENT,
      payerId: userId,
      receiverId: userId, // Use same user as receiver for test
      amount: parseFloat(amount),
      description: 'Test coin deduction',
      userPhone,
      starName: user.name || '',
      metadata: { test: true }
    });

    // Get updated coin balance
    const updatedUser = await User.findById(userId);
    const finalCoinBalance = updatedUser.coinBalance || 0;
    const coinsDeducted = initialCoinBalance - finalCoinBalance;

    res.json({
      success: true,
      message: 'Coin deduction test completed',
      data: {
        userId,
        testAmount: parseFloat(amount),
        initialCoinBalance,
        finalCoinBalance,
        coinsDeducted,
        transactionResult: {
          paymentMode: transactionResult.paymentMode,
          coinAmount: transactionResult.coinAmount,
          externalAmount: transactionResult.externalAmount,
          externalPaymentId: transactionResult.externalPaymentId
        },
        analysis: {
          hadEnoughCoins: initialCoinBalance >= parseFloat(amount),
          usedCoinsOnly: transactionResult.paymentMode === 'coin',
          usedHybridPayment: transactionResult.paymentMode === 'hybrid',
          coinsDeductedCorrectly: coinsDeducted === transactionResult.coinAmount
        }
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to test coin deduction',
      error: err.message
    });
  }
});

// Debug endpoint to check and fix pseudo uniqueness issues
router.get('/debug/check-pseudo-indexes', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const mongoose = (await import('mongoose')).default;
    const db = mongoose.connection.db;
    
    // Get all indexes on the users collection
    const indexes = await db.collection('users').indexes();
    
    // Check for pseudo-related indexes
    const pseudoIndexes = indexes.filter(index => 
      index.key && index.key.pseudo !== undefined
    );
    
    // Check for any unique indexes on pseudo
    const uniquePseudoIndexes = pseudoIndexes.filter(index => 
      index.unique === true
    );
    
    res.json({
      success: true,
      message: 'Pseudo index analysis completed',
      data: {
        totalIndexes: indexes.length,
        pseudoIndexes: pseudoIndexes.map(idx => ({
          name: idx.name,
          key: idx.key,
          unique: idx.unique,
          sparse: idx.sparse
        })),
        uniquePseudoIndexes: uniquePseudoIndexes.map(idx => ({
          name: idx.name,
          key: idx.key,
          unique: idx.unique,
          sparse: idx.sparse
        })),
        hasUniquePseudoIndex: uniquePseudoIndexes.length > 0,
        recommendation: uniquePseudoIndexes.length > 0 
          ? 'Remove unique indexes on pseudo field' 
          : 'Pseudo indexes are correctly configured'
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to check pseudo indexes',
      error: err.message
    });
  }
});

// Debug endpoint to test multiple users with same pseudo
router.post('/debug/test-same-pseudo', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { pseudo, count = 3 } = req.body;
    
    if (!pseudo || typeof pseudo !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Pseudo is required and must be a string'
      });
    }

    const User = (await import('../../models/User.js')).default;
    
    // Test creating multiple users with the same pseudo
    const testUsers = [];
    const errors = [];
    
    for (let i = 0; i < count; i++) {
      try {
        const testUser = new User({
          name: `Test User ${i + 1}`,
          pseudo: pseudo,
          email: `test${i + 1}@example.com`,
          contact: `+123456789${i}`,
          role: 'fan'
        });
        
        await testUser.save();
        testUsers.push({
          id: testUser._id,
          name: testUser.name,
          pseudo: testUser.pseudo,
          email: testUser.email
        });
        
        console.log(`Successfully created user ${i + 1} with pseudo '${pseudo}'`);
      } catch (err) {
        console.error(`Failed to create user ${i + 1}:`, err.message);
        errors.push({
          userNumber: i + 1,
          error: err.message,
          code: err.code
        });
      }
    }
    
    // Clean up test users
    if (testUsers.length > 0) {
      const userIds = testUsers.map(u => u.id);
      await User.deleteMany({ _id: { $in: userIds } });
      console.log(`Cleaned up ${testUsers.length} test users`);
    }
    
    res.json({
      success: true,
      message: `Test completed for pseudo '${pseudo}'`,
      data: {
        requestedCount: count,
        successfulCreations: testUsers.length,
        failedCreations: errors.length,
        testUsers: testUsers,
        errors: errors,
        analysis: {
          canCreateMultipleUsersWithSamePseudo: errors.length === 0,
          pseudoUniquenessEnforced: errors.length > 0,
          successRate: `${((testUsers.length / count) * 100).toFixed(1)}%`
        }
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to test same pseudo',
      error: err.message
    });
  }
});

export default router;
