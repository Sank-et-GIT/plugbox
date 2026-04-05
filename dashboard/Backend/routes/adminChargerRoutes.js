const express = require("express");
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const adminChargerController = require('../controllers/adminChargerController');

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

// POST /admin/chargers-mongo - Create new charger (MongoDB version for admin)
router.post("/chargers-mongo", async (req, res) => {
  try {
    console.log('🔧 Admin creating new charger:', req.body);
    
    const {
      chargerName,
      chargerType,
      connectorType,
      vendorId,
      pricePerUnit,
      location,
      status,
      serialNumber
    } = req.body;

    console.log('🔍 Debug - Vendor ID received:', vendorId, 'Type:', typeof vendorId);

    // Validate required fields
    if (!chargerName || !vendorId || !pricePerUnit || !location || !location.address || !location.lat || !location.lng) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields: chargerName, vendorId, pricePerUnit, location.address, location.lat, location.lng' 
      });
    }

    // Validate coordinates
    if (location.lat < -90 || location.lat > 90 || location.lng < -180 || location.lng > 180) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid coordinates. Latitude must be between -90 and 90, longitude between -180 and 180' 
      });
    }

    // Validate price
    if (pricePerUnit <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Price per unit must be greater than 0' 
      });
    }

    // Check if vendor exists
    console.log('🔍 Looking for vendor with ID:', vendorId);
    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId }
    });

    console.log('🔍 Vendor found:', vendor ? 'YES' : 'NO');
    if (!vendor) {
      // List all vendors to help debug
      const allVendors = await prisma.vendor.findMany({
        select: {
          id: true,
          companyName: true,
          email: true
        }
      });
      console.log('📋 All available vendors:', allVendors);
      
      return res.status(404).json({ 
        success: false, 
        message: 'Vendor not found',
        debug: {
          receivedId: vendorId,
          availableVendors: allVendors
        }
      });
    }

    // Generate auto charger ID
    const lastCharger = await prisma.charger.findFirst({
      orderBy: { id: 'desc' }
    });
    
    const nextId = lastCharger ? lastCharger.id + 1 : 1;
    const chargerId = `CHR${String(nextId).padStart(6, '0')}`;

    // Create location record first
    const chargerLocation = await prisma.location.create({
      data: {
        name: chargerName,
        address: location.address,
        lat: parseFloat(location.lat),
        lng: parseFloat(location.lng)
      }
    });

    // Create charger with location reference
    const newCharger = await prisma.charger.create({
      data: {
        deviceId: chargerId,
        name: chargerName,
        displayName: chargerName,
        vendorId: vendorId,
        status: status || 'OFFLINE',
        lat: parseFloat(location.lat),
        lng: parseFloat(location.lng),
        locationId: chargerLocation.id,
        slotNumber: 1,
        serialNumber: serialNumber || null
      }
    });

    console.log('✅ Charger created successfully:', {
      id: newCharger.id,
      deviceId: newCharger.deviceId,
      name: newCharger.name
    });

    return res.status(201).json({
      success: true,
      message: 'Charger created successfully',
      charger: {
        id: newCharger.id,
        chargerId: newCharger.deviceId,
        chargerName: newCharger.name,
        vendorId: newCharger.vendorId,
        status: newCharger.status,
        location: {
          address: chargerLocation.address,
          lat: chargerLocation.lat,
          lng: chargerLocation.lng
        },
        pricePerUnit: parseFloat(pricePerUnit),
        chargerType,
        connectorType,
        serialNumber: newCharger.serialNumber
      }
    });

  } catch (err) {
    console.error('❌ Error creating charger:', err);
    return res.status(500).json({ 
      success: false, 
      message: 'Internal server error',
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
