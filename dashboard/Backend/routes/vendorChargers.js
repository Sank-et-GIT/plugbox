const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Charger = require('../models/Charger');
const { authMiddleware, vendorMiddleware } = require('../middleware/vendorAuth');

// Create new charger
router.post('/', [
  authMiddleware,
  vendorMiddleware,
  body('chargerName').trim().notEmpty().withMessage('Charger name is required'),
  body('chargerType').isIn(['AC_TYPE_1', 'AC_TYPE_2', 'DC_CHAdeMO', 'DC_CSS', 'DC_TESLA']).withMessage('Invalid charger type'),
  body('powerRating').isFloat({ min: 3.3 }).withMessage('Power rating must be at least 3.3 kW'),
  body('pricePerKwh').isFloat({ min: 0 }).withMessage('Price per kWh must be non-negative'),
  body('location.address').notEmpty().withMessage('Address is required'),
  body('location.city').notEmpty().withMessage('City is required'),
  body('location.state').notEmpty().withMessage('State is required'),
  body('location.pincode').notEmpty().withMessage('Pincode is required'),
  body('location.coordinates.latitude').isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),
  body('location.coordinates.longitude').isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude'),
  body('hardwareSerialNumber').notEmpty().withMessage('Hardware serial number is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const vendorId = req.user._id;
    
    // Generate unique charger ID
    const chargerId = `CHR-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Check if serial number already exists
    const existingCharger = await Charger.findOne({ 
      hardwareSerialNumber: req.body.hardwareSerialNumber 
    });
    
    if (existingCharger) {
      return res.status(400).json({
        success: false,
        message: 'Hardware serial number already exists'
      });
    }

    const charger = new Charger({
      ...req.body,
      chargerId,
      vendorId
    });

    await charger.save();

    res.status(201).json({
      success: true,
      message: 'Charger created successfully',
      data: charger
    });
  } catch (error) {
    console.error('Create charger error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating charger'
    });
  }
});

// Get single charger
router.get('/:id', authMiddleware, vendorMiddleware, async (req, res) => {
  try {
    const charger = await Charger.findOne({
      _id: req.params.id,
      vendorId: req.user._id,
      isActive: true
    });

    if (!charger) {
      return res.status(404).json({
        success: false,
        message: 'Charger not found'
      });
    }

    res.json({
      success: true,
      data: charger
    });
  } catch (error) {
    console.error('Get charger error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching charger'
    });
  }
});

// Update charger
router.put('/:id', [
  authMiddleware,
  vendorMiddleware,
  body('chargerName').optional().trim().notEmpty().withMessage('Charger name cannot be empty'),
  body('chargerType').optional().isIn(['AC_TYPE_1', 'AC_TYPE_2', 'DC_CHAdeMO', 'DC_CSS', 'DC_TESLA']).withMessage('Invalid charger type'),
  body('powerRating').optional().isFloat({ min: 3.3 }).withMessage('Power rating must be at least 3.3 kW'),
  body('pricePerKwh').optional().isFloat({ min: 0 }).withMessage('Price per kWh must be non-negative'),
  body('location.address').optional().notEmpty().withMessage('Address cannot be empty'),
  body('location.city').optional().notEmpty().withMessage('City cannot be empty'),
  body('location.state').optional().notEmpty().withMessage('State cannot be empty'),
  body('location.pincode').optional().notEmpty().withMessage('Pincode cannot be empty'),
  body('location.coordinates.latitude').optional().isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),
  body('location.coordinates.longitude').optional().isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const charger = await Charger.findOne({
      _id: req.params.id,
      vendorId: req.user._id,
      isActive: true
    });

    if (!charger) {
      return res.status(404).json({
        success: false,
        message: 'Charger not found'
      });
    }

    // Don't allow updating vendorId or chargerId
    const { vendorId, chargerId, ...updateData } = req.body;

    Object.assign(charger, updateData);
    await charger.save();

    res.json({
      success: true,
      message: 'Charger updated successfully',
      data: charger
    });
  } catch (error) {
    console.error('Update charger error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating charger'
    });
  }
});

// Delete charger (soft delete)
router.delete('/:id', authMiddleware, vendorMiddleware, async (req, res) => {
  try {
    const charger = await Charger.findOne({
      _id: req.params.id,
      vendorId: req.user._id,
      isActive: true
    });

    if (!charger) {
      return res.status(404).json({
        success: false,
        message: 'Charger not found'
      });
    }

    // Check if charger has active sessions
    const Session = require('../models/Session');
    const activeSessions = await Session.countDocuments({
      chargerId: charger._id,
      status: 'active'
    });

    if (activeSessions > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete charger with active sessions'
      });
    }

    // Soft delete
    charger.isActive = false;
    charger.status = 'maintenance';
    await charger.save();

    res.json({
      success: true,
      message: 'Charger deleted successfully'
    });
  } catch (error) {
    console.error('Delete charger error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting charger'
    });
  }
});

// Update charger status
router.patch('/:id/status', [
  authMiddleware,
  vendorMiddleware,
  body('status').isIn(['available', 'offline', 'maintenance']).withMessage('Invalid status')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const charger = await Charger.findOne({
      _id: req.params.id,
      vendorId: req.user._id,
      isActive: true
    });

    if (!charger) {
      return res.status(404).json({
        success: false,
        message: 'Charger not found'
      });
    }

    const { status } = req.body;

    // Check if charger is in use when trying to change status
    if (status !== 'available' && charger.status === 'in_use') {
      return res.status(400).json({
        success: false,
        message: 'Cannot change status while charger is in use'
      });
    }

    charger.status = status;
    await charger.save();

    res.json({
      success: true,
      message: 'Charger status updated successfully',
      data: charger
    });
  } catch (error) {
    console.error('Update charger status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating charger status'
    });
  }
});

// Get charger performance analytics
router.get('/:id/analytics', authMiddleware, vendorMiddleware, async (req, res) => {
  try {
    const charger = await Charger.findOne({
      _id: req.params.id,
      vendorId: req.user._id,
      isActive: true
    });

    if (!charger) {
      return res.status(404).json({
        success: false,
        message: 'Charger not found'
      });
    }

    const Session = require('../models/Session');

    // Get session statistics
    const sessionStats = await Session.aggregate([
      { $match: { chargerId: charger._id } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalUnits: { $sum: '$unitsConsumed' },
          totalRevenue: { $sum: '$totalAmount' }
        }
      }
    ]);

    // Get recent sessions
    const recentSessions = await Session.find({ chargerId: charger._id })
      .populate('userId', 'name email')
      .sort({ startTime: -1 })
      .limit(10);

    // Get monthly usage (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyUsage = await Session.aggregate([
      {
        $match: {
          chargerId: charger._id,
          startTime: { $gte: sixMonthsAgo }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$startTime' },
            month: { $month: '$startTime' }
          },
          sessions: { $sum: 1 },
          unitsConsumed: { $sum: '$unitsConsumed' },
          revenue: { $sum: '$totalAmount' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    res.json({
      success: true,
      data: {
        charger,
        sessionStats: sessionStats.reduce((acc, stat) => {
          acc[stat._id] = {
            count: stat.count,
            totalUnits: stat.totalUnits,
            totalRevenue: stat.totalRevenue
          };
          return acc;
        }, {}),
        recentSessions,
        monthlyUsage: monthlyUsage.map(item => ({
          month: `${item._id.year}-${String(item._id.month).padStart(2, '0')}`,
          sessions: item.sessions,
          unitsConsumed: item.unitsConsumed,
          revenue: item.revenue
        }))
      }
    });
  } catch (error) {
    console.error('Get charger analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching charger analytics'
    });
  }
});

module.exports = router;
