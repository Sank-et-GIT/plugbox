const express = require('express');
const { vendorAuth } = require('../middleware/auth');
const {
  getAdminDashboard,
  getAllVendors,
  getAllChargers,
  getAllUsers,
  toggleVendorStatus,
  toggleChargerStatus
} = require('../controllers/adminController');

const router = express.Router();

// Apply admin middleware - check if user is admin
const adminAuth = (req, res, next) => {
  if (!req.vendor || req.vendor.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied. Admin role required.' });
  }
  next();
};

// Admin Dashboard Stats
router.get('/dashboard', vendorAuth, adminAuth, getAdminDashboard);

// Get All Vendors (Admin only)
router.get('/vendors', vendorAuth, adminAuth, getAllVendors);

// Get All Chargers (Admin only)
router.get('/chargers', vendorAuth, adminAuth, getAllChargers);

// Get All Users (Admin only)
router.get('/users', vendorAuth, adminAuth, getAllUsers);

// Toggle Vendor Status (Admin only)
router.patch('/vendors/:vendorId/status', vendorAuth, adminAuth, toggleVendorStatus);

// Toggle Charger Status (Admin only)
router.patch('/chargers/:chargerId/status', vendorAuth, adminAuth, toggleChargerStatus);

module.exports = router;
