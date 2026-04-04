const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: [true, 'Session ID is required'],
    unique: true,
    trim: true
  },

  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },

  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Vendor ID is required']
  },

  chargerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Charger',
    required: [true, 'Charger ID is required']
  },

  startTime: {
    type: Date,
    required: [true, 'Start time is required'],
    default: Date.now
  },

  endTime: {
    type: Date,
    default: null
  },

  duration: {
    type: Number, // Duration in minutes
    default: 0
  },

  unitsConsumed: {
    type: Number,
    required: [true, 'Units consumed is required'],
    default: 0,
    min: [0, 'Units consumed cannot be negative']
  },

  pricePerKwh: {
    type: Number,
    required: [true, 'Price per kWh is required'],
    min: [0, 'Price cannot be negative']
  },

  totalAmount: {
    type: Number,
    required: [true, 'Total amount is required'],
    default: 0,
    min: [0, 'Total amount cannot be negative']
  },

  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending'
  },

  paymentMethod: {
    type: String,
    enum: ['wallet', 'card', 'upi', 'cash'],
    default: 'wallet'
  },

  status: {
    type: String,
    enum: ['active', 'completed', 'cancelled', 'failed'],
    default: 'active'
  },

  notes: {
    type: String,
    trim: true
  },

  endReason: {
    type: String,
    enum: ['User_Stopped', 'Fully_Charged', 'Error'],
    default: null
  }
}, {
  timestamps: true
});

// Calculate duration before saving
sessionSchema.pre('save', function(next) {
  if (this.endTime && this.startTime) {
    this.duration = Math.round((this.endTime - this.startTime) / (1000 * 60)); // Convert to minutes
  }
  next();
});

// Index for efficient queries
sessionSchema.index({ vendorId: 1, status: 1 });
sessionSchema.index({ userId: 1, status: 1 });
sessionSchema.index({ chargerId: 1, status: 1 });
sessionSchema.index({ startTime: -1 });

module.exports = mongoose.model("Session", sessionSchema);