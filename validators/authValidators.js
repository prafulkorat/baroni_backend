import { body } from 'express-validator';

export const registerValidator = [
  body('contact')
    .optional()
    .trim()
    .customSanitizer((v) => {
      if (typeof v !== 'string') return v;
      const noSpaces = v.replace(/\s+/g, '');
      // Ensure the number starts with '+' for international format
      return noSpaces.startsWith('+') ? noSpaces : `+${noSpaces}`;
    })
    .custom((value) => {
      if (!value) return true; // Allow empty values since it's optional
      // More flexible validation for international phone numbers
      const phoneRegex = /^\+[1-9]\d{6,14}$/;
      if (!phoneRegex.test(value)) {
        throw new Error('Invalid contact number format. Use international format, e.g. +22376299719');
      }
      return true;
    }),
  body('email').optional().isEmail().withMessage('Invalid email format'),
  body('password').optional().isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  // SECURITY FIX: Removed role field from registration - users always created as 'fan'
  body('fcmToken').optional().isString().withMessage('FCM token must be a string'),
  body('apnsToken').optional().isString().withMessage('APNs token must be a string'),
  body('voipToken').optional().isString().withMessage('VoIP token must be a string')
];

export const loginValidator = [
  body('contact')
    .optional()
    .trim()
    .customSanitizer((v) => {
      if (typeof v !== 'string') return v;
      const noSpaces = v.replace(/\s+/g, '');
      // Ensure the number starts with '+' for international format
      return noSpaces.startsWith('+') ? noSpaces : `+${noSpaces}`;
    })
    .custom((value) => {
      if (!value) return true; // Allow empty values since it's optional
      // More flexible validation for international phone numbers
      const phoneRegex = /^\+[1-9]\d{6,14}$/;
      if (!phoneRegex.test(value)) {
        throw new Error('Invalid contact number format. Use international format, e.g. +22376299719');
      }
      return true;
    }),
  body('email').optional().isEmail().withMessage('Invalid email format'),
  body('isMobile').optional().isBoolean().withMessage('isMobile must be a boolean'),
  body('password').optional().isString().withMessage('Password must be a string'),
  body('fcmToken').optional().isString().withMessage('FCM token must be a string'),
  body('apnsToken').optional().isString().withMessage('APNs token must be a string'),
  body('voipToken').optional().isString().withMessage('VoIP token must be a string')
];

export const completeProfileValidator = [
  body('name').optional().trim().isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters'),
  body('pseudo').optional().trim().isLength({ min: 3, max: 30 }).withMessage('Pseudo must be between 3 and 30 characters'),
  body('preferredLanguage').optional().trim().isLength({ max: 10 }).withMessage('Preferred language must be less than 10 characters'),
  body('country').optional().trim().isLength({ max: 50 }).withMessage('Country must be less than 50 characters'),
  body('email').optional().isEmail().withMessage('Invalid email format'),
  body('contact')
    .optional()
    .trim()
    .customSanitizer((v) => {
      if (typeof v !== 'string') return v;
      const noSpaces = v.replace(/\s+/g, '');
      // Ensure the number starts with '+' for international format
      return noSpaces.startsWith('+') ? noSpaces : `+${noSpaces}`;
    })
    .custom((value) => {
      if (!value) return true; // Allow empty values since it's optional
      // More flexible validation for international phone numbers
      const phoneRegex = /^\+[1-9]\d{6,14}$/;
      if (!phoneRegex.test(value)) {
        throw new Error('Invalid contact number format. Use international format, e.g. +22376299719');
      }
      return true;
    }),
  body('about').optional().trim().isLength({ max: 500 }).withMessage('About must be less than 500 characters'),
  body('location').optional().trim().isLength({ max: 100 }).withMessage('Location must be less than 100 characters'),
  body('profession').optional().isMongoId(),
  body('availableForBookings').optional().isIn([true, false, 'true', 'false', '1', '0', 'yes', 'no', 'on', 'off']).withMessage('availableForBookings must be boolean-like'),
  body('hidden').optional().isBoolean().withMessage('hidden must be a boolean value')
];

export const checkUserValidator = [
  body('email').optional().isEmail().withMessage('Invalid email format'),
  body('contact')
    .optional()
    .trim()
    .customSanitizer((v) => {
      if (typeof v !== 'string') return v;
      const noSpaces = v.replace(/\s+/g, '');
      // Ensure the number starts with '+' for international format
      return noSpaces.startsWith('+') ? noSpaces : `+${noSpaces}`;
    })
    .isMobilePhone('any', { strictMode: false })
    .withMessage('Invalid contact number format. Use international format, e.g. +22376299719')
];

export const deleteAccountValidator = [
  body('password')
    .optional()
    .isString()
    .withMessage('Password must be a string'),
  body('reason')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Reason must be a string with maximum 500 characters')
];


