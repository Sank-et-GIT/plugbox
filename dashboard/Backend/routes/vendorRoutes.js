const express = require("express");
const router = express.Router();

const {
  createVendor,
  getVendors,
  getVendorById,
  updateVendor,
  deleteVendor
} = require("../controllers/vendorController");

const authMiddleware = require("../middleware/authMiddleware");

// Create Vendor
router.post("/", authMiddleware, createVendor);

// Get All Vendors
router.get("/", authMiddleware, getVendors);

// Get Vendor By ID
router.get("/:id", authMiddleware, getVendorById);

// Update Vendor
router.put("/:id", authMiddleware, updateVendor);

// Delete Vendor
router.delete("/:id", authMiddleware, deleteVendor);

module.exports = router;