const mongoose = require("mongoose");

const payoutSchema = new mongoose.Schema({

  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Vendor",
    required: true
  },

  paymentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Payment",
    required: true
  },

  totalAmount: {
    type: Number,
    required: true
  },

  adminCommission: {
    type: Number,
    required: true
  },

  vendorShare: {
    type: Number,
    required: true
  },

  payoutStatus: {
    type: String,
    enum: ["PENDING", "APPROVED", "PAID"],
    default: "PENDING"
  },

  payoutDate: {
    type: Date
  },

  createdAt: {
    type: Date,
    default: Date.now
  }

});

module.exports = mongoose.model("Payout", payoutSchema);