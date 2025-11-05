import { body, param, query } from 'express-validator';

// Validation for creating a support ticket
export const createSupportTicketValidator = [
  body('issueType')
    .trim()
    .isIn(['payment', 'technical', 'account', 'general', 'refund', 'booking', 'live_show', 'dedication', 'other', 'Autre'])
    .withMessage('Issue type must be one of: payment, technical, account, general, refund, booking, live_show, dedication, other, Autre'),
  body('description')
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage('Description must be between 1 and 2000 characters'),
  body('title')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Title must be between 1 and 200 characters')
];

// Validation for updating a support ticket
export const updateSupportTicketValidator = [
  param('id')
    .isMongoId()
    .withMessage('Invalid ticket ID'),
  body('issueType')
    .optional(),
  body('description')
    .optional()
    .trim()
];

// Validation for getting a specific support ticket
export const getSupportTicketByIdValidator = [
  param('id')
    .isMongoId()
    .withMessage('Invalid ticket ID')
];

// Validation for deleting a support ticket
export const deleteSupportTicketValidator = [
  param('id')
    .isMongoId()
    .withMessage('Invalid ticket ID')
];

// Validation for admin getting all tickets
export const adminGetAllTicketsValidator = [
  query('issueType')
    .optional()
];
