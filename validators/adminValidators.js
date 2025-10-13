import { body } from 'express-validator';

// Admin Sign In Validator
export const adminSignInValidator = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail()
    .notEmpty()
    .withMessage('Email is required'),
  
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
    .notEmpty()
    .withMessage('Password is required')
];

// Admin Forgot Password Validator
export const adminForgotPasswordValidator = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail()
    .notEmpty()
    .withMessage('Email is required')
];

// Admin Reset Password Validator
export const adminResetPasswordValidator = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail()
    .notEmpty()
    .withMessage('Email is required'),
  
  body('otp')
    .isLength({ min: 6, max: 6 })
    .withMessage('OTP must be exactly 6 digits')
    .isNumeric()
    .withMessage('OTP must contain only numbers')
    .notEmpty()
    .withMessage('OTP is required'),
  
  body('token')
    .notEmpty()
    .withMessage('Token is required'),
  
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters long')
    .notEmpty()
    .withMessage('New password is required')
];

// Admin Change Password Validator
export const adminChangePasswordValidator = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters long')
    .notEmpty()
    .withMessage('New password is required')
];

// Create Admin Validator
export const createAdminValidator = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail()
    .notEmpty()
    .withMessage('Email is required'),
  
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
    .notEmpty()
    .withMessage('Password is required'),
  
  body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters')
    .notEmpty()
    .withMessage('Name is required')
];

// Update Admin Profile Validator
export const updateAdminProfileValidator = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),
  
  body('email')
    .optional()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail()
];
