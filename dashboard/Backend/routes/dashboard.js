const express = require('express');
const { auth, authorize } = require('../middleware/auth');
const User = require('../models/User');
const Vendor = require('../models/Vendor');
const Charger = require('../models/Charger');
const Session = require('../models/Session');

const router = express.Router();

router.get('/stats', auth, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    const [
      totalUsers,
      totalVendors,
      totalChargers,
      activeSessions,
      todayRevenue,
      pendingPayout,
      chargerStats
    ] = await Promise.all([
      User.countDocuments({ isActive: true }),
      Vendor.countDocuments({ isActive: true }),
      Charger.countDocuments({ isActive: true }),
      Session.countDocuments({ status: 'active' }),
      Session.aggregate([
        {
          $match: {
            status: 'completed',
            paymentStatus: 'paid',
            createdAt: { $gte: startOfDay, $lte: endOfDay }
          }
        },
        { $group: { _id: null, total: { $sum: '$totalCost' } } }
      ]),
      Vendor.aggregate([
        { $group: { _id: null, total: { $sum: '$pendingPayout' } } }
      ]),
      Charger.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ])
    ]);

    const revenueToday = todayRevenue[0]?.total || 0;
    const pendingPayoutAmount = pendingPayout[0]?.total || 0;

    const chargerStatusMap = {
      available: 0,
      in_session: 0,
      offline: 0,
      reserved: 0,
      maintenance: 0
    };

    chargerStats.forEach(stat => {
      chargerStatusMap[stat._id] = stat.count;
    });

    const lastWeekUsers = await User.countDocuments({
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    });

    const lastWeekVendors = await Vendor.countDocuments({
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    });

    const yesterdayRevenue = await Session.aggregate([
      {
        $match: {
          status: 'completed',
          paymentStatus: 'paid',
          createdAt: {
            $gte: new Date(startOfDay.getTime() - 24 * 60 * 60 * 1000),
            $lt: startOfDay
          }
        }
      },
      { $group: { _id: null, total: { $sum: '$totalCost' } } }
    ]);

    const yesterdayRevenueAmount = yesterdayRevenue[0]?.total || 0;
    const revenueChange = yesterdayRevenueAmount > 0 
      ? ((revenueToday - yesterdayRevenueAmount) / yesterdayRevenueAmount * 100).toFixed(1)
      : '0';

    res.json({
      totalUsers,
      newUsersThisWeek: lastWeekUsers,
      totalVendors,
      newVendorsThisWeek: lastWeekVendors,
      totalChargers,
      activeSessions,
      revenueToday,
      revenueChange: parseFloat(revenueChange),
      pendingPayout: pendingPayoutAmount,
      chargerStatus: chargerStatusMap
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ message: 'Server error fetching dashboard stats' });
  }
});

router.get('/revenue-trend', auth, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const revenueData = await Session.aggregate([
      {
        $match: {
          status: 'completed',
          paymentStatus: 'paid',
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$createdAt'
            }
          },
          revenue: { $sum: '$totalCost' },
          sessions: { $sum: 1 }
        }
      },
      { $sort: { '_id': 1 } }
    ]);

    res.json(revenueData);
  } catch (error) {
    console.error('Revenue trend error:', error);
    res.status(500).json({ message: 'Server error fetching revenue trend' });
  }
});

router.get('/sessions-over-time', auth, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const sessionData = await Session.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$createdAt'
            }
          },
          active: {
            $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
          },
          completed: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          cancelled: {
            $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
          }
        }
      },
      { $sort: { '_id': 1 } }
    ]);

    res.json(sessionData);
  } catch (error) {
    console.error('Sessions over time error:', error);
    res.status(500).json({ message: 'Server error fetching sessions data' });
  }
});

router.get('/recent-activities', auth, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    const recentSessions = await Session.find()
      .populate('userId', 'name email')
      .populate('chargerId', 'chargerId name')
      .sort({ createdAt: -1 })
      .limit(limit);

    res.json(recentSessions);
  } catch (error) {
    console.error('Recent activities error:', error);
    res.status(500).json({ message: 'Server error fetching recent activities' });
  }
});

router.get('/top-vendors', auth, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    const topVendors = await Vendor.find({ isActive: true })
      .sort({ totalRevenue: -1 })
      .limit(limit)
      .select('vendorName email totalRevenue totalChargers pendingPayout');

    res.json(topVendors);
  } catch (error) {
    console.error('Top vendors error:', error);
    res.status(500).json({ message: 'Server error fetching top vendors' });
  }
});

module.exports = router;
