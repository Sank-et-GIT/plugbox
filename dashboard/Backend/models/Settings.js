const mongoose = require("mongoose");

const settingsSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    unique: true
  },

  notifications: {
    email: { type: Boolean, default: true },
    sms: { type: Boolean, default: false },
    push: { type: Boolean, default: true },
    sessionCompleted: { type: Boolean, default: true },
    chargerOffline: { type: Boolean, default: true },
    paymentReceived: { type: Boolean, default: true },
    lowBalanceAlert: { type: Boolean, default: true }
  },

  appearance: {
    theme: {
      type: String,
      enum: ['light', 'dark', 'auto'],
      default: 'light'
    },
    language: {
      type: String,
      enum: ['en', 'hi', 'gu'],
      default: 'en'
    },
    timezone: {
      type: String,
      default: 'Asia/Kolkata'
    }
  },

  payment: {
    defaultMethod: {
      type: String,
      enum: ['wallet', 'card', 'upi', 'cash'],
      default: 'wallet'
    },
    autoTopup: { type: Boolean, default: false },
    autoTopupAmount: { type: Number, default: 500 },
    lowBalanceAlert: { type: Boolean, default: true },
    lowBalanceThreshold: { type: Number, default: 100 }
  },

  security: {
    twoFactorAuth: { type: Boolean, default: false },
    sessionTimeout: { 
      type: Number, 
      default: 30,
      min: [5, 'Session timeout must be at least 5 minutes'],
      max: [480, 'Session timeout cannot exceed 480 minutes']
    },
    emailNotifications: { type: Boolean, default: true },
    smsNotifications: { type: Boolean, default: false }
  },

  business: {
    companyName: { type: String, trim: true },
    gstNumber: { type: String, trim: true },
    panNumber: { type: String, trim: true },
    bankAccountNumber: { type: String, trim: true },
    bankIfsc: { type: String, trim: true },
    bankName: { type: String, trim: true }
  },

  api: {
    webhookUrl: { type: String, trim: true },
    apiKey: { type: String, trim: true },
    enableApi: { type: Boolean, default: false }
  }
}, {
  timestamps: true
});

// Index for efficient queries
settingsSchema.index({ userId: 1 });

// Pre-save middleware to validate settings
settingsSchema.pre('save', function(next) {
  // Ensure payment threshold is reasonable
  if (this.payment.lowBalanceThreshold < 10) {
    this.payment.lowBalanceThreshold = 10;
  }
  
  // Ensure auto top-up amount is reasonable
  if (this.payment.autoTopupAmount < 100) {
    this.payment.autoTopupAmount = 100;
  }
  
  next();
});

module.exports = mongoose.model("Settings", settingsSchema);
