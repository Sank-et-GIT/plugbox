const Payment = require("../models/Payment");


// CREATE PAYMENT
exports.createPayment = async (req, res) => {
  try {

    const payment = new Payment(req.body);

    await payment.save();

    res.status(201).json({
      message: "Payment created successfully",
      payment
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};



// GET ALL PAYMENTS
exports.getPayments = async (req, res) => {
  try {

    const payments = await Payment.find()
      .populate("sessionId")
      .populate("userId")
      .populate("vendorId");

    res.json(payments);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};



// GET PAYMENT BY ID
exports.getPaymentById = async (req, res) => {
  try {

    const payment = await Payment.findById(req.params.id)
      .populate("sessionId")
      .populate("userId")
      .populate("vendorId");

    if (!payment) {
      return res.status(404).json({
        message: "Payment not found"
      });
    }

    res.json(payment);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};



// GET PAYMENTS BY USER
exports.getPaymentsByUser = async (req, res) => {
  try {

    const payments = await Payment.find({
      userId: req.params.userId
    });

    res.json(payments);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};