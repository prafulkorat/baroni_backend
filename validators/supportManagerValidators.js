import { body, param, query } from 'express-validator';

// Common validation rules
const issueTypeValidation = body('issueType')
  .trim()
  .isIn(['payment', 'technical', 'account', 'general', 'refund', 'booking', 'live_show', 'dedication', 'other', 'Autre'])
  .withMessage('Issue type must be one of: payment, technical, account, general, refund, booking, live_show, dedication, other, Autre');

const titleValidation = body('title')
  .optional()
  .trim()
  .isLength({ min: 1, max: 200 })
  .withMessage('Title must be between 1 and 200 characters');

const descriptionValidation = body('description')
  .trim()
  .isLength({ min: 1, max: 2000 })
  .withMessage('Description must be between 1 and 2000 characters');

const priorityValidation = body('priority')
  .optional()
  .isIn(['low', 'medium', 'high', 'urgent'])
  .withMessage('Priority must be one of: low, medium, high, urgent');

const categoryValidation = body('category')
  .optional()
  .isIn(['billing', 'technical', 'account', 'feature_request', 'bug_report', 'general'])
  .withMessage('Category must be one of: billing, technical, account, feature_request, bug_report, general');

const statusValidation = body('status')
  .isIn(['open', 'in_progress', 'resolved', 'closed', 'cancelled'])
  .withMessage('Status must be one of: open, in_progress, resolved, closed, cancelled');

const messageValidation = body('message')
  .trim()
  .isLength({ min: 1, max: 1000 })
  .withMessage('Message must be between 1 and 1000 characters');

const assignedToValidation = body('assignedTo')
  .isMongoId()
  .withMessage('Assigned admin ID must be a valid MongoDB ObjectId');

// Create Support Ticket Validation
export const createSupportTicketValidation = [
  issueTypeValidation,
  titleValidation,
  descriptionValidation,
  priorityValidation,
  categoryValidation
];

// Update Support Ticket Validation
export const updateSupportTicketValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid ticket ID'),
  issueTypeValidation,
  titleValidation,
  descriptionValidation,
  priorityValidation,
  categoryValidation
];

// Get Support Ticket Validation
export const getSupportTicketValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid ticket ID')
];

// Delete Support Ticket Validation
export const deleteSupportTicketValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid ticket ID')
];

// Admin Get All Tickets Validation
export const adminGetAllTicketsValidation = [
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
    .isIn(['open', 'in_progress', 'resolved', 'closed', 'cancelled'])
    .withMessage('Status must be one of: open, in_progress, resolved, closed, cancelled'),
  query('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Priority must be one of: low, medium, high, urgent'),
  query('issueType')
    .optional()
    .isIn(['payment', 'technical', 'account', 'general', 'refund', 'booking', 'live_show', 'dedication', 'other', 'Autre'])
    .withMessage('Issue type must be one of: payment, technical, account, general, refund, booking, live_show, dedication, other, Autre'),
  query('search')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search term must be between 1 and 100 characters'),
  query('sortBy')
    .optional()
    .isIn(['createdAt', 'updatedAt', 'lastActivityAt', 'priority', 'status', 'title'])
    .withMessage('SortBy must be one of: createdAt, updatedAt, lastActivityAt, priority, status, title'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('SortOrder must be either asc or desc'),
  query('assignedTo')
    .optional()
    .isMongoId()
    .withMessage('Assigned admin ID must be a valid MongoDB ObjectId')
];

// Update Ticket Status Validation
export const updateTicketStatusValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid ticket ID'),
  statusValidation,
  body('message')
    .optional()
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Message must be between 1 and 1000 characters')
];

// Assign Ticket Validation
export const assignTicketValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid ticket ID'),
  assignedToValidation
];

// Add Message Validation
export const addMessageValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid ticket ID'),
  messageValidation,
  body('isInternal')
    .optional()
    .isBoolean()
    .withMessage('isInternal must be a boolean value')
];

// Search Tickets Validation
export const searchTicketsValidation = [
  query('search')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search term must be between 1 and 100 characters'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50')
];

// Filter Tickets by Status Validation
export const filterTicketsByStatusValidation = [
  query('status')
    .isIn(['all', 'open', 'in_progress', 'resolved', 'closed', 'cancelled'])
    .withMessage('Status must be one of: all, open, in_progress, resolved, closed, cancelled'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50')
];

// Get Ticket Statistics Validation (no validation needed, just for consistency)
export const getTicketStatisticsValidation = [];

// Get Admin Users Validation (no validation needed, just for consistency)
export const getAdminUsersValidation = [];
