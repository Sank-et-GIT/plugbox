const express = require("express");
const router = express.Router();

const {
  getDashboardReport,
  getRevenueReport,
  getChargerUsageReport,
  getVendorPerformanceReport
} = require("../controllers/reportController");

const authMiddleware = require("../middleware/authMiddleware");


// DASHBOARD REPORT
router.get("/dashboard", authMiddleware, getDashboardReport);


// REVENUE REPORT
router.get("/revenue", authMiddleware, getRevenueReport);


// CHARGER USAGE REPORT
router.get("/charger-usage", authMiddleware, getChargerUsageReport);


// VENDOR PERFORMANCE
router.get("/vendor-performance", authMiddleware, getVendorPerformanceReport);

module.exports = router;