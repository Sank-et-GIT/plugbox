const mongoose = require("mongoose");

const chargerSchema = new mongoose.Schema({
  chargerId: {
    type: String,
    required: [true, 'Charger ID is required'],
    unique: true,
    trim: true
  },
  
  chargerName: {
    type: String,
    required: [true, 'Charger name is required'],
    trim: true
  },

  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Vendor ID is required']
  },

  location: {
    address: {
      type: String,
      required: [true, 'Address is required']
    },
    city: {
      type: String,
      required: [true, 'City is required']
    },
    state: {
      type: String,
      required: [true, 'State is required']
    },
    pincode: {
      type: String,
      required: [true, 'Pincode is required']
    },
    coordinates: {
      latitude: {
        type: Number,
        required: [true, 'Latitude is required']
      },
      longitude: {
        type: Number,
        required: [true, 'Longitude is required']
      }
    }
  },

  chargerType: {
    type: String,
    enum: ['AC_TYPE_1', 'AC_TYPE_2', 'DC_CHAdeMO', 'DC_CSS', 'DC_TESLA'],
    required: [true, 'Charger type is required']
  },

  powerRating: {
    type: Number,
    required: [true, 'Power rating is required'],
    min: [3.3, 'Power rating must be at least 3.3 kW']
  },

  pricePerKwh: {
    type: Number,
    required: [true, 'Price per kWh is required'],
    min: [0, 'Price cannot be negative']
  },

  status: {
    type: String,
    enum: ['available', 'in_use', 'offline', 'reserved', 'maintenance'],
    default: 'available'
  },

  hardwareSerialNumber: {
    type: String,
    required: [true, 'Hardware serial number is required'],
    unique: true
  },

  installationDate: {
    type: Date,
    default: Date.now
  },

  lastMaintenance: {
    type: Date,
    default: Date.now
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

module.exports = mongoose.model("Charger", chargerSchema);