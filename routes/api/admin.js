import express from 'express';
import {
  adminSignIn,
  adminForgotPassword,
  adminResetPassword,
  adminChangePassword,
  createAdmin,
  getAdminProfile,
  updateAdminProfile
} from '../../controllers/admin.js';
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

// Dashboard routes
router.use('/dashboard', adminDashboardRouter);

export default router;
