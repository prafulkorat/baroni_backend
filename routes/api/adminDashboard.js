import express from 'express';
import {
  getDashboardSummary,
  getRevenueInsights,
  getActiveUsersByCountry,
  getCostEvaluation,
  getServiceInsights,
  getTopStars,
  getCompleteDashboard
} from '../../controllers/adminDashboard.js';
import {
  dashboardSummaryValidator,
  revenueInsightsValidator,
  activeUsersByCountryValidator,
  costEvaluationValidator,
  serviceInsightsValidator,
  topStarsValidator,
  completeDashboardValidator
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

export default router;
