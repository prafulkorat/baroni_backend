import { body } from 'express-validator';

export const createReportValidator = [
  body('reportedUserId').notEmpty().withMessage('reportedUserId is required').isMongoId().withMessage('Invalid user ID'),
  body('reason').optional().isString().withMessage('Reason must be a string'),
  body('description').optional().isString().withMessage('Description must be a string')
];

export const updateReportValidator = [
  body('reportedUserId').optional().isMongoId().withMessage('Invalid user ID'),
  body('reporterId').optional().isMongoId().withMessage('Invalid user ID')
];
