const User = require("../models/User");
const Vendor = require("../models/Vendor");
const Charger = require("../models/Charger");
const Session = require("../models/Session");
const Payment = require("../models/Payment");
const Payout = require("../models/Payout");


// DASHBOARD REPORT
exports.getDashboardReport = async (req, res) => {
  try {

    const totalUsers = await User.countDocuments();
    const totalVendors = await Vendor.countDocuments();
    const totalChargers = await Charger.countDocuments();

    const activeSessions = await Session.countDocuments({
      status: "ACTIVE"
    });

    const revenue = await Payment.aggregate([
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$amount" }
        }
      }
    ]);

    const pendingPayouts = await Payout.aggregate([
      {
        $match: { payoutStatus: "PENDING" }
      },
      {
        $group: {
          _id: null,
          totalPending: { $sum: "$vendorShare" }
        }
      }
    ]);

    res.json({
      totalUsers,
      totalVendors,
      totalChargers,
      activeSessions,
      totalRevenue: revenue[0]?.totalRevenue || 0,
      pendingPayouts: pendingPayouts[0]?.totalPending || 0
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};



// REVENUE REPORT
exports.getRevenueReport = async (req, res) => {
  try {

    const revenue = await Payment.aggregate([
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$amount" },
          totalTransactions: { $sum: 1 }
        }
      }
    ]);

    res.json(revenue);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};



// CHARGER USAGE REPORT
exports.getChargerUsageReport = async (req, res) => {
  try {

    const usage = await Session.aggregate([
      {
        $group: {
          _id: "$chargerId",
          totalSessions: { $sum: 1 },
          totalUnits: { $sum: "$unitsConsumed" }
        }
      }
    ]);

    res.json(usage);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};



// VENDOR PERFORMANCE REPORT
exports.getVendorPerformanceReport = async (req, res) => {
  try {

    const performance = await Payout.aggregate([
      {
        $group: {
          _id: "$vendorId",
          totalEarnings: { $sum: "$vendorShare" },
          totalPayouts: { $sum: 1 }
        }
      }
    ]);

    res.json(performance);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};