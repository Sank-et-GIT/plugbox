const express = require("express");
const router = express.Router();

const {
  createPayout,
  getPayouts,
  getPayoutsByVendor,
  approvePayout
} = require("../controllers/payoutController");

const authMiddleware = require("../middleware/authMiddleware");


// CREATE PAYOUT
router.post("/create", authMiddleware, createPayout);


// GET ALL PAYOUTS
router.get("/", authMiddleware, getPayouts);


// GET PAYOUTS BY VENDOR
router.get("/vendor/:vendorId", authMiddleware, getPayoutsByVendor);


// APPROVE PAYOUT
router.put("/approve/:id", authMiddleware, approvePayout);

module.exports = router;