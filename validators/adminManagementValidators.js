import { body, query, param } from 'express-validator';

// User Management Validators
export const getAllUsersValidator = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('search')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Search term must be less than 100 characters'),
  query('role')
    .optional()
    .isIn(['fan', 'star', 'all'])
    .withMessage('Role must be fan, star, or all'),
  query('country')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Country must be less than 50 characters'),
  query('status')
    .optional()
    .isIn(['active', 'blocked', 'all'])
    .withMessage('Status must be active, blocked, or all'),
  query('sortBy')
    .optional()
    .isIn(['name', 'pseudo', 'email', 'role', 'country', 'createdAt', 'lastLoginAt'])
    .withMessage('Invalid sort field'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc')
];

export const getUserDetailsValidator = [
  param('userId')
    .isMongoId()
    .withMessage('Invalid user ID')
];

export const updateUserStatusValidator = [
  param('userId')
    .isMongoId()
    .withMessage('Invalid user ID'),
  body('action')
    .isIn(['block', 'unblock'])
    .withMessage('Action must be block or unblock'),
  body('reason')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Reason must be less than 500 characters')
];

export const updateUserRoleValidator = [
  param('userId')
    .isMongoId()
    .withMessage('Invalid user ID'),
  body('role')
    .isIn(['fan', 'star'])
    .withMessage('Role must be fan or star')
];

export const deleteUserValidator = [
  param('userId')
    .isMongoId()
    .withMessage('Invalid user ID'),
  body('reason')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Reason must be less than 500 characters')
];

export const getUserStatsValidator = [
  query('period')
    .optional()
    .isIn(['current_month', 'last_month', 'last_7_days', 'last_30_days'])
    .withMessage('Invalid period')
];

// Star Management Validators
export const getAllStarsValidator = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('search')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Search term must be less than 100 characters'),
  query('country')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Country must be less than 50 characters'),
  query('status')
    .optional()
    .isIn(['active', 'blocked', 'all'])
    .withMessage('Status must be active, blocked, or all'),
  query('sortBy')
    .optional()
    .isIn(['name', 'pseudo', 'email', 'country', 'createdAt', 'lastLoginAt'])
    .withMessage('Invalid sort field'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc')
];

export const getStarProfileValidator = [
  param('starId')
    .isMongoId()
    .withMessage('Invalid star ID')
];

export const updateStarProfileValidator = [
  param('starId')
    .isMongoId()
    .withMessage('Invalid star ID'),
  body('name')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be between 1 and 100 characters'),
  body('pseudo')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Pseudo must be between 1 and 50 characters'),
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Invalid email format'),
  body('contact')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 20 })
    .withMessage('Contact must be less than 20 characters'),
  body('profilePic')
    .optional()
    .isURL()
    .withMessage('Profile picture must be a valid URL'),
  body('country')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Country must be less than 50 characters'),
  body('profession')
    .optional()
    .isMongoId()
    .withMessage('Invalid profession ID'),
  body('about')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('About must be less than 1000 characters'),
  body('location')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Location must be less than 100 characters'),
  body('availableForBookings')
    .optional()
    .isBoolean()
    .withMessage('Available for bookings must be a boolean'),
  body('hidden')
    .optional()
    .isBoolean()
    .withMessage('Hidden must be a boolean'),
  body('appNotification')
    .optional()
    .isBoolean()
    .withMessage('App notification must be a boolean')
];

export const getStarServicesValidator = [
  param('starId')
    .isMongoId()
    .withMessage('Invalid star ID')
];

export const addStarServiceValidator = [
  param('starId')
    .isMongoId()
    .withMessage('Invalid star ID'),
  body('type')
    .isString()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Service type must be between 1 and 50 characters'),
  body('price')
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number')
];

export const updateStarServiceValidator = [
  param('starId')
    .isMongoId()
    .withMessage('Invalid star ID'),
  param('serviceId')
    .isMongoId()
    .withMessage('Invalid service ID'),
  body('type')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Service type must be between 1 and 50 characters'),
  body('price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number')
];

export const deleteStarServiceValidator = [
  param('starId')
    .isMongoId()
    .withMessage('Invalid star ID'),
  param('serviceId')
    .isMongoId()
    .withMessage('Invalid service ID')
];

export const getStarDedicationSamplesValidator = [
  param('starId')
    .isMongoId()
    .withMessage('Invalid star ID')
];

