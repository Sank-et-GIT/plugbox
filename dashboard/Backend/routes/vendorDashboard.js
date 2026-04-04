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
    const totalChargers = await Charger.countDocuments({ vendorId });

    // Get charger status breakdown
    const chargerStats = await Charger.aggregate([
      { $match: { vendorId } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const chargerStatusMap = {};
    chargerStats.forEach(stat => {
      chargerStatusMap[stat._id] = stat.count;
    });

    // Get active sessions count
    const activeSessions = await Session.countDocuments({ 
      vendorId, 
      status: 'active' 
    });

    // Get session statistics
    const sessionStats = await Session.aggregate([
      { $match: { vendorId } },
      {
        $group: {
          _id: null,
          totalSessions: { $sum: 1 },
          totalEarnings: { $sum: '$totalAmount' },
          totalUnitsDelivered: { $sum: '$unitsConsumed' },
          completedSessions: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          }
        }
      }
    ]);

    // Get today's statistics
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayStats = await Session.aggregate([
      { 
        $match: { 
          vendorId,
          startTime: { $gte: today, $lt: tomorrow }
        }
      },
      {
        $group: {
          _id: null,
          todayEarnings: { $sum: '$totalAmount' },
          todayUnits: { $sum: '$unitsConsumed' },
          todaySessions: { $sum: 1 }
        }
      }
    ]);

    // Get recent sessions
    const recentSessions = await Session.find({ vendorId })
      .populate('chargerId', 'chargerName location.address')
      .populate('userId', 'name email')
      .sort({ startTime: -1 })
      .limit(5);

    // Calculate average session duration
    const avgDurationStats = await Session.aggregate([
      { $match: { vendorId, status: 'completed', duration: { $gt: 0 } } },
      {
        $group: {
          _id: null,
          avgDuration: { $avg: '$duration' }
        }
      }
    ]);

    const stats = sessionStats[0] || { totalSessions: 0, totalEarnings: 0, totalUnitsDelivered: 0, completedSessions: 0 };
    const todayData = todayStats[0] || { todayEarnings: 0, todayUnits: 0, todaySessions: 0 };
    const avgDuration = avgDurationStats[0]?.avgDuration || 0;

    // Get monthly earnings for the last 6 months
    const monthlyEarnings = await Session.aggregate([
      { $match: { vendorId, status: 'completed' } },
      {
        $group: {
          _id: {
            year: { $year: '$startTime' },
            month: { $month: '$startTime' }
          },
          earnings: { $sum: '$totalAmount' },
          sessions: { $sum: 1 },
          units: { $sum: '$unitsConsumed' }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 6 }
    ]);

    res.json({
      success: true,
      data: {
        summary: {
          totalChargers,
          activeChargers: chargerStatusMap['Available'] || 0,
          chargersInSession: chargerStatusMap['In_Session'] || 0,
          offlineChargers: chargerStatusMap['Offline'] || 0,
          reservedChargers: chargerStatusMap['Reserved'] || 0,
          maintenanceChargers: chargerStatusMap['On_Maintenance'] || 0,
          activeSessions,
          totalSessions: stats.totalSessions,
          completedSessions: stats.completedSessions,
          totalEarnings: stats.totalEarnings,
          todayEarnings: todayData.todayEarnings,
          totalUnitsDelivered: stats.totalUnitsDelivered,
          todayUnits: todayData.todayUnits,
          avgSessionDuration: Math.round(avgDuration)
        },
        recentSessions,
        monthlyEarnings: monthlyEarnings.map(item => ({
          month: new Date(item._id.year, item._id.month - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          earnings: item.earnings,
          sessions: item.sessions,
          units: item.units
        })).reverse()
      }
    });
  } catch (error) {
    console.error('Error fetching vendor dashboard stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching dashboard statistics'
    });
  }
});

module.exports = router;
