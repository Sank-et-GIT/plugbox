const Charger = require('../models/Charger');
const Vendor = require('../models/Vendor');

// Get all chargers for admin (with vendor details)
const getAllChargers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, status, vendorId, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    
    // Build query
    let query = {};
    
    if (search) {
      query.$or = [
        { chargerName: { $regex: search, $options: 'i' } },
        { chargerId: { $regex: search, $options: 'i' } },
        { 'location.address': { $regex: search, $options: 'i' } }
      ];
    }
    
    if (status) {
      query.status = status;
    }
    
    if (vendorId) {
      query.vendorId = vendorId;
    }
    
    // Sort options
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    // Execute query with pagination
    const chargers = await Charger.find(query)
      .populate('vendorId', 'vendorName email shopName mobileNumber')
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();
    
    // Get total count
    const total = await Charger.countDocuments(query);
    
    res.status(200).json({
      success: true,
      chargers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Admin get chargers error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get charger by ID for admin
const getChargerById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const charger = await Charger.findById(id)
      .populate('vendorId', 'vendorName email shopName mobileNumber bankAccountNumber ifscCode');
    
    if (!charger) {
      return res.status(404).json({
        success: false,
        message: 'Charger not found'
      });
    }
    
    res.status(200).json({
      success: true,
      charger
    });
  } catch (error) {
    console.error('Admin get charger by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Create charger for admin (with vendor selection)
const createCharger = async (req, res) => {
  try {
    const chargerData = req.body;
    
    // Validate vendor exists
    const vendor = await Vendor.findById(chargerData.vendorId);
    if (!vendor) {
      return res.status(400).json({
        success: false,
        message: 'Vendor not found'
      });
    }
    
    // Create charger
    const charger = new Charger(chargerData);
    await charger.save();
    
    // Update vendor charger count
    await Vendor.findByIdAndUpdate(chargerData.vendorId, {
      $inc: { totalChargers: 1, activeChargers: charger.status === 'Available' ? 1 : 0 }
    });
    
    // Populate vendor info for response
    await charger.populate('vendorId', 'vendorName email shopName mobileNumber');
    
    res.status(201).json({
      success: true,
      message: 'Charger created successfully',
      charger
    });
  } catch (error) {
    console.error('Admin create charger error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Update charger for admin
const updateCharger = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // Find existing charger
    const existingCharger = await Charger.findById(id);
    if (!existingCharger) {
      return res.status(404).json({
        success: false,
        message: 'Charger not found'
      });
    }
    
    // If vendor is being changed, validate and update counts
    if (updateData.vendorId && updateData.vendorId !== existingCharger.vendorId.toString()) {
      const newVendor = await Vendor.findById(updateData.vendorId);
      if (!newVendor) {
        return res.status(400).json({
          success: false,
          message: 'New vendor not found'
        });
      }
      
      // Update old vendor counts
      await Vendor.findByIdAndUpdate(existingCharger.vendorId, {
        $inc: { totalChargers: -1, activeChargers: existingCharger.status === 'Available' ? -1 : 0 }
      });
      
      // Update new vendor counts
      await Vendor.findByIdAndUpdate(updateData.vendorId, {
        $inc: { totalChargers: 1, activeChargers: updateData.status === 'Available' ? 1 : 0 }
      });
    } else if (updateData.status && updateData.status !== existingCharger.status) {
      // Update active charger count based on status change
      const activeIncrement = updateData.status === 'Available' ? 1 : -1;
      const oldActiveIncrement = existingCharger.status === 'Available' ? -1 : 0;
      
      await Vendor.findByIdAndUpdate(existingCharger.vendorId, {
        $inc: { activeChargers: activeIncrement + oldActiveIncrement }
      });
    }
    
    // Update charger
    const updatedCharger = await Charger.findByIdAndUpdate(id, updateData, { new: true })
      .populate('vendorId', 'vendorName email shopName mobileNumber');
    
    res.status(200).json({
      success: true,
      message: 'Charger updated successfully',
      charger: updatedCharger
    });
  } catch (error) {
    console.error('Admin update charger error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Delete charger for admin
const deleteCharger = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find charger
    const charger = await Charger.findById(id);
    if (!charger) {
      return res.status(404).json({
        success: false,
        message: 'Charger not found'
      });
    }
    
    // Update vendor charger counts
    await Vendor.findByIdAndUpdate(charger.vendorId, {
      $inc: { 
        totalChargers: -1, 
        activeChargers: charger.status === 'Available' ? -1 : 0 
      }
    });
    
    // Delete charger
    await Charger.findByIdAndDelete(id);
    
    res.status(200).json({
      success: true,
      message: 'Charger deleted successfully'
    });
  } catch (error) {
    console.error('Admin delete charger error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get chargers by vendor for admin
const getChargersByVendor = async (req, res) => {
  try {
    const { vendorId } = req.params;
    const { page = 1, limit = 10, status } = req.query;
    
    // Validate vendor exists
    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }
    
    // Build query
    let query = { vendorId };
    if (status) {
      query.status = status;
    }
    
    // Get chargers
    const chargers = await Charger.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();
    
    // Get total count
    const total = await Charger.countDocuments(query);
    
    res.status(200).json({
      success: true,
      vendor: {
        id: vendor._id,
        vendorName: vendor.vendorName,
        shopName: vendor.shopName,
        email: vendor.email,
        mobileNumber: vendor.mobileNumber,
        totalChargers: vendor.totalChargers,
        activeChargers: vendor.activeChargers
      },
      chargers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Admin get chargers by vendor error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get admin charger statistics
const getChargerStats = async (req, res) => {
  try {
    const stats = await Promise.all([
      Charger.countDocuments(),
      Charger.countDocuments({ status: 'Available' }),
      Charger.countDocuments({ status: 'Offline' }),
      Charger.countDocuments({ status: 'In_Session' }),
      Charger.countDocuments({ status: 'On_Maintenance' }),
      Charger.countDocuments({ status: 'Reserved' }),
      Vendor.countDocuments({ isActive: true }),
      Vendor.countDocuments({ isActive: false })
    ]);
    
    const [
      totalChargers,
      availableChargers,
      offlineChargers,
      inSessionChargers,
      maintenanceChargers,
      reservedChargers,
      activeVendors,
      inactiveVendors
    ] = stats;
    
    // Get vendor with most chargers
    const topVendor = await Vendor.aggregate([
      {
        $match: { isActive: true }
      },
      {
        $project: {
          vendorName: 1,
          shopName: 1,
          totalChargers: 1,
          activeChargers: 1
        }
      },
      {
        $sort: { totalChargers: -1 }
      },
      {
        $limit: 1
      }
    ]);
    
    res.status(200).json({
      success: true,
      stats: {
        totalChargers,
        availableChargers,
        offlineChargers,
        inSessionChargers,
        maintenanceChargers,
        reservedChargers,
        activeVendors,
        inactiveVendors,
        topVendor: topVendor[0] || null
      }
    });
  } catch (error) {
    console.error('Admin charger stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

module.exports = {
  getAllChargers,
  getChargerById,
  createCharger,
  updateCharger,
  deleteCharger,
  getChargersByVendor,
  getChargerStats
};
