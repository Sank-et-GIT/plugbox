const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { vendorAuth } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Get all chargers for the logged-in vendor
router.get('/', vendorAuth, async (req, res) => {
  try {
    const vendorId = req.vendor.id;

    const chargers = await prisma.charger.findMany({
      where: {
        vendorId: vendorId
      },
      include: {
        location: true,
        sessions: {
          where: {
            status: 'ACTIVE'
          }
        },
        _count: {
          select: {
            sessions: true,
            bookings: {
              where: {
                status: 'HOLD'
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Transform the data to match expected format
    const transformedChargers = chargers.map(charger => ({
      id: charger.id,
      name: charger.name,
      displayName: charger.displayName,
      status: charger.status.toLowerCase(),
      location: charger.location ? {
        address: charger.location.address,
        name: charger.location.name,
        coordinates: {
          latitude: charger.lat,
          longitude: charger.lng
        }
      } : null,
      deviceId: charger.deviceId,
      mqttTopic: charger.mqttTopic,
      slotNumber: charger.slotNumber,
      lastSeen: charger.lastSeen,
      createdAt: charger.createdAt,
      activeSessions: charger.sessions.length,
      totalBookings: charger._count.bookings,
      totalSessions: charger._count.sessions,
      energyReadings: charger.energyReadings || []
    }));

    res.json({
      success: true,
      data: transformedChargers,
      count: transformedChargers.length
    });
  } catch (error) {
    console.error('Get vendor chargers error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching chargers'
    });
  }
});

// Get vendor charger statistics
router.get('/stats', vendorAuth, async (req, res) => {
  try {
    const vendorId = req.vendor.id;

    const [
      totalChargers,
      availableChargers,
      inSessionChargers,
      offlineChargers,
      reservedChargers,
      maintenanceChargers
    ] = await Promise.all([
      prisma.charger.count({
        where: { vendorId }
      }),
      prisma.charger.count({
        where: { 
          vendorId,
          status: 'AVAILABLE'
        }
      }),
      prisma.charger.count({
        where: { 
          vendorId,
          status: 'IN_SESSION'
        }
      }),
      prisma.charger.count({
        where: { 
          vendorId,
          status: 'OFFLINE'
        }
      }),
      prisma.charger.count({
        where: { 
          vendorId,
          status: 'RESERVED'
        }
      }),
      prisma.charger.count({
        where: { 
          vendorId,
          status: 'MAINTENANCE'
        }
      })
    ]);

    // Get active sessions count
    const activeSessions = await prisma.session.count({
      where: {
        charger: {
          vendorId
        },
        status: 'ACTIVE'
      }
    });

    // Get total revenue from completed sessions
    const revenueData = await prisma.session.aggregate({
      where: {
        charger: {
          vendorId
        },
        status: 'ENDED'
      },
      _sum: {
        finalKwh: true
      },
      _count: true
    });

    const totalRevenue = revenueData._sum.finalKwh || 0;
    const totalSessions = revenueData._count;

    res.json({
      success: true,
      data: {
        totalChargers,
        availableChargers,
        chargersInSession: inSessionChargers,
        offlineChargers,
        reservedChargers,
        maintenanceChargers,
        activeSessions,
        totalSessions,
        totalRevenue
      }
    });
  } catch (error) {
    console.error('Get vendor charger stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching charger statistics'
    });
  }
});

// Get single charger by ID
router.get('/:id', vendorAuth, async (req, res) => {
  try {
    const vendorId = req.vendor.id;
    const chargerId = parseInt(req.params.id);

    const charger = await prisma.charger.findFirst({
      where: {
        id: chargerId,
        vendorId: vendorId
      },
      include: {
        location: true,
        sessions: {
          orderBy: {
            createdAt: 'desc'
          },
          take: 10,
          include: {
            user: {
              select: {
                name: true,
                email: true
              }
            }
          }
        },
        bookings: {
          where: {
            status: 'HOLD'
          },
          include: {
            user: {
              select: {
                name: true,
                email: true
              }
            }
          }
        },
        energyReadings: {
          orderBy: {
            createdAt: 'desc'
          },
          take: 50
        }
      }
    });

    if (!charger) {
      return res.status(404).json({
        success: false,
        message: 'Charger not found'
      });
    }

    // Transform the data
    const transformedCharger = {
      id: charger.id,
      name: charger.name,
      displayName: charger.displayName,
      status: charger.status.toLowerCase(),
      location: charger.location ? {
        address: charger.location.address,
        name: charger.location.name,
        coordinates: {
          latitude: charger.lat,
          longitude: charger.lng
        }
      } : null,
      deviceId: charger.deviceId,
      mqttTopic: charger.mqttTopic,
      slotNumber: charger.slotNumber,
      lastSeen: charger.lastSeen,
      createdAt: charger.createdAt,
      sessions: charger.sessions.map(session => ({
        id: session.id,
        status: session.status.toLowerCase(),
        createdAt: session.createdAt,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        finalKwh: session.finalKwh,
        user: session.user
      })),
      bookings: charger.bookings,
      energyReadings: charger.energyReadings
    };

    res.json({
      success: true,
      data: transformedCharger
    });
  } catch (error) {
    console.error('Get charger error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching charger'
    });
  }
});

// Update charger status
router.patch('/:id/status', vendorAuth, async (req, res) => {
  try {
    const vendorId = req.vendor.id;
    const chargerId = parseInt(req.params.id);
    const { status } = req.body;

    if (!['AVAILABLE', 'OFFLINE', 'MAINTENANCE', 'IN_SESSION', 'RESERVED'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    const charger = await prisma.charger.findFirst({
      where: {
        id: chargerId,
        vendorId: vendorId
      }
    });

    if (!charger) {
      return res.status(404).json({
        success: false,
        message: 'Charger not found'
      });
    }

    const updatedCharger = await prisma.charger.update({
      where: {
        id: chargerId
      },
      data: {
        status: status
      }
    });

    res.json({
      success: true,
      message: 'Charger status updated successfully',
      data: {
        id: updatedCharger.id,
        status: updatedCharger.status.toLowerCase()
      }
    });
  } catch (error) {
    console.error('Update charger status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating charger status'
    });
  }
});

module.exports = router;
