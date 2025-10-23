import express from 'express';
import { body, param, query } from 'express-validator';
import { requireAuth, requireRole } from '../../middlewares/auth.js';
import {
  getCallLogsStatistics,
  getCallLogsWithFilters,
  getCompletedCallLogs,
  getMissedCallLogs,
  getCallLogDetails,
  getCallLogsByStar,
  getCallLogsByUser,
  updateCallLogStatus,
  getCallLogAnalytics
} from '../../controllers/adminCallLogs.js';

const router = express.Router();

// Apply authentication and admin role middleware to all routes
router.use(requireAuth);
router.use(requireRole('admin'));

// Validation middleware
const callLogIdValidator = [
  param('callLogId').isMongoId().withMessage('Invalid call log ID')
];

const userIdValidator = [
  param('userId').isMongoId().withMessage('Invalid user ID')
];

const starIdValidator = [
  param('starId').isMongoId().withMessage('Invalid star ID')
];

const callLogFiltersValidator = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('status').optional().isIn(['all', 'completed', 'missed']).withMessage('Invalid status'),
  query('startDate').optional().isISO8601().withMessage('Start date must be a valid date'),
  query('endDate').optional().isISO8601().withMessage('End date must be a valid date'),
  query('search').optional().isString().withMessage('Search must be a string'),
  query('sortBy').optional().isIn(['createdAt', 'updatedAt', 'callDuration', 'price']).withMessage('Invalid sort field'),
  query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc')
];

const statisticsValidator = [
  query('period').optional().isIn(['current_month', 'last_month', 'current_year', 'last_7_days', 'last_30_days']).withMessage('Invalid period')
];

const analyticsValidator = [
  query('period').optional().isIn(['current_month', 'last_month', 'current_year', 'last_7_days', 'last_30_days']).withMessage('Invalid period'),
  query('groupBy').optional().isIn(['day', 'week', 'month']).withMessage('Invalid groupBy value')
];

const updateStatusValidator = [
  ...callLogIdValidator,
  body('status').isIn(['completed', 'missed']).withMessage('Status must be completed or missed'),
  body('actualDuration').optional().isNumeric().withMessage('Actual duration must be a number'),
  body('adminNotes').optional().isString().withMessage('Admin notes must be a string')
];

// Routes

// GET /api/admin/call-logs/statistics - Get call logs statistics
router.get('/statistics', statisticsValidator, getCallLogsStatistics);

// GET /api/admin/call-logs/analytics - Get call logs analytics
router.get('/analytics', analyticsValidator, getCallLogAnalytics);

// GET /api/admin/call-logs - Get call logs with filters
router.get('/', callLogFiltersValidator, getCallLogsWithFilters);

// GET /api/admin/call-logs/completed - Get completed call logs
router.get('/completed', callLogFiltersValidator, getCompletedCallLogs);

// GET /api/admin/call-logs/missed - Get missed call logs
router.get('/missed', callLogFiltersValidator, getMissedCallLogs);

// GET /api/admin/call-logs/:callLogId - Get call log details
router.get('/:callLogId', callLogIdValidator, getCallLogDetails);

// PUT /api/admin/call-logs/:callLogId/status - Update call log status
router.put('/:callLogId/status', updateStatusValidator, updateCallLogStatus);

// GET /api/admin/call-logs/star/:starId - Get call logs by star
router.get('/star/:starId', starIdValidator, callLogFiltersValidator, getCallLogsByStar);

// GET /api/admin/call-logs/user/:userId - Get call logs by user
router.get('/user/:userId', userIdValidator, callLogFiltersValidator, getCallLogsByUser);

export default router;
