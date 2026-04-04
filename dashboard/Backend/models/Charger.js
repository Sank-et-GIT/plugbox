const mongoose = require("mongoose");

const chargerSchema = new mongoose.Schema({
  // Auto-generated unique charger ID
  chargerId: {
    type: String,
    required: false,
    unique: true,
    trim: true
  },
  
  chargerName: {
    type: String,
    required: [true, 'Charger name is required'],
    trim: true,
    maxlength: [100, 'Charger name cannot exceed 100 characters']
  },

  // Vendor Reference (linked to Vendor model)
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    required: [true, 'Vendor ID is required'],

  },

  // Charger Specifications
  chargerType: {
    type: String,
    required: [true, 'Charger type is required'],
    enum: {
      values: ['AC', 'DC', 'DC_Fast', 'Type1', 'Type2', 'CCS', 'CHAdeMO', 'Tesla'],
      message: 'Invalid charger type'
    }
  },

  connectorType: {
    type: String,
    required: [true, 'Connector type is required'],
    enum: {
      values: ['Type1', 'Type2', 'CCS', 'CHAdeMO', 'Tesla', 'GB/T', 'J1772'],
      message: 'Invalid connector type'
    }
  },

  // Location Information
  location: {
    address: {
      type: String,
      required: [true, 'Address is required'],
      trim: true,
      maxlength: [500, 'Address cannot exceed 500 characters']
    },
    lat: {
      type: Number,
      required: [true, 'Latitude is required'],
      min: [-90, 'Latitude must be between -90 and 90'],
      max: [90, 'Latitude must be between -90 and 90']
    },
    lng: {
      type: Number,
      required: [true, 'Longitude is required'],
      min: [-180, 'Longitude must be between -180 and 180'],
      max: [180, 'Longitude must be between -180 and 180']
    }
  },

  // Pricing
  pricePerUnit: {
    type: Number,
    required: [true, 'Price per unit is required'],
    min: [0, 'Price per unit must be positive'],
    validate: {
      validator: function(value) {
        return value > 0;
      },
      message: 'Price per unit must be greater than 0'
    }
  },

  // Status Management
  status: {
    type: String,
    enum: {
      values: ['Available', 'Offline', 'In_Session', 'Reserved', 'On_Maintenance'],
      message: 'Invalid status value'
    },
    default: 'Available',
    index: true
  },

  // Additional Information
  serialNumber: {
    type: String,
    trim: true,
    maxlength: [50, 'Serial number cannot exceed 50 characters']
  },
  
  hardwareSerialNumber: {
    type: String,
    required: false,
    unique: false, // Allow null values
    sparse: true, // Only index non-null values
    trim: true
  },

  installationDate: {
    type: Date,
    default: Date.now,
    validate: {
      validator: function(value) {
        return !value || value <= new Date();
      },
      message: 'Installation date cannot be in the future'
    }
  },

  // Usage Statistics
  totalSessions: {
    type: Number,
    default: 0,
    min: [0, 'Total sessions cannot be negative']
  },

  totalEnergyDelivered: {
    type: Number,
    default: 0,
    min: [0, 'Total energy delivered cannot be negative']
  },

  totalRevenue: {
    type: Number,
    default: 0,
    min: [0, 'Total revenue cannot be negative']
  },

  // Metadata
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better performance
chargerSchema.index({ vendorId: 1, status: 1 });


// Virtual fields
chargerSchema.virtual('isOperational').get(function() {
  return this.status === 'Available' || this.status === 'Reserved';
});

chargerSchema.virtual('averageSessionRevenue').get(function() {
  return this.totalSessions > 0 ? this.totalRevenue / this.totalSessions : 0;
});

// Pre-save middleware to auto-generate chargerId
chargerSchema.pre('save', async function() {
  if (!this.isNew) return;
  
  // Auto-generate chargerId if not provided
  if (!this.chargerId) {
    try {
      // Generate random 6-digit number
      const randomNum = Math.floor(100000 + Math.random() * 900000);
      this.chargerId = `CHR${randomNum}`;
      
      // Ensure uniqueness by checking if ID already exists
      const existingCharger = await this.constructor.findOne({ chargerId: this.chargerId });
      if (existingCharger) {
        // If collision exists, generate again recursively
        await this.generateUniqueChargerId();
      }
    } catch (error) {
      throw error;
    }
  }
});

// Helper method to generate unique charger ID
chargerSchema.methods.generateUniqueChargerId = async function() {
  const randomNum = Math.floor(100000 + Math.random() * 900000);
  this.chargerId = `CHR${randomNum}`;
  
  const existingCharger = await this.constructor.findOne({ chargerId: this.chargerId });
  if (existingCharger) {
    // Recursively generate new ID if collision occurs
    await this.generateUniqueChargerId();
  }
};

// Instance methods
chargerSchema.methods.belongsToVendor = function(vendorId) {
  return this.vendorId.toString() === vendorId.toString();
};

chargerSchema.methods.updateStatus = function(newStatus) {
  const validTransitions = {
    'Available': ['In_Session', 'Reserved', 'Offline', 'On_Maintenance'],
    'In_Session': ['Available', 'Offline', 'On_Maintenance'],
    'Reserved': ['In_Session', 'Available', 'Offline'],
    'Offline': ['Available', 'On_Maintenance'],
    'On_Maintenance': ['Available', 'Offline']
  };

  if (!validTransitions[this.status]?.includes(newStatus)) {
    throw new Error(`Invalid status transition from ${this.status} to ${newStatus}`);
  }

  this.status = newStatus;
  return this.save();
};

// Static methods
chargerSchema.statics.findByVendor = function(vendorId, options = {}) {
  const query = { vendorId, isActive: true };
  
  if (options.status) {
    query.status = options.status;
  }

  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(options.limit || 50);
};

// Transform method for API responses
chargerSchema.methods.toAPIResponse = function() {
  const obj = this.toObject();
  
  // Remove sensitive fields
  delete obj.__v;
  
  // Format dates
  if (obj.installationDate) {
    obj.installationDate = obj.installationDate.toISOString().split('T')[0];
  }

  return obj;
};

module.exports = mongoose.model("Charger", chargerSchema);