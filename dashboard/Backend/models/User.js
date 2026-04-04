const mongoose = require("mongoose");
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },

  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },

  phoneNumber: {
    type: String,
    required: [true, 'Phone number is required']
  },

  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters long']
  },

  role: {
    type: String,
    enum: ['user', 'vendor', 'admin', 'super_admin'],
    default: 'vendor'
  },

  walletBalance: {
    type: Number,
    default: 0
  },

  kycStatus: {
    type: String,
    enum: ["PENDING", "VERIFIED"],
    default: "PENDING"
  },

  avatar: {
    type: String,
    default: ''
  },

  isActive: {
    type: Boolean,
    default: true
  },

  lastLogin: {
    type: Date,
    default: Date.now
  },

  // Vendor specific fields
  businessDetails: {
    companyName: { type: String, trim: true },
    shopAddress: {
      address: { type: String, trim: true },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      pincode: { type: String, trim: true }
    },
    gstNumber: { type: String, trim: true, uppercase: true },
    panNumber: { type: String, trim: true, uppercase: true }
  },

  bankDetails: {
    accountNumber: { type: String, trim: true },
    accountHolderName: { type: String, trim: true },
    bankName: { type: String, trim: true },
    ifscCode: { type: String, trim: true, uppercase: true },
    branchName: { type: String, trim: true }
  }
}, {
  timestamps: true
});

userSchema.pre('save', async function() {
  if (!this.isModified('password')) {
    return;
  }
  
  try {
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(this.password, salt);
    this.password = hash;
  } catch (error) {
    throw error;
  }
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toJSON = function() {
  const userObject = this.toObject();
  delete userObject.password;
  return userObject;
};

module.exports = mongoose.model("User", userSchema);