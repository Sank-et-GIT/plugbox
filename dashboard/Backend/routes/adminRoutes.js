const express = require("express");
const router = express.Router();

const {
  registerAdmin,
  loginAdmin,
  getAdminProfile
} = require("../controllers/adminController");

const authMiddleware = require("../middleware/authMiddleware");

// Register Admin
router.post("/register", registerAdmin);

// Admin Login
router.post("/login", loginAdmin);

// Get Admin Profile (Protected Route)
router.get("/profile", authMiddleware, getAdminProfile);

module.exports = router;
