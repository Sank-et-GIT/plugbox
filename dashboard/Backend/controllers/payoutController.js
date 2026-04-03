const Payout = require("../models/Payout");


// CREATE PAYOUT
exports.createPayout = async (req, res) => {
  try {

    const { vendorId, paymentId, totalAmount } = req.body;

    const adminCommission = totalAmount * 0.20;
    const vendorShare = totalAmount * 0.80;

    const payout = new Payout({
      vendorId,
      paymentId,
      totalAmount,
      adminCommission,
      vendorShare
    });

    await payout.save();

    res.status(201).json({
      message: "Payout created successfully",
      payout
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};



// GET ALL PAYOUTS
exports.getPayouts = async (req, res) => {
  try {

    const payouts = await Payout.find()
      .populate("vendorId")
      .populate("paymentId");

    res.json(payouts);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};



// GET PAYOUTS BY VENDOR
exports.getPayoutsByVendor = async (req, res) => {
  try {

    const payouts = await Payout.find({
      vendorId: req.params.vendorId
    });

    res.json(payouts);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};



// APPROVE PAYOUT
exports.approvePayout = async (req, res) => {
  try {

    const payout = await Payout.findById(req.params.id);

    if (!payout) {
      return res.status(404).json({
        message: "Payout not found"
      });
    }

    payout.payoutStatus = "PAID";
    payout.payoutDate = new Date();

    await payout.save();

    res.json({
      message: "Payout approved and paid",
      payout
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};