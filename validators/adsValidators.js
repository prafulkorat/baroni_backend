import { body, param, query } from 'express-validator';

// Common validation rules
const titleValidation = body('title')
  .trim()
  .isLength({ min: 1, max: 100 })
  .withMessage('Title must be between 1 and 100 characters');

const linkValidation = body('link')
  .optional()
  .trim()
  .isURL()
  .withMessage('Link must be a valid URL');

const budgetValidation = body('budget')
  .optional()
  .isFloat({ min: 0 })
  .withMessage('Budget must be a positive number');

const targetAudienceValidation = body('targetAudience')
  .optional()
  .isIn(['all', 'fans', 'stars', 'specific_country'])
  .withMessage('Target audience must be one of: all, fans, stars, specific_country');

const targetCountryValidation = body('targetCountry')
  .optional()
  .trim()
  .isLength({ min: 2, max: 2 })
  .withMessage('Target country must be a 2-letter country code');

const priorityValidation = body('priority')
  .optional()
  .isIn(['low', 'medium', 'high', 'urgent'])
  .withMessage('Priority must be one of: low, medium, high, urgent');

const statusValidation = body('status')
  .optional()
  .isIn(['active', 'paused', 'draft', 'expired'])
  .withMessage('Status must be one of: active, paused, draft, expired');

const dateValidation = (field) => body(field)
  .optional()
  .isISO8601()
  .withMessage(`${field} must be a valid ISO 8601 date`);

// Create Ad Validation
export const createAdValidation = [
  titleValidation,
  linkValidation,
  budgetValidation,
  targetAudienceValidation,
  targetCountryValidation,
  priorityValidation,
  dateValidation('startDate'),
  dateValidation('endDate'),
  body('endDate')
    .optional()
    .custom((value, { req }) => {
      if (value && req.body.startDate) {
        const startDate = new Date(req.body.startDate);
        const endDate = new Date(value);
        if (endDate <= startDate) {
          throw new Error('End date must be after start date');
        }
      }
      return true;
    })
];

// Update Ad Validation
export const updateAdValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid ad ID'),
  titleValidation,
  linkValidation,
  budgetValidation,
  targetAudienceValidation,
  targetCountryValidation,
  priorityValidation,
  statusValidation,
  dateValidation('startDate'),
  dateValidation('endDate'),
  body('endDate')
    .optional()
    .custom((value, { req }) => {
      if (value && req.body.startDate) {
        const startDate = new Date(req.body.startDate);
        const endDate = new Date(value);
        if (endDate <= startDate) {
          throw new Error('End date must be after start date');
        }
      }
      return true;
    })
];

// Get Ad Validation
export const getAdValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid ad ID')
];

// Delete Ad Validation
export const deleteAdValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid ad ID')
];

// Get User Ads Validation
export const getUserAdsValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('status')
    .optional()
    .isIn(['active', 'paused', 'draft', 'expired'])
    .withMessage('Status must be one of: active, paused, draft, expired'),
  query('sortBy')
    .optional()
    .isIn(['createdAt', 'updatedAt', 'title', 'status', 'priority', 'startDate', 'endDate'])
    .withMessage('SortBy must be one of: createdAt, updatedAt, title, status, priority, startDate, endDate'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('SortOrder must be either asc or desc')
];

// Get Active Ads Validation (Public)
export const getActiveAdsValidation = [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50'),
  query('country')
    .optional()
    .trim()
    .isLength({ min: 2, max: 2 })
    .withMessage('Country must be a 2-letter country code'),
  query('audience')
    .optional()
    .isIn(['all', 'fans', 'stars'])
    .withMessage('Audience must be one of: all, fans, stars')
];

// Track Ad Click Validation
export const trackAdClickValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid ad ID')
];

// Get Ad Analytics Validation
export const getAdAnalyticsValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid ad ID')
];
