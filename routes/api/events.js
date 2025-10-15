import express from 'express';
import { requireAuth, requireRole } from '../../middlewares/auth.js';
import { createEvent, getEvents, updateEventStatus } from '../../controllers/adminDashboard.js';
import { createEventValidator, getEventsValidator, updateEventStatusValidator } from '../../validators/adminDashboardValidators.js';

const router = express.Router();

// All event routes require admin authentication
router.use(requireAuth);
router.use(requireRole('admin'));

// Event Management Routes
router.post('/', createEventValidator, createEvent);
router.get('/', getEventsValidator, getEvents);
router.patch('/:eventId/status', updateEventStatusValidator, updateEventStatus);

export default router;
