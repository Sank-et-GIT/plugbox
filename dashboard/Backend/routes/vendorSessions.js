const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Session = require('../models/Session');
const Charger = require('../models/Charger');
const User = require('../models/User');
const { authMiddleware, vendorMiddleware } = require('../middleware/vendorAuth');

// Start new charging session
router.post('/start', [
  authMiddleware,
  vendorMiddleware,
  body('chargerId').notEmpty().withMessage('Charger ID is required'),
  body('userId').notEmpty().withMessage('User ID is required'),
  body('estimatedUnits').optional().isFloat({ min: 0 }).withMessage('Estimated units must be non-negative')
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

    const { chargerId, userId, estimatedUnits } = req.body;
    const vendorId = req.user._id;

    // Verify charger belongs to vendor and is available
    const charger = await Charger.findOne({
      _id: chargerId,
      vendorId,
      status: 'available',
      isActive: true
    });

    if (!charger) {
      return res.status(400).json({
        success: false,
        message: 'Charger not available or not found'
      });
    }

    // Verify user exists and is active
    const user = await User.findOne({
      _id: userId,
      isActive: true
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'User not found or inactive'
      });
    }

    // Check if user already has an active session
    const activeSession = await Session.findOne({
      userId,
      status: 'active'
    });

    if (activeSession) {
      return res.status(400).json({
        success: false,
        message: 'User already has an active charging session'
      });
    }

    // Generate session ID
    const sessionId = `SES-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Create session
    const session = new Session({
      sessionId,
      userId,
      vendorId,
      chargerId,
      startTime: new Date(),
      pricePerKwh: charger.pricePerKwh,
      status: 'active'
    });

    // Update charger status
    charger.status = 'in_use';
    await charger.save();

    await session.save();

    res.status(201).json({
      success: true,
      message: 'Charging session started successfully',
      data: session
    });
  } catch (error) {
    console.error('Start session error:', error);
    res.status(500).json({
      success: false,
      message: 'Error starting charging session'
    });
  }
});

// End charging session
router.post('/:sessionId/end', [
  authMiddleware,
  vendorMiddleware,
  body('unitsConsumed').isFloat({ min: 0 }).withMessage('Units consumed must be non-negative')
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

    const { sessionId } = req.params;
    const { unitsConsumed } = req.body;
    const vendorId = req.user._id;

    // Find and verify session
    const session = await Session.findOne({
      sessionId,
      vendorId,
      status: 'active'
    }).populate('chargerId');

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Active session not found'
      });
    }

    // Calculate total amount
    const totalAmount = unitsConsumed * session.pricePerKwh;

    // Update session
    session.endTime = new Date();
    session.unitsConsumed = unitsConsumed;
    session.totalAmount = totalAmount;
    session.status = 'completed';

    await session.save();

    // Update charger status
    const charger = await Charger.findById(session.chargerId._id);
    if (charger) {
      charger.status = 'available';
      charger.totalSessions += 1;
      charger.totalRevenue += totalAmount;
      await charger.save();
    }

    res.json({
      success: true,
      message: 'Charging session completed successfully',
      data: session
    });
  } catch (error) {
    console.error('End session error:', error);
    res.status(500).json({
      success: false,
      message: 'Error ending charging session'
    });
  }
});

// Process payment for session
router.post('/:sessionId/payment', [
  authMiddleware,
  vendorMiddleware,
  body('paymentMethod').isIn(['wallet', 'card', 'upi', 'cash']).withMessage('Invalid payment method')
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

    const { sessionId } = req.params;
    const { paymentMethod } = req.body;
    const vendorId = req.user._id;

    // Find session
    const session = await Session.findOne({
      sessionId,
      vendorId,
      status: 'completed',
      paymentStatus: 'pending'
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found or payment already processed'
      });
    }

    // Process payment (in real implementation, integrate with payment gateway)
    // For now, we'll mark as paid
    session.paymentMethod = paymentMethod;
    session.paymentStatus = 'paid';
    await session.save();

    res.json({
      success: true,
      message: 'Payment processed successfully',
      data: session
    });
  } catch (error) {
    console.error('Process payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing payment'
    });
  }
});

// Get active sessions for vendor
router.get('/active', authMiddleware, vendorMiddleware, async (req, res) => {
  try {
    const vendorId = req.user._id;

    const activeSessions = await Session.find({
      vendorId,
      status: 'active'
    })
    .populate('userId', 'name email phoneNumber')
    .populate('chargerId', 'chargerName location')
    .sort({ startTime: -1 });

    res.json({
      success: true,
      data: activeSessions
    });
  } catch (error) {
    console.error('Get active sessions error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching active sessions'
    });
  }
});

// Get session details
router.get('/:sessionId', authMiddleware, vendorMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const vendorId = req.user._id;

    const session = await Session.findOne({
      sessionId,
      vendorId
    })
    .populate('userId', 'name email phoneNumber')
    .populate('chargerId', 'chargerName location pricePerKwh');

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    res.json({
      success: true,
      data: session
    });
  } catch (error) {
    console.error('Get session error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching session'
    });
  }
});

// Cancel session
router.post('/:sessionId/cancel', authMiddleware, vendorMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const vendorId = req.user._id;

    const session = await Session.findOne({
      sessionId,
      vendorId,
      status: 'active'
    }).populate('chargerId');

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Active session not found'
      });
    }

    // Calculate partial usage if any
    const duration = Math.round((new Date() - session.startTime) / (1000 * 60)); // minutes
    const unitsConsumed = 0; // No consumption if cancelled immediately
    const totalAmount = 0; // No charge for cancelled sessions

    // Update session
    session.endTime = new Date();
    session.duration = duration;
    session.unitsConsumed = unitsConsumed;
    session.totalAmount = totalAmount;
    session.status = 'cancelled';
    session.paymentStatus = 'refunded';

    await session.save();

    // Update charger status
    const charger = await Charger.findById(session.chargerId._id);
    if (charger) {
      charger.status = 'available';
      await charger.save();
    }

    res.json({
      success: true,
      message: 'Session cancelled successfully',
      data: session
    });
  } catch (error) {
    console.error('Cancel session error:', error);
    res.status(500).json({
      success: false,
      message: 'Error cancelling session'
    });
  }
});

// Get session analytics
router.get('/analytics/summary', authMiddleware, vendorMiddleware, async (req, res) => {
  try {
    const vendorId = req.user._id;
    const { period = 'week' } = req.query;

    let startDate;
    const endDate = new Date();

    switch (period) {
      case 'day':
        startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      default:
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);
    }

    const analytics = await Session.aggregate([
      {
        $match: {
          vendorId,
          startTime: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalUnits: { $sum: '$unitsConsumed' },
          totalRevenue: { $sum: '$totalAmount' },
          avgDuration: { $avg: '$duration' }
        }
      }
    ]);

    const paymentStats = await Session.aggregate([
      {
        $match: {
          vendorId,
          startTime: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$paymentStatus',
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        period,
        analytics: analytics.reduce((acc, item) => {
          acc[item._id] = {
            count: item.count,
            totalUnits: item.totalUnits,
            totalRevenue: item.totalRevenue,
            avgDuration: item.avgDuration
          };
          return acc;
        }, {}),
        paymentStats: paymentStats.reduce((acc, item) => {
          acc[item._id] = {
            count: item.count,
            totalAmount: item.totalAmount
          };
          return acc;
        }, {})
      }
    });
  } catch (error) {
    console.error('Get session analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching session analytics'
    });
  }
});

module.exports = router;
