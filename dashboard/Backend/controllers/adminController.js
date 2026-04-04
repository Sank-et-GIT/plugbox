const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Get Admin Dashboard Stats
const getAdminDashboard = async (req, res) => {
  try {
    // Get overall system statistics
    const [
      totalVendors,
      activeVendors,
      totalChargers,
      activeChargers,
      totalUsers,
      totalSessions,
      activeSessions,
      totalRevenue
    ] = await Promise.all([
      prisma.vendor.count(),
      prisma.vendor.count({ where: { isActive: true } }),
      prisma.charger.count(),
      prisma.charger.count({ where: { status: 'ONLINE' } }),
      prisma.user.count(),
      prisma.session.count(),
      prisma.session.count({ where: { status: 'ACTIVE' } }),
      prisma.walletTransaction.aggregate({
        where: { type: 'PACKAGE_DEBIT' },
        _sum: { amountPaise: true }
      })
    ]);

    res.json({
      stats: {
        vendors: {
          total: totalVendors,
          active: activeVendors
        },
        chargers: {
          total: totalChargers,
          active: activeChargers
        },
        users: {
          total: totalUsers
        },
        sessions: {
          total: totalSessions,
          active: activeSessions
        },
        revenue: {
          total: totalRevenue._sum.amountPaise || 0
        }
      }
    });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get All Vendors (Admin only)
const getAllVendors = async (req, res) => {
  try {
    const vendors = await prisma.vendor.findMany({
      include: {
        user: true,
        chargers: {
          select: {
            id: true,
            name: true,
            status: true,
            displayName: true
          }
        },
        _count: {
          select: {
            chargers: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json({
      vendors: vendors.map(vendor => ({
        id: vendor.id,
        companyName: vendor.companyName,
        email: vendor.email,
        phoneNumber: vendor.phoneNumber,
        kycStatus: vendor.kycStatus,
        isActive: vendor.isActive,
        walletBalance: vendor.walletBalance,
        createdAt: vendor.createdAt,
        lastLogin: vendor.lastLogin,
        chargerCount: vendor._count.chargers,
        chargers: vendor.chargers,
        name: vendor.user?.name || vendor.companyName,
        user: {
          name: vendor.user.name,
          phone: vendor.user.phone,
          email: vendor.user.email
        }
      }))
    });
  } catch (error) {
    console.error('Get all vendors error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get All Chargers (Admin only)
const getAllChargers = async (req, res) => {
  try {
    const chargers = await prisma.charger.findMany({
      include: {
        vendor: {
          select: {
            id: true,
            companyName: true,
            email: true
          }
        },
        location: true,
        _count: {
          select: {
            sessions: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json({
      chargers: chargers.map(charger => ({
        id: charger.id,
        name: charger.name,
        displayName: charger.displayName,
        status: charger.status,
        deviceId: charger.deviceId,
        slotNumber: charger.slotNumber,
        lat: charger.lat,
        lng: charger.lng,
        createdAt: charger.createdAt,
        lastSeen: charger.lastSeen,
        vendor: charger.vendor,
        location: charger.location,
        sessionCount: charger._count.sessions
      }))
    });
  } catch (error) {
    console.error('Get all chargers error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get All Users (Admin only)
const getAllUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      include: {
        _count: {
          select: {
            bookings: true,
            sessions: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json({
      users: users.map(user => ({
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
        bookingCount: user._count.bookings,
        sessionCount: user._count.sessions
      }))
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Toggle Vendor Status (Admin only)
const toggleVendorStatus = async (req, res) => {
  try {
    const { vendorId } = req.params;
    const { isActive } = req.body;

    const vendor = await prisma.vendor.update({
      where: { id: vendorId },
      data: { isActive },
      include: {
        user: true
      }
    });

    res.json({
      message: `Vendor ${isActive ? 'activated' : 'deactivated'} successfully`,
      vendor: {
        id: vendor.id,
        companyName: vendor.companyName,
        email: vendor.email,
        isActive: vendor.isActive,
        name: vendor.user?.name || vendor.companyName
      }
    });
  } catch (error) {
    console.error('Toggle vendor status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Toggle Charger Status (Admin only)
const toggleChargerStatus = async (req, res) => {
  try {
    const { chargerId } = req.params;
    const { status } = req.body;

    const charger = await prisma.charger.update({
      where: { id: parseInt(chargerId) },
      data: { status },
      include: {
        vendor: {
          select: {
            id: true,
            companyName: true,
            email: true
          }
        }
      }
    });

    res.json({
      message: `Charger status updated to ${status} successfully`,
      charger
    });
  } catch (error) {
    console.error('Toggle charger status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getAdminDashboard,
  getAllVendors,
  getAllChargers,
  getAllUsers,
  toggleVendorStatus,
  toggleChargerStatus
};
