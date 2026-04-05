const express = require('express');
const { vendorAuth } = require('../middleware/auth');
const {
  getAdminDashboard,
  getVendorStatusData,
  getChargerDistributionData,
  getSessionTrendsData,
  getActiveSessions,
  getAllVendors,
  getAllChargers,
  getAllUsers,
  toggleVendorStatus,
  toggleChargerStatus,
  toggleUserStatus,
  createVendor,
  createUser,
  deleteVendor,
  deleteUser,
  createCharger,
  updateCharger,
  deleteCharger
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

// Chart Data Endpoints (Admin only)
router.get('/vendor-status-data', vendorAuth, adminAuth, getVendorStatusData);
router.get('/charger-distribution-data', vendorAuth, adminAuth, getChargerDistributionData);
router.get('/session-trends-data', vendorAuth, adminAuth, getSessionTrendsData);
router.get('/active-sessions', vendorAuth, adminAuth, getActiveSessions);

// Toggle Vendor Status (Admin only)
router.patch('/vendors/:vendorId/status', vendorAuth, adminAuth, toggleVendorStatus);

// Toggle Charger Status (Admin only)
router.patch('/chargers/:chargerId/status', vendorAuth, adminAuth, toggleChargerStatus);

// Toggle User Status (Admin only)
router.patch('/users/:userId/status', vendorAuth, adminAuth, toggleUserStatus);

// Create Vendor (Admin only)
router.post('/vendors', vendorAuth, adminAuth, createVendor);

// Create User (Admin only)
router.post('/users', vendorAuth, adminAuth, createUser);

// Delete Vendor (Admin only)
router.delete('/vendors/:vendorId', vendorAuth, adminAuth, deleteVendor);

// Delete User (Admin only)
router.delete('/users/:userId', vendorAuth, adminAuth, deleteUser);

// Charger CRUD Operations (Admin only)
router.post('/chargers', vendorAuth, adminAuth, createCharger);
router.put('/chargers/:chargerId', vendorAuth, adminAuth, updateCharger);
router.delete('/chargers/:chargerId', vendorAuth, adminAuth, deleteCharger);

module.exports = router;
