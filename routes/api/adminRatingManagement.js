import express from 'express';
import { requireAuth, requireRole } from '../../middlewares/auth.js';
import {
  getAllReviews,
  updateReviewVisibility,
  bulkUpdateReviewVisibility,
  getReviewStatistics,
  getStarsWithDefaultRatings
} from '../../controllers/adminRatingManagement.js';
import {
  adminGetAllReviewsValidation,
  updateReviewVisibilityValidation,
  bulkUpdateReviewVisibilityValidation,
  getReviewStatisticsValidation,
  getStarsWithDefaultRatingsValidation
} from '../../validators/adminRatingManagementValidators.js';

const router = express.Router();

// All routes require admin authentication
router.use(requireAuth);
router.use(requireRole('admin'));

// Get all reviews with filtering and search
router.get(
  '/reviews',
  adminGetAllReviewsValidation,
  getAllReviews
);

// Update review visibility
router.put(
  '/reviews/:reviewId/visibility',
  updateReviewVisibilityValidation,
  updateReviewVisibility
);

// Bulk update review visibility
router.put(
  '/reviews/bulk-visibility',
  bulkUpdateReviewVisibilityValidation,
  bulkUpdateReviewVisibility
);

// Get review statistics
router.get(
  '/statistics',
  getReviewStatisticsValidation,
  getReviewStatistics
);

// Get stars with default ratings
router.get(
  '/stars-with-default-ratings',
  getStarsWithDefaultRatingsValidation,
  getStarsWithDefaultRatings
);

export default router;
