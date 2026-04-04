const mongoose = require("mongoose");

const vendorSchema = new mongoose.Schema({
  // Basic Information
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
    required: [true, 'Mobile number is required'],
    match: [/^[6-9]\d{9}$/, 'Please enter a valid 10-digit mobile number']
  },
  
  // Business Information
  shopAddress: {
    type: String,
    required: [true, 'Shop address is required']
  },
  shopName: {
    type: String,
    required: [true, 'Shop name is required']
  },
  businessType: {
    type: String,
    enum: ['individual', 'partnership', 'company', 'llp'],
    default: 'individual'
  },
  
  // Banking Details
  bankAccountNumber: {
    type: String,
    required: [true, 'Bank account number is required']
  },
  ifscCode: {
    type: String,
    required: [true, 'IFSC code is required'],
    match: [/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Please enter a valid IFSC code']
  },
  bankName: {
    type: String,
    required: [true, 'Bank name is required']
  },
  accountHolderName: {
    type: String,
    required: [true, 'Account holder name is required']
  },
  
  // Tax Information
  gstNumber: {
    type: String,
    match: [/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Please enter a valid GST number']
  },
  panNumber: {
    type: String,
    match: [/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Please enter a valid PAN number']
  },
  
  // Identity Verification
  aadhaarNumber: {
    type: String,
    match: [/^[2-9]{1}[0-9]{3}[0-9]{4}[0-9]{4}$/, 'Please enter a valid Aadhaar number']
  },
  
  // Business Metrics
  totalRevenue: {
    type: Number,
    default: 0
  },
  pendingPayout: {
    type: Number,
    default: 0
  },
  totalPayout: {
    type: Number,
    default: 0
  },
  totalChargers: {
    type: Number,
    default: 0
  },
  activeChargers: {
    type: Number,
    default: 0
  },
  totalSessions: {
    type: Number,
    default: 0
  },
  averageRating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  
  // Commission and Pricing
  commission: {
    type: Number,
    default: 10,
    min: 0,
    max: 100
  },
  
  // Profile and Branding
  logo: {
    type: String,
    default: ''
  },
  description: {
    type: String,
    maxlength: 500
  },
  
  // Status and Verification
  status: {
    type: String,
    enum: ['pending', 'active', 'inactive', 'suspended'],
    default: 'pending'
  },
  verificationStatus: {
    type: String,
    enum: ['pending', 'verified', 'rejected'],
    default: 'pending'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Location
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      default: [0, 0]
    }
  },
  
  // Settings
  notifications: {
    email: {
      type: Boolean,
      default: true
    },
    sms: {
      type: Boolean,
      default: false
    },
    push: {
      type: Boolean,
      default: true
    }
  },
  
  // Time tracking
  lastActiveAt: {
    type: Date,
    default: Date.now
  },
  
  // Additional metadata
  metadata: {
    source: {
      type: String,
      enum: ['web', 'mobile', 'admin', 'api'],
      default: 'web'
    },
    ipAddress: String,
    userAgent: String
  }
}, {
  timestamps: true
});

// Indexes for better performance
vendorSchema.index({ mobileNumber: 1 });
vendorSchema.index({ status: 1 });
vendorSchema.index({ verificationStatus: 1 });
vendorSchema.index({ location: '2dsphere' });

// Virtual fields
vendorSchema.virtual('pendingEarnings').get(function() {
  return this.pendingPayout;
});

vendorSchema.virtual('totalEarnings').get(function() {
  return this.totalRevenue;
});

// Methods
vendorSchema.methods.calculateEarnings = function() {
  return this.totalRevenue * (1 - this.commission / 100);
};

vendorSchema.methods.isVerified = function() {
  return this.verificationStatus === 'verified';
};

vendorSchema.methods.canOperate = function() {
  return this.isActive && this.status === 'active' && this.verificationStatus === 'verified';
};

// Pre-save middleware
vendorSchema.pre('save', function(next) {
  if (this.isModified('lastActiveAt')) {
    this.lastActiveAt = new Date();
  }
  next();
});

module.exports = mongoose.model("Vendor", vendorSchema);