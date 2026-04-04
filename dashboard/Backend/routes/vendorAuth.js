const { body, validationResult } = require('express-validator');
const {
  registerVendor,
  loginVendor,
  getVendorProfile,
  updateVendorProfile,
  logoutVendor
} = require('../controllers/vendorAuthController');
const { vendorAuth } = require('../middleware/auth');

const router = require('express').Router();

// Register Vendor
router.post('/register', [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('phoneNumber').notEmpty().withMessage('Phone number is required')
], registerVendor);

// Login Vendor
router.post('/login', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required')
], loginVendor);

// Get Vendor Profile
router.get('/me', vendorAuth, getVendorProfile);

// Update Vendor Profile
router.put('/profile', vendorAuth, [
  body('companyName').optional().trim().notEmpty().withMessage('Company name cannot be empty'),
  body('phoneNumber').optional().notEmpty().withMessage('Phone number cannot be empty')
], updateVendorProfile);

// Logout Vendor
router.post('/logout', vendorAuth, logoutVendor);

module.exports = router;
