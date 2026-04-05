// Add public test endpoint to adminChargerRoutes.js
const express = require("express");
const router = express.Router();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Public endpoint for testing - no auth required
router.get("/test-chargers", async (req, res) => {
  try {
    console.log('🔍 Public test endpoint - fetching all chargers...');
    
    // Get all chargers with vendor information
    const chargers = await prisma.charger.findMany({
      include: {
        vendor: {
          include: {
            user: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 10 // Limit for testing
    });

    console.log(`Found ${chargers.length} chargers`);

    // Transform data for frontend
    const transformedChargers = chargers.map(charger => ({
      id: charger.id,
      name: charger.name,
      deviceId: charger.deviceId,
      displayName: charger.displayName,
      status: charger.status,
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
      createdAt: charger.createdAt
    }));

    // Calculate statistics
    const totalChargers = transformedChargers.length;
    const onlineChargers = transformedChargers.filter(c => c.status === 'ONLINE').length;
    const offlineChargers = transformedChargers.filter(c => c.status === 'OFFLINE').length;
    const maintenanceChargers = transformedChargers.filter(c => c.status === 'MAINTENANCE').length;

    const response = {
      success: true,
      chargers: transformedChargers,
      stats: {
        totalChargers,
        onlineChargers,
        offlineChargers,
        maintenanceChargers
      }
    };

    console.log('✅ Public test endpoint returning data:', {
      chargerCount: response.chargers.length,
      stats: response.stats
    });

    return res.json(response);
  } catch (err) {
    console.error('❌ Error:', err);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      details: err.message 
    });
  } finally {
    await prisma.$disconnect();
  }
});

module.exports = router;
