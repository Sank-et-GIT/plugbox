const mongoose = require("mongoose");

const vendorSchema = new mongoose.Schema({
  vendorName: {
    type: String,
    required: [true, 'Vendor name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  mobileNumber: {
    type: String,
    required: [true, 'Mobile number is required']
  },
  aadhaarNumber: {
    type: String,
    required: [true, 'Aadhaar number is required']
  },
  shopAddress: {
    type: String,
    required: [true, 'Shop address is required']
  },
  bankAccountNumber: {
    type: String,
    required: [true, 'Bank account number is required']
  },
  ifscCode: {
    type: String,
    required: [true, 'IFSC code is required']
  },
  gstNumber: {
    type: String
  },
  logo: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'pending'],
    default: 'pending'
  },
  commission: {
    type: Number,
    default: 10
  },
  totalRevenue: {
    type: Number,
    default: 0
  },
  pendingPayout: {
    type: Number,
    default: 0
  },
  totalChargers: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.model("Vendor", vendorSchema);