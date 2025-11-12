import { body, param, query } from 'express-validator';

// Global Configuration Validators
export const updateGlobalConfigValidation = [
  // Existing fields
  body('liveShowPriceHide')
    .optional()
    .toBoolean()
    .isBoolean()
    .withMessage('liveShowPriceHide must be a boolean'),
  body('videoCallPriceHide')
    .optional()
    .toBoolean()
    .isBoolean()
    .withMessage('videoCallPriceHide must be a boolean'),
  body('becomeBaronistarPriceHide')
    .optional()
    .toBoolean()
    .isBoolean()
    .withMessage('becomeBaronistarPriceHide must be a boolean'),
  body('isTestUser')
    .optional()
    .toBoolean()
    .isBoolean()
    .withMessage('isTestUser must be a boolean'),
  body('hideApplyToBecomeStar')
    .optional()
    .toBoolean()
    .isBoolean()
    .withMessage('hideApplyToBecomeStar must be a boolean'),
  
  // Service Limits
  body('serviceLimits.liveShowDuration')
    .optional()
    .isInt({ min: 1, max: 1440 })
    .withMessage('Max live show duration must be between 1 and 1440 minutes'),
  body('serviceLimits.videoCallDuration')
    .optional()
    .isInt({ min: 1, max: 1440 })
    .withMessage('Max video call duration must be between 1 and 1440 minutes'),
  body('serviceLimits.slotDuration')
    .optional()
    .isInt({ min: 1, max: 1440 })
    .withMessage('Default call time must be between 1 and 1440 minutes'),
  body('serviceLimits.dedicationUploadSize')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Dedication upload size must be between 1 and 1000 MB'),
  body('serviceLimits.maxLiveShowParticipants')
    .optional()
    .isInt({ min: 1, max: 100000 })
    .withMessage('Max live show participants must be between 1 and 100000'),
  body('serviceLimits.reconnectionTimeout')
    .optional()
    .isInt({ min: 1, max: 60 })
    .withMessage('Reconnection timeout must be between 1 and 60 minutes'),
  
  // ID Verification Fees
  body('idVerificationFees.standardIdPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Standard ID price must be a positive number'),
  body('idVerificationFees.goldIdPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Gold ID price must be a positive number'),
  
  // Live Show Fees
  body('liveShowFees.hostingFee')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Hosting fee must be a positive number'),
  
  // Contact & Support Info
  body('contactSupport.companyServiceNumber')
    .optional()
    .isLength({ min: 5, max: 20 })
    .withMessage('Company service number must be between 5 and 20 characters'),
  body('contactSupport.supportEmail')
    .optional()
    .isEmail()
    .withMessage('Support email must be a valid email address'),
  body('contactSupport.servicesTermsUrl')
    .optional()
    .isURL()
    .withMessage('Services terms URL must be a valid URL'),
  body('contactSupport.privacyPolicyUrl')
    .optional()
    .isURL()
    .withMessage('Privacy policy URL must be a valid URL'),
  body('contactSupport.helpdeskLink')
    .optional()
    .isURL()
    .withMessage('Helpdesk link must be a valid URL'),
  
  // Hide Elements Price
  body('hideElementsPrice.hideDedications')
    .optional()
    .toBoolean()
    .isBoolean()
    .withMessage('Hide dedications must be a boolean')
];

// Note: Category management uses existing category routes and validators

// Country Service Configuration Validators
export const createCountryServiceConfigValidation = [
  body('country')
    .notEmpty()
    .withMessage('Country name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Country name must be between 2 and 100 characters'),
  body('countryCode')
    .notEmpty()
    .withMessage('Country code is required')
    .isLength({ min: 2, max: 3 })
    .withMessage('Country code must be between 2 and 3 characters')
    .matches(/^[A-Z]+$/)
    .withMessage('Country code must contain only uppercase letters'),
  body('services.videoCall')
    .optional()
    .toBoolean()
    .isBoolean()
    .withMessage('Video call service must be a boolean'),
  body('services.dedication')
    .optional()
    .toBoolean()
    .isBoolean()
    .withMessage('Dedication service must be a boolean'),
  body('services.liveShow')
    .optional()
    .toBoolean()
    .isBoolean()
    .withMessage('Live show service must be a boolean'),
  body('sortOrder')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Sort order must be a non-negative integer')
];

export const updateCountryServiceConfigValidation = [
  param('configId')
    .isMongoId()
    .withMessage('Config ID must be a valid MongoDB ObjectId'),
  body('country')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('Country name must be between 2 and 100 characters'),
  body('countryCode')
    .optional()
    .isLength({ min: 2, max: 3 })
    .withMessage('Country code must be between 2 and 3 characters')
    .matches(/^[A-Z]+$/)
    .withMessage('Country code must contain only uppercase letters'),
  body('services.videoCall')
    .optional()
    .toBoolean()
    .isBoolean()
    .withMessage('Video call service must be a boolean'),
  body('services.dedication')
    .optional()
    .toBoolean()
    .isBoolean()
    .withMessage('Dedication service must be a boolean'),
  body('services.liveShow')
    .optional()
    .toBoolean()
    .isBoolean()
    .withMessage('Live show service must be a boolean'),
  body('isActive')
    .optional()
    .toBoolean()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
  body('sortOrder')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Sort order must be a non-negative integer')
];

export const deleteCountryServiceConfigValidation = [
  param('configId')
    .isMongoId()
    .withMessage('Config ID must be a valid MongoDB ObjectId')
];

export const getCountryServiceConfigsValidation = [
  query('isActive')
    .optional()
    .isIn(['true', 'false'])
    .withMessage('isActive must be true or false')
];

// Legacy validator for backward compatibility
export const upsertConfigValidation = updateGlobalConfigValidation;



