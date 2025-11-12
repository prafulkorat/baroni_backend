import express from 'express';
import { requireAuth, requireRole } from '../../middlewares/auth.js';
import { uploadMixed } from '../../middlewares/upload.js';
import {
  createSupportTicket,
  getUserSupportTickets,
  getSupportTicketById,
  updateSupportTicket,
  deleteSupportTicket,
  getAllSupportTickets,
  updateTicketStatus,
  assignTicket,
  addMessageToTicket,
  getTicketStatistics,
  getAdminUsers
} from '../../controllers/supportManager.js';
import {
  createSupportTicketValidation,
  updateSupportTicketValidation,
  getSupportTicketValidation,
  deleteSupportTicketValidation,
  adminGetAllTicketsValidation,
  updateTicketStatusValidation,
  assignTicketValidation,
  addMessageValidation,
  getTicketStatisticsValidation,
  getAdminUsersValidation
} from '../../validators/supportManagerValidators.js';

const router = express.Router();

// User routes (authentication required)
router.use(requireAuth);

// Create a new support ticket
router.post(
  '/',
  uploadMixed.single('image'),
  createSupportTicketValidation,
  createSupportTicket
);

// Get user's own support tickets
router.get(
  '/my-tickets',
  getUserSupportTickets
);

// Get a specific support ticket by ID
router.get(
  '/:id',
  getSupportTicketValidation,
  getSupportTicketById
);

// Update a support ticket (user can update their own tickets)
router.put(
  '/:id',
  uploadMixed.single('image'),
  updateSupportTicketValidation,
  updateSupportTicket
);

// Delete a support ticket (soft delete)
router.delete(
  '/:id',
  deleteSupportTicketValidation,
  deleteSupportTicket
);

// Add message to ticket
router.post(
  '/:id/message',
  addMessageValidation,
  addMessageToTicket
);

// Admin routes (require admin role)
router.use(requireRole('admin'));

// Get all support tickets with filtering and search
router.get(
  '/admin/all',
  adminGetAllTicketsValidation,
  getAllSupportTickets
);

// Update ticket status (admin only)
router.put(
  '/admin/:id/status',
  updateTicketStatusValidation,
  updateTicketStatus
);

// Assign ticket to admin
router.put(
  '/admin/:id/assign',
  assignTicketValidation,
  assignTicket
);

// Get ticket statistics for dashboard
router.get(
  '/admin/statistics',
  getTicketStatisticsValidation,
  getTicketStatistics
);

// Get admin users for assignment
router.get(
  '/admin/users',
  getAdminUsersValidation,
  getAdminUsers
);

export default router;
