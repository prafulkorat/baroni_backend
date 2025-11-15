import { body, query, param } from 'express-validator';

// Star-side validators
export const createWithdrawalRequestValidator = [
  body('amount')
    .notEmpty()
    .withMessage('Amount is required')
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be a positive number greater than 0'),
  body('note')
    .optional()
    .isString()
    .withMessage('Note must be a string')
    .isLength({ max: 500 })
    .withMessage('Note must not exceed 500 characters')
];

export const getMyWithdrawalRequestsValidator = [
  query('status')
    .optional()
    .isIn(['pending', 'approved', 'rejected'])
    .withMessage('Status must be one of: pending, approved, rejected'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
];

// Admin-side validators
export const listWithdrawalRequestsValidator = [
  query('status')
    .optional()
    .isIn(['all', 'pending', 'paid', 'failed', 'approved', 'rejected'])
    .withMessage('Status must be one of: all, pending, paid, failed, approved, rejected'),
  query('today')
    .optional()
    .isBoolean()
    .withMessage('Today must be a boolean'),
  query('from')
    .optional()
    .isISO8601()
    .withMessage('From date must be a valid ISO 8601 date'),
  query('to')
    .optional()
    .isISO8601()
    .withMessage('To date must be a valid ISO 8601 date'),
  query('q')
    .optional()
    .isString()
    .withMessage('Search query must be a string'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
];

export const approveWithdrawalRequestValidator = [
  param('id')
    .isMongoId()
    .withMessage('Invalid withdrawal request ID'),
  body('note')
    .optional()
    .isString()
    .withMessage('Note must be a string')
    .isLength({ max: 500 })
    .withMessage('Note must not exceed 500 characters')
];

export const rejectWithdrawalRequestValidator = [
  param('id')
    .isMongoId()
    .withMessage('Invalid withdrawal request ID'),
  body('reason')
    .notEmpty()
    .withMessage('Reason for rejection is required')
    .isString()
    .withMessage('Reason must be a string')
    .trim()
    .isLength({ min: 5, max: 500 })
    .withMessage('Reason must be between 5 and 500 characters'),
  body('note')
    .optional()
    .isString()
    .withMessage('Note must be a string')
    .trim()
    .isLength({ max: 500 })
    .withMessage('Note must not exceed 500 characters')
];

export const getWithdrawalRequestDetailsValidator = [
  param('id')
    .isMongoId()
    .withMessage('Invalid withdrawal request ID')
];

export const getWithdrawalMetricsValidator = [
  query('date')
    .optional()
    .isIn(['today'])
    .withMessage('Date must be "today"'),
  query('from')
    .optional()
    .isISO8601()
    .withMessage('From date must be a valid ISO 8601 date'),
  query('to')
    .optional()
    .isISO8601()
    .withMessage('To date must be a valid ISO 8601 date')
];

