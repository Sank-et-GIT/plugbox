const express = require("express");
const router = express.Router();

const {
  createPayment,
  getPayments,
  getPaymentById,
  getPaymentsByUser
} = require("../controllers/paymentController");

const authMiddleware = require("../middleware/authMiddleware");


// CREATE PAYMENT
router.post("/create", authMiddleware, createPayment);


// GET ALL PAYMENTS
router.get("/", authMiddleware, getPayments);


// GET PAYMENT BY ID
router.get("/:id", authMiddleware, getPaymentById);


// GET PAYMENTS BY USER
router.get("/user/:userId", authMiddleware, getPaymentsByUser);

module.exports = router;