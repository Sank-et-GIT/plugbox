const Charger = require("../models/Charger");
const mongoose = require("mongoose");

// CREATE CHARGER
exports.createCharger = async (req, res) => {
  try {
    // Extract vendorId from authenticated user
    const vendorId = req.user.id || req.user._id;

    // Validate required fields
    const {
      chargerName,
      chargerType,
      connectorType,
      location,
      pricePerUnit
    } = req.body;

    if (!chargerName || !chargerType || !connectorType || !location || !pricePerUnit) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: chargerName, chargerType, connectorType, location, pricePerUnit"
      });
    }

    // Validate location
    if (!location.address || location.lat === undefined || location.lng === undefined) {
      return res.status(400).json({
        success: false,
        message: "Location is required with address, latitude, and longitude"
      });
    }

    // Validate price
    if (pricePerUnit <= 0) {
      return res.status(400).json({
        success: false,
        message: "Price per unit must be greater than 0"
      });
    }

    // Create charger with vendorId
    const charger = new Charger({
      ...req.body,
      vendorId
    });

    await charger.save();

    res.status(201).json({
      success: true,
      message: "Charger created successfully",
      charger: charger.toAPIResponse()
    });

  } catch (error) {
    console.error('Error creating charger:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors
      });
    }

    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Charger ID or serial number already exists"
      });
    }

    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// GET ALL CHARGERS (for logged-in vendor only)
exports.getChargers = async (req, res) => {
  try {
    // Extract vendorId from authenticated user
    const vendorId = req.user.id || req.user._id;
    
    // Optional query parameters
    const { status, page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    // Build query
    const query = { 
      vendorId,
      isActive: true 
    };

    if (status) {
      query.status = status;
    }

    // Sort options
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute query with pagination
    const chargers = await Charger.find(query)
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Charger.countDocuments(query);

    res.json({
      success: true,
      chargers: chargers.map(charger => charger.toAPIResponse()),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching chargers:', error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// GET CHARGER BY ID (only if belongs to vendor)
exports.getChargerById = async (req, res) => {
  try {
    const { id } = req.params;
    const vendorId = req.user.id || req.user._id;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid charger ID format"
      });
    }

    const charger = await Charger.findById(id);

    if (!charger) {
      return res.status(404).json({
        success: false,
        message: "Charger not found"
      });
    }

    // Check if charger belongs to the vendor
    if (!charger.belongsToVendor(vendorId)) {
      return res.status(403).json({
        success: false,
        message: "Access denied: You can only access your own chargers"
      });
    }

    res.json({
      success: true,
      charger: charger.toAPIResponse()
    });

  } catch (error) {
    console.error('Error fetching charger:', error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// UPDATE CHARGER (only if belongs to vendor)
exports.updateCharger = async (req, res) => {
  try {
    const { id } = req.params;
    const vendorId = req.user.id || req.user._id;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid charger ID format"
      });
    }

    // Find charger and check ownership
    const charger = await Charger.findById(id);

    if (!charger) {
      return res.status(404).json({
        success: false,
        message: "Charger not found"
      });
    }

    // Check if charger belongs to the vendor
    if (!charger.belongsToVendor(vendorId)) {
      return res.status(403).json({
        success: false,
        message: "Access denied: You can only update your own chargers"
      });
    }

    // Validate price if provided
    if (req.body.pricePerUnit !== undefined && req.body.pricePerUnit <= 0) {
      return res.status(400).json({
        success: false,
        message: "Price per unit must be greater than 0"
      });
    }

    // Don't allow vendorId to be changed
    delete req.body.vendorId;
    delete req.body.chargerId;

    // Update charger
    const updatedCharger = await Charger.findByIdAndUpdate(
      id,
      { ...req.body, updatedAt: new Date() },
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: "Charger updated successfully",
      charger: updatedCharger.toAPIResponse()
    });

  } catch (error) {
    console.error('Error updating charger:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors
      });
    }

    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// DELETE CHARGER (only if belongs to vendor)
exports.deleteCharger = async (req, res) => {
  try {
    const { id } = req.params;
    const vendorId = req.user.id || req.user._id;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid charger ID format"
      });
    }

    // Find charger and check ownership
    const charger = await Charger.findById(id);

    if (!charger) {
      return res.status(404).json({
        success: false,
        message: "Charger not found"
      });
    }

    // Check if charger belongs to the vendor
    if (!charger.belongsToVendor(vendorId)) {
      return res.status(403).json({
        success: false,
        message: "Access denied: You can only delete your own chargers"
      });
    }

    // Soft delete by setting isActive to false
    await Charger.findByIdAndUpdate(id, { 
      isActive: false,
      updatedAt: new Date()
    });

    res.json({
      success: true,
      message: "Charger deleted successfully"
    });

  } catch (error) {
    console.error('Error deleting charger:', error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// UPDATE CHARGER STATUS
exports.updateChargerStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const vendorId = req.user.id || req.user._id;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid charger ID format"
      });
    }

    // Validate status
    const validStatuses = ['Available', 'Offline', 'In_Session', 'Reserved', 'On_Maintenance'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status value"
      });
    }

    // Find charger and check ownership
    const charger = await Charger.findById(id);

    if (!charger) {
      return res.status(404).json({
        success: false,
        message: "Charger not found"
      });
    }

    // Check if charger belongs to the vendor
    if (!charger.belongsToVendor(vendorId)) {
      return res.status(403).json({
        success: false,
        message: "Access denied: You can only update your own chargers"
      });
    }

    // Update status
    await charger.updateStatus(status);

    res.json({
      success: true,
      message: "Charger status updated successfully",
      charger: charger.toAPIResponse()
    });

  } catch (error) {
    console.error('Error updating charger status:', error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// GET CHARGER STATISTICS
exports.getChargerStats = async (req, res) => {
  try {
    const vendorId = req.user.id || req.user._id;

    const stats = await Charger.aggregate([
      {
        $match: { 
          vendorId: mongoose.Types.ObjectId(vendorId),
          isActive: true 
        }
      },
      {
        $group: {
          _id: null,
          totalChargers: { $sum: 1 },
          availableChargers: {
            $sum: { $cond: [{ $eq: ['$status', 'Available'] }, 1, 0] }
          },
          inSessionChargers: {
            $sum: { $cond: [{ $eq: ['$status', 'In_Session'] }, 1, 0] }
          },
          offlineChargers: {
            $sum: { $cond: [{ $eq: ['$status', 'Offline'] }, 1, 0] }
          },
          maintenanceChargers: {
            $sum: { $cond: [{ $eq: ['$status', 'On_Maintenance'] }, 1, 0] }
          },
          totalSessions: { $sum: '$totalSessions' },
          totalEnergyDelivered: { $sum: '$totalEnergyDelivered' },
          totalRevenue: { $sum: '$totalRevenue' },
          averagePricePerUnit: { $avg: '$pricePerUnit' }
        }
      }
    ]);

    const statusBreakdown = await Charger.aggregate([
      {
        $match: { 
          vendorId: mongoose.Types.ObjectId(vendorId),
          isActive: true 
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      stats: stats[0] || {
        totalChargers: 0,
        availableChargers: 0,
        inSessionChargers: 0,
        offlineChargers: 0,
        maintenanceChargers: 0,
        totalSessions: 0,
        totalEnergyDelivered: 0,
        totalRevenue: 0,
        averagePricePerUnit: 0
      },
      statusBreakdown
    });

  } catch (error) {
    console.error('Error fetching charger stats:', error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};