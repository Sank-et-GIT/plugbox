const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema({

  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Session",
    required: true
  },

  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Vendor",
    required: true
  },

  amount: {
    type: Number,
    required: true
  },

  unitsConsumed: {
    type: Number,
    required: true
  },

  paymentMethod: {
    type: String,
    enum: ["UPI", "CARD", "WALLET"],
    default: "UPI"
  },

  transactionId: {
    type: String,
    required: true
  },

  paymentStatus: {
    type: String,
    enum: ["PENDING", "SUCCESS", "FAILED"],
    default: "PENDING"
  },

  createdAt: {
    type: Date,
    default: Date.now
  }

});

module.exports = mongoose.model("Payment", paymentSchema);