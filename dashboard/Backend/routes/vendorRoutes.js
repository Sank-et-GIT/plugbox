const express = require("express");
const router = express.Router();

const {
  getVendors,
  getVendorById,
  updateVendor,
  deleteVendor,
  getVendorStats,
  getVendorsForDropdown
} = require("../controllers/vendorControllerPrisma");

const authMiddleware = require("../middleware/authMiddleware");

// Basic CRUD Operations
router.get("/", authMiddleware, getVendors);
router.get("/dropdown", authMiddleware, getVendorsForDropdown);
router.get("/stats", authMiddleware, getVendorStats);
router.get("/:id", authMiddleware, getVendorById);
router.put("/:id", authMiddleware, updateVendor);
router.delete("/:id", authMiddleware, deleteVendor);

module.exports = router;