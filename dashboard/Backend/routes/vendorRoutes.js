const express = require("express");
const router = express.Router();

const {
  createVendor,
  getVendors,
  getVendorById,
  updateVendor,
  deleteVendor,
  getVendorDashboard,
  getVendorProfile,
  updateVendorProfile,
  getVendorEarnings,
  updateVendorStatus,
  getVendorStats
} = require("../controllers/vendorController");

const authMiddleware = require("../middleware/authMiddleware");

// Basic CRUD Operations
router.post("/", authMiddleware, createVendor);
router.get("/", authMiddleware, getVendors);
router.get("/stats", authMiddleware, getVendorStats);
router.get("/:id", authMiddleware, getVendorById);
router.put("/:id", authMiddleware, updateVendor);
router.delete("/:id", authMiddleware, deleteVendor);

// Vendor Dashboard
router.get("/:id/dashboard", authMiddleware, getVendorDashboard);

// Vendor Profile Management
router.get("/:id/profile", authMiddleware, getVendorProfile);
router.put("/:id/profile", authMiddleware, updateVendorProfile);

// Vendor Earnings
router.get("/:id/earnings", authMiddleware, getVendorEarnings);

// Vendor Status Management
router.put("/:id/status", authMiddleware, updateVendorStatus);

module.exports = router;