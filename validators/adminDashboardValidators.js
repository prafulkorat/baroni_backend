import { query } from 'express-validator';

// Dashboard Summary Validator
export const dashboardSummaryValidator = [
  query('period')
    .optional()
    .isIn(['current_month', 'last_month', 'last_7_days', 'last_30_days'])
    .withMessage('Period must be one of: current_month, last_month, last_7_days, last_30_days')
];

// Revenue Insights Validator
export const revenueInsightsValidator = [
  query('period')
    .optional()
    .isIn(['current_month', 'last_month', 'last_7_days', 'last_30_days'])
    .withMessage('Period must be one of: current_month, last_month, last_7_days, last_30_days')
];

// Active Users by Country Validator
export const activeUsersByCountryValidator = [
  query('period')
    .optional()
    .isIn(['current_month', 'last_month', 'last_7_days', 'last_30_days'])
    .withMessage('Period must be one of: current_month, last_month, last_7_days, last_30_days'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
];

// Cost Evaluation Validator
export const costEvaluationValidator = [
  query('period')
    .optional()
    .isIn(['current_month', 'last_month', 'last_7_days', 'last_30_days'])
    .withMessage('Period must be one of: current_month, last_month, last_7_days, last_30_days')
];

// Service Insights Validator
export const serviceInsightsValidator = [
  query('serviceType')
    .isIn(['video-call', 'live-show', 'dedication'])
    .withMessage('Service type must be one of: video-call, live-show, dedication'),
  
  query('period')
    .optional()
    .isIn(['current_month', 'last_month', 'last_7_days', 'last_30_days'])
    .withMessage('Period must be one of: current_month, last_month, last_7_days, last_30_days')
];

// Top Stars Validator
export const topStarsValidator = [
  query('period')
    .optional()
    .isIn(['current_month', 'last_month', 'last_7_days', 'last_30_days'])
    .withMessage('Period must be one of: current_month, last_month, last_7_days, last_30_days'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  query('sortBy')
    .optional()
    .isIn(['revenue', 'engagement'])
    .withMessage('Sort by must be one of: revenue, engagement')
];

// Complete Dashboard Validator
export const completeDashboardValidator = [
  query('period')
    .optional()
    .isIn(['current_month', 'last_month', 'last_7_days', 'last_30_days'])
    .withMessage('Period must be one of: current_month, last_month, last_7_days, last_30_days')
];