export const addStarDedicationSampleValidator = [
  param('starId')
    .isMongoId()
    .withMessage('Invalid star ID'),
  body('type')
    .isString()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Sample type must be between 1 and 50 characters'),
  body('video')
    .isURL()
    .withMessage('Video must be a valid URL'),
  body('description')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters')
];

export const updateStarDedicationSampleValidator = [
  param('starId')
    .isMongoId()
    .withMessage('Invalid star ID'),
  param('sampleId')
    .isMongoId()
    .withMessage('Invalid sample ID'),
  body('type')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Sample type must be between 1 and 50 characters'),
  body('video')
    .optional()
    .isURL()
    .withMessage('Video must be a valid URL'),
  body('description')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters')
];

export const deleteStarDedicationSampleValidator = [
  param('starId')
    .isMongoId()
    .withMessage('Invalid star ID'),
  param('sampleId')
    .isMongoId()
    .withMessage('Invalid sample ID')
];

// Review Management Validators
export const getAllReviewsValidator = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('search')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Search term must be less than 100 characters'),
  query('starId')
    .optional()
    .isMongoId()
    .withMessage('Invalid star ID'),
  query('reviewerId')
    .optional()
    .isMongoId()
    .withMessage('Invalid reviewer ID'),
  query('rating')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5'),
  query('reviewType')
    .optional()
    .isIn(['appointment', 'dedication', 'live_show', 'all'])
    .withMessage('Invalid review type'),
  query('sortBy')
    .optional()
    .isIn(['rating', 'createdAt', 'updatedAt'])
    .withMessage('Invalid sort field'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc')
];

export const getReviewDetailsValidator = [
  param('reviewId')
    .isMongoId()
    .withMessage('Invalid review ID')
];

export const updateReviewValidator = [
  param('reviewId')
    .isMongoId()
    .withMessage('Invalid review ID'),
  body('rating')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5'),
  body('comment')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Comment must be less than 500 characters')
];

export const deleteReviewValidator = [
  param('reviewId')
    .isMongoId()
    .withMessage('Invalid review ID')
];

export const getStarReviewsValidator = [
  param('starId')
    .isMongoId()
    .withMessage('Invalid star ID'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('rating')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5'),
  query('reviewType')
    .optional()
    .isIn(['appointment', 'dedication', 'live_show', 'all'])
    .withMessage('Invalid review type'),
  query('sortBy')
    .optional()
    .isIn(['rating', 'createdAt', 'updatedAt'])
    .withMessage('Invalid sort field'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc')
];

export const getReviewStatsValidator = [
  query('period')
    .optional()
    .isIn(['current_month', 'last_month', 'last_7_days', 'last_30_days'])
    .withMessage('Invalid period')
];

// Reported Users Management Validators
export const getAllReportedUsersValidator = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('search')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Search term must be less than 100 characters'),
  query('status')
    .optional()
    .isIn(['pending', 'reviewed', 'resolved', 'dismissed', 'all'])
    .withMessage('Invalid status'),
  query('reportedUserRole')
    .optional()
    .isIn(['star', 'fan', 'all'])
    .withMessage('Invalid reported user role'),
  query('country')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Country must be less than 50 characters'),
  query('sortBy')
    .optional()
    .isIn(['createdAt', 'updatedAt', 'status'])
    .withMessage('Invalid sort field'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc')
];

export const getReportedUserDetailsValidator = [
  param('reportId')
    .isMongoId()
    .withMessage('Invalid report ID')
];

export const updateReportStatusValidator = [
  param('reportId')
    .isMongoId()
    .withMessage('Invalid report ID'),
  body('status')
    .isIn(['pending', 'reviewed', 'resolved', 'dismissed'])
    .withMessage('Invalid status'),
  body('adminNotes')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Admin notes must be less than 1000 characters')
];

export const blockReportedUserValidator = [
  param('reportId')
    .isMongoId()
    .withMessage('Invalid report ID'),
  body('reason')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Reason must be less than 500 characters')
];

export const unblockReportedUserValidator = [
  param('reportId')
    .isMongoId()
    .withMessage('Invalid report ID'),
  body('reason')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Reason must be less than 500 characters')
];

export const deleteReportValidator = [
  param('reportId')
    .isMongoId()
    .withMessage('Invalid report ID')
];

export const getReportedUsersStatsValidator = [
  query('period')
    .optional()
    .isIn(['current_month', 'last_month', 'last_7_days', 'last_30_days'])
    .withMessage('Invalid period')
];
