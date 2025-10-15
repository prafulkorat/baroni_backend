import express from 'express';
import {
  getDashboardSummary,
  getRevenueInsights,
  getActiveUsersByCountry,
  getCostEvaluation,
  getServiceInsights,
  getTopStars,
  getCompleteDashboard,
  getServiceRevenueBreakdown,
  getDeviceChangeStats,
  getReportedUsersDetails,
  createEvent,
  getEvents,
  updateEventStatus
} from '../../controllers/adminDashboard.js';
import {
  dashboardSummaryValidator,
  revenueInsightsValidator,
  activeUsersByCountryValidator,
  costEvaluationValidator,
  serviceInsightsValidator,
  topStarsValidator,
  completeDashboardValidator,
  serviceRevenueBreakdownValidator,
  deviceChangeStatsValidator,
  reportedUsersDetailsValidator
} from '../../validators/adminDashboardValidators.js';
import { requireAuth, requireRole } from '../../middlewares/auth.js';

const router = express.Router();

// All dashboard routes require admin authentication
router.use(requireAuth);
router.use(requireRole('admin'));

// Dashboard Summary - Key Metrics
router.get('/summary', dashboardSummaryValidator, getDashboardSummary);

// Revenue Insights
router.get('/revenue', revenueInsightsValidator, getRevenueInsights);

// Active Users by Country
router.get('/active-users-by-country', activeUsersByCountryValidator, getActiveUsersByCountry);

// Cost Evaluation (Service Usage Minutes)
router.get('/cost-evaluation', costEvaluationValidator, getCostEvaluation);

// Service Insights (Detailed metrics for each service)
router.get('/service-insights/:serviceType', serviceInsightsValidator, getServiceInsights);

// Top Stars
router.get('/top-stars', topStarsValidator, getTopStars);

// Complete Dashboard Data (All in one)
router.get('/complete', completeDashboardValidator, getCompleteDashboard);

// Enhanced Service Revenue Breakdown
router.get('/service-revenue-breakdown', serviceRevenueBreakdownValidator, getServiceRevenueBreakdown);

// Device Change Tracking
router.get('/device-change-stats', deviceChangeStatsValidator, getDeviceChangeStats);

// Detailed Reported Users
router.get('/reported-users-details', reportedUsersDetailsValidator, getReportedUsersDetails);

// Event Management
router.post('/events', createEvent);
router.get('/events', getEvents);
router.patch('/events/:eventId/status', updateEventStatus);

export default router;
