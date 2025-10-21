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

export default router;
