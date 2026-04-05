const express = require("express");
const router = express.Router();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// GET /admin/chargers - Get all chargers for admin
router.get("/chargers", async (req, res) => {
  try {
    console.log('🔍 Admin fetching all chargers...');
    
    // Get all chargers with vendor information
    const chargers = await prisma.charger.findMany({
      include: {
        vendor: {
          include: {
            user: true
          }
        },
        location: true,
        sessions: {
          where: {
            status: 'COMPLETED'
          },
          take: 5,
          orderBy: {
            createdAt: 'desc'
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`Found ${chargers.length} chargers`);

    // Transform data for frontend
    const transformedChargers = chargers.map(charger => ({
      id: charger.id,
      name: charger.name,
      deviceId: charger.deviceId,
      displayName: charger.displayName,
      status: charger.status,
      location: charger.location ? {
        address: charger.location.address,
        lat: charger.location.lat,
        lng: charger.location.lng
      } : null,
      coordinates: {
        lat: charger.lat,
        lng: charger.lng
      },
      vendor: charger.vendor ? {
        id: charger.vendor.id,
        name: charger.vendor.companyName,
        email: charger.vendor.email,
        phoneNumber: charger.vendor.phoneNumber,
        user: {
          name: charger.vendor.user?.name || 'Unknown',
          email: charger.vendor.user?.email || 'Unknown'
        }
      } : null,
      slotNumber: charger.slotNumber,
      lastSeen: charger.lastSeen,
      createdAt: charger.createdAt,
      recentSessions: charger.sessions.length,
      totalSessions: charger.sessions.length // Simplified - using recent sessions count
    }));

    // Calculate statistics
    const totalChargers = transformedChargers.length;
    const onlineChargers = transformedChargers.filter(c => c.status === 'ONLINE').length;
    const offlineChargers = transformedChargers.filter(c => c.status === 'OFFLINE').length;
    const maintenanceChargers = transformedChargers.filter(c => c.status === 'MAINTENANCE').length;
    const totalVendors = [...new Set(transformedChargers.map(c => c.vendor?.id).filter(Boolean))].length;

    const response = {
      success: true,
      chargers: transformedChargers,
      stats: {
        totalChargers,
        onlineChargers,
        offlineChargers,
        maintenanceChargers,
        totalVendors
      }
    };

    console.log('✅ Successfully returning charger data:', {
      chargerCount: response.chargers.length,
      stats: response.stats
    });

    return res.json(response);
  } catch (err) {
    console.error('❌ Error fetching chargers:', err);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      details: err.message 
    });
  }
});

// GET /admin/chargers/:id - Get single charger details
router.get("/chargers/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    const charger = await prisma.charger.findUnique({
      where: { id: parseInt(id) },
      include: {
        vendor: {
          include: {
            user: true
          }
        },
        location: true,
        sessions: {
          take: 10,
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    });

    if (!charger) {
      return res.status(404).json({ 
        success: false, 
        error: 'Charger not found' 
      });
    }

    const transformedCharger = {
      id: charger.id,
      name: charger.name,
      deviceId: charger.deviceId,
      displayName: charger.displayName,
      status: charger.status,
      location: charger.location ? {
        address: charger.location.address,
        lat: charger.location.lat,
        lng: charger.location.lng
      } : null,
      coordinates: {
        lat: charger.lat,
        lng: charger.lng
      },
      vendor: charger.vendor ? {
        id: charger.vendor.id,
        name: charger.vendor.companyName,
        email: charger.vendor.email,
        phoneNumber: charger.vendor.phoneNumber,
        user: {
          name: charger.vendor.user?.name || 'Unknown',
          email: charger.vendor.user?.email || 'Unknown'
        }
      } : null,
      slotNumber: charger.slotNumber,
      lastSeen: charger.lastSeen,
      createdAt: charger.createdAt,
      sessions: charger.sessions
    };

    return res.json({
      success: true,
      charger: transformedCharger
    });
  } catch (err) {
    console.error('❌ Error fetching charger:', err);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      details: err.message 
    });
  }
});

// PATCH /admin/chargers/:id/status - Update charger status
router.patch("/chargers/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['ONLINE', 'OFFLINE', 'MAINTENANCE'].includes(status)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid status. Must be ONLINE, OFFLINE, or MAINTENANCE' 
      });
    }

    const updatedCharger = await prisma.charger.update({
      where: { id: parseInt(id) },
      data: { status }
    });

    return res.json({
      success: true,
      message: 'Charger status updated successfully',
      charger: updatedCharger
    });
  } catch (err) {
    console.error('❌ Error updating charger status:', err);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      details: err.message 
    });
  }
});

// DELETE /admin/chargers/:id - Delete charger
router.delete("/chargers/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Check if charger exists
    const charger = await prisma.charger.findUnique({
      where: { id: parseInt(id) }
    });

    if (!charger) {
      return res.status(404).json({ 
        success: false, 
        error: 'Charger not found' 
      });
    }

    // Delete charger (sessions will be deleted due to cascade)
    await prisma.charger.delete({
      where: { id: parseInt(id) }
    });

    return res.json({
      success: true,
      message: 'Charger deleted successfully'
    });
  } catch (err) {
    console.error('❌ Error deleting charger:', err);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      details: err.message 
    });
  }
});

module.exports = router;
