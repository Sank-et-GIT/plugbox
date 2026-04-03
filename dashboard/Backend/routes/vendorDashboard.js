const express = require('express');
const router = express.Router();
const Charger = require('../models/Charger');
const Session = require('../models/Session');
const { authMiddleware, vendorMiddleware } = require('../middleware/vendorAuth');

// Get vendor dashboard statistics
router.get('/stats', authMiddleware, vendorMiddleware, async (req, res) => {
  try {
    const vendorId = req.user._id;

    // Get total chargers
    const totalChargers = await Charger.countDocuments({ 
      vendorId, 
      isActive: true 
    });

    // Get charger status breakdown
    const chargerStats = await Charger.aggregate([
      { $match: { vendorId, isActive: true } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    // Get total sessions
    const totalSessions = await Session.countDocuments({ 
      vendorId 
    });

    // Get session status breakdown
    const sessionStats = await Session.aggregate([
      { $match: { vendorId } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    // Calculate total earnings (sum of all paid sessions)
    const totalEarnings = await Session.aggregate([
      { $match: { vendorId, paymentStatus: 'paid' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);

    // Get recent sessions
    const recentSessions = await Session.find({ vendorId })
      .populate('userId', 'name email')
      .populate('chargerId', 'chargerName location')
      .sort({ startTime: -1 })
      .limit(10);

    // Get today's earnings
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayEarnings = await Session.aggregate([
      { 
        $match: { 
          vendorId, 
          paymentStatus: 'paid',
          startTime: { $gte: today, $lt: tomorrow }
        } 
      },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);

    // Get monthly earnings trend (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyEarnings = await Session.aggregate([
      {
        $match: {
          vendorId,
          paymentStatus: 'paid',
          startTime: { $gte: sixMonthsAgo }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$startTime' },
            month: { $month: '$startTime' }
          },
          earnings: { $sum: '$totalAmount' },
          sessions: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    res.json({
      success: true,
      data: {
        totalChargers,
        chargerStats: chargerStats.reduce((acc, stat) => {
          acc[stat._id] = stat.count;
          return acc;
        }, {}),
        totalSessions,
        sessionStats: sessionStats.reduce((acc, stat) => {
          acc[stat._id] = stat.count;
          return acc;
        }, {}),
        totalEarnings: totalEarnings[0]?.total || 0,
        todayEarnings: todayEarnings[0]?.total || 0,
        recentSessions,
        monthlyEarnings: monthlyEarnings.map(item => ({
          month: `${item._id.year}-${String(item._id.month).padStart(2, '0')}`,
          earnings: item.earnings,
          sessions: item.sessions
        }))
      }
    });
  } catch (error) {
    console.error('Vendor dashboard stats error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching vendor dashboard statistics' 
    });
  }
});

// Get vendor's chargers
router.get('/chargers', authMiddleware, vendorMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 10, status, search } = req.query;
    const vendorId = req.user._id;

    // Build query
    const query = { vendorId, isActive: true };
    
    if (status) {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { chargerName: { $regex: search, $options: 'i' } },
        { chargerId: { $regex: search, $options: 'i' } },
        { 'location.address': { $regex: search, $options: 'i' } }
      ];
    }

    const chargers = await Charger.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Charger.countDocuments(query);

    res.json({
      success: true,
      data: {
        chargers,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (error) {
    console.error('Get vendor chargers error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching chargers' 
    });
  }
});

// Get vendor's sessions
router.get('/sessions', authMiddleware, vendorMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 10, status, startDate, endDate } = req.query;
    const vendorId = req.user._id;

    // Build query
    const query = { vendorId };
    
    if (status) {
      query.status = status;
    }

    if (startDate || endDate) {
      query.startTime = {};
      if (startDate) query.startTime.$gte = new Date(startDate);
      if (endDate) query.startTime.$lte = new Date(endDate);
    }

    const sessions = await Session.find(query)
      .populate('userId', 'name email')
      .populate('chargerId', 'chargerName location')
      .sort({ startTime: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Session.countDocuments(query);

    res.json({
      success: true,
      data: {
        sessions,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (error) {
    console.error('Get vendor sessions error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching sessions' 
    });
  }
});

// Get earnings report
router.get('/earnings', authMiddleware, vendorMiddleware, async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    const vendorId = req.user._id;

    let groupBy, dateFormat;
    
    switch (period) {
      case 'day':
        groupBy = {
          year: { $year: '$startTime' },
          month: { $month: '$startTime' },
          day: { $dayOfMonth: '$startTime' }
        };
        dateFormat = '%Y-%m-%d';
        break;
      case 'week':
        groupBy = {
          year: { $year: '$startTime' },
          week: { $week: '$startTime' }
        };
        dateFormat = '%Y-%U';
        break;
      case 'month':
      default:
        groupBy = {
          year: { $year: '$startTime' },
          month: { $month: '$startTime' }
        };
        dateFormat = '%Y-%m';
        break;
    }

    const earnings = await Session.aggregate([
      {
        $match: {
          vendorId,
          paymentStatus: 'paid'
        }
      },
      {
        $group: {
          _id: groupBy,
          earnings: { $sum: '$totalAmount' },
          sessions: { $sum: 1 },
          unitsConsumed: { $sum: '$unitsConsumed' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.week': 1 } }
    ]);

    res.json({
      success: true,
      data: {
        period,
        earnings: earnings.map(item => ({
          period: Object.values(item._id).join('-'),
          earnings: item.earnings,
          sessions: item.sessions,
          unitsConsumed: item.unitsConsumed
        }))
      }
    });
  } catch (error) {
    console.error('Get earnings error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching earnings report' 
    });
  }
});

module.exports = router;
