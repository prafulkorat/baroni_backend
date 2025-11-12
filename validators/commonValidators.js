import { body, param, query } from 'express-validator';

export const idParamValidator = [param('id').isMongoId()];

export const trackingIdParamValidator = [param('trackingId').isString().trim().notEmpty().matches(/^BAR-[A-Z0-9]{5}$/)];

export const typePriceBodyValidator = [
  body('type').isString().trim().notEmpty(),
  body('price').isFloat({ min: 0 }),
];

export const paginationQueryValidator = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
];

export const appointmentStatusQueryValidator = [
  query('status').optional().isIn(['pending', 'approved', 'rejected', 'cancelled', 'completed']).withMessage('Status must be one of: pending, approved, rejected, cancelled, completed'),
];





















