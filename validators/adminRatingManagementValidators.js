import { body, param, query } from 'express-validator';

// Admin Get All Reviews Validation
export const adminGetAllReviewsValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('starId')
    .optional()
    .isMongoId()
    .withMessage('Star ID must be a valid MongoDB ObjectId'),
  query('reviewType')
    .optional()
    .isIn(['appointment', 'dedication', 'live_show', 'system'])
    .withMessage('Review type must be one of: appointment, dedication, live_show, system'),
  query('isVisible')
    .optional()
    .isIn(['true', 'false'])
    .withMessage('isVisible must be either true or false'),
  query('isDefaultRating')
    .optional()
    .isIn(['true', 'false'])
    .withMessage('isDefaultRating must be either true or false'),
  query('search')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search term must be between 1 and 100 characters'),
  query('sortBy')
    .optional()
    .isIn(['createdAt', 'updatedAt', 'rating', 'reviewType'])
    .withMessage('SortBy must be one of: createdAt, updatedAt, rating, reviewType'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('SortOrder must be either asc or desc')
];

// Update Review Visibility Validation
export const updateReviewVisibilityValidation = [
  param('reviewId')
    .isMongoId()
    .withMessage('Invalid review ID'),
  body('isVisible')
    .isBoolean()
    .withMessage('isVisible must be a boolean value')
];

// Bulk Update Review Visibility Validation
export const bulkUpdateReviewVisibilityValidation = [
  body('reviewIds')
    .isArray({ min: 1 })
    .withMessage('Review IDs must be a non-empty array'),
  body('reviewIds.*')
    .isMongoId()
    .withMessage('Each review ID must be a valid MongoDB ObjectId'),
  body('isVisible')
    .isBoolean()
    .withMessage('isVisible must be a boolean value')
];

// Get Stars with Default Ratings Validation
export const getStarsWithDefaultRatingsValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
];

// Get Review Statistics Validation (no validation needed, just for consistency)
export const getReviewStatisticsValidation = [];
