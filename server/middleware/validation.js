const { body, validationResult } = require('express-validator');
const logger = require('../utils/logger').createLogger('validation');

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn('Validation errors:', errors.array());
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

// User registration validation
const validateUserRegistration = [
  body('username')
    .isLength({ min: 3, max: 50 })
    .withMessage('Username must be between 3 and 50 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),
  
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  
  body('full_name')
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be between 2 and 100 characters')
    .trim(),
  
  body('phone')
    .matches(/^[0-9]{10}$/)
    .withMessage('Phone number must be 10 digits'),
  
  handleValidationErrors
];

// User login validation
const validateUserLogin = [
  body('username')
    .notEmpty()
    .withMessage('Username is required')
    .trim(),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  
  handleValidationErrors
];

// Profile update validation
const validateProfileUpdate = [
  body('full_name')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be between 2 and 100 characters')
    .trim(),
  
  body('phone')
    .optional()
    .matches(/^[0-9]{10}$/)
    .withMessage('Phone number must be 10 digits'),
  
  body('email')
    .optional()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  
  handleValidationErrors
];

// Vehicle validation
const validateVehicle = [
  body('make')
    .isLength({ min: 1, max: 50 })
    .withMessage('Vehicle make is required and must be less than 50 characters')
    .trim(),
  
  body('model')
    .isLength({ min: 1, max: 50 })
    .withMessage('Vehicle model is required and must be less than 50 characters')
    .trim(),
  
  body('year')
    .isInt({ min: 1900, max: new Date().getFullYear() + 1 })
    .withMessage('Please provide a valid year'),
  
  body('license_plate')
    .isLength({ min: 1, max: 20 })
    .withMessage('License plate is required and must be less than 20 characters')
    .trim(),
  
  body('battery_capacity')
    .optional()
    .isFloat({ min: 1, max: 200 })
    .withMessage('Battery capacity must be between 1 and 200 kWh'),
  
  handleValidationErrors
];

// Payment validation
const validatePayment = [
  body('amount')
    .isFloat({ min: 1, max: 10000 })
    .withMessage('Amount must be between 1 and 10,000 baht'),
  
  handleValidationErrors
];

// Station validation
const validateStation = [
  body('name')
    .isLength({ min: 1, max: 100 })
    .withMessage('Station name is required and must be less than 100 characters')
    .trim(),
  
  body('address')
    .isLength({ min: 1, max: 255 })
    .withMessage('Address is required and must be less than 255 characters')
    .trim(),
  
  body('latitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),
  
  body('longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180'),
  
  body('max_power')
    .isFloat({ min: 1, max: 100 })
    .withMessage('Max power must be between 1 and 100 kW'),
  
  body('price_per_kwh')
    .isFloat({ min: 0.01, max: 50 })
    .withMessage('Price per kWh must be between 0.01 and 50 baht'),
  
  handleValidationErrors
];

// Charging session validation
const validateChargingSession = [
  body('station_id')
    .isInt({ min: 1 })
    .withMessage('Valid station ID is required'),
  
  body('vehicle_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Valid vehicle ID is required'),
  
  handleValidationErrors
];

// Admin user update validation
const validateAdminUserUpdate = [
  body('full_name')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be between 2 and 100 characters')
    .trim(),
  
  body('email')
    .optional()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  
  body('phone')
    .optional()
    .matches(/^[0-9]{10}$/)
    .withMessage('Phone number must be 10 digits'),
  
  body('role')
    .optional()
    .isIn(['admin', 'service', 'user'])
    .withMessage('Role must be admin, service, or user'),
  
  body('is_active')
    .optional()
    .isBoolean()
    .withMessage('is_active must be a boolean'),
  
  handleValidationErrors
];

// Wallet adjustment validation
const validateWalletAdjustment = [
  body('type')
    .isIn(['add', 'subtract', 'set'])
    .withMessage('Type must be add, subtract, or set'),
  
  body('amount')
    .isFloat({ min: 0.01, max: 100000 })
    .withMessage('Amount must be between 0.01 and 100,000 baht'),
  
  body('note')
    .isLength({ min: 1, max: 255 })
    .withMessage('Note is required and must be less than 255 characters')
    .trim(),
  
  handleValidationErrors
];

module.exports = {
  validateUserRegistration,
  validateUserLogin,
  validateProfileUpdate,
  validateVehicle,
  validatePayment,
  validateStation,
  validateChargingSession,
  validateAdminUserUpdate,
  validateWalletAdjustment,
  handleValidationErrors
};
