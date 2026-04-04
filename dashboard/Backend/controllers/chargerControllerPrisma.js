const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Get all chargers (Admin)
const getChargers = async (req, res) => {
  try {
    const { status, page = 1, limit = 10, search, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    
    const where = {};
    
    if (status) {
      where.status = status.toUpperCase();
    }
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { displayName: { contains: search, mode: 'insensitive' } },
        { deviceId: { contains: search, mode: 'insensitive' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [chargers, totalCount] = await Promise.all([
      prisma.charger.findMany({
        where,
        include: {
          location: true,
          vendor: {
            select: {
              id: true,
              companyName: true,
              email: true
            }
          },
          _count: {
            select: {
              sessions: true,
              bookings: {
                where: { status: 'HOLD' }
              }
            }
          }
        },
        orderBy: {
          [sortBy]: sortOrder
        },
        skip,
        take: parseInt(limit)
      }),
      prisma.charger.count({ where })
    ]);

    const totalPages = Math.ceil(totalCount / parseInt(limit));

    // Transform data to match expected format
    const transformedChargers = chargers.map(charger => ({
      _id: charger.id.toString(),
      chargerId: charger.deviceId || `CHR${charger.id}`,
      chargerName: charger.name,
      displayName: charger.displayName,
      status: charger.status.toLowerCase().replace('_', ' '),
      chargerType: 'AC', // Default value since not in schema
      connectorType: 'Type2', // Default value since not in schema
      location: charger.location ? {
        address: charger.location.address,
        lat: charger.lat,
        lng: charger.lng
      } : {
        address: 'No location set',
        lat: charger.lat,
        lng: charger.lng
      },
      pricePerUnit: 10, // Default value since not in schema
      vendorId: charger.vendorId,
      vendor: charger.vendor,
      totalSessions: charger._count.sessions,
      activeBookings: charger._count.bookings,
      serialNumber: charger.deviceId,
      installationDate: charger.createdAt,
      lastSeen: charger.lastSeen,
      createdAt: charger.createdAt
    }));

    res.status(200).json({
      success: true,
      chargers: transformedChargers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: totalPages
      }
    });
  } catch (error) {
    console.error('Controller error - getChargers:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get charger by ID (Admin)
const getChargerById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const charger = await prisma.charger.findUnique({
      where: { id: parseInt(id) },
      include: {
        location: true,
        vendor: {
          select: {
            id: true,
            companyName: true,
            email: true,
            phoneNumber: true
          }
        },
        sessions: {
          orderBy: { createdAt: 'desc' },
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
          where: { status: 'HOLD' },
          include: {
            user: {
              select: {
                name: true,
                email: true
              }
            }
          }
        }
      }
    });
    
    if (!charger) {
      return res.status(404).json({
        success: false,
        message: 'Charger not found'
      });
    }

    const transformedCharger = {
      _id: charger.id.toString(),
      chargerId: charger.deviceId || `CHR${charger.id}`,
      chargerName: charger.name,
      displayName: charger.displayName,
      status: charger.status.toLowerCase().replace('_', ' '),
      chargerType: 'AC',
      connectorType: 'Type2',
      location: charger.location ? {
        address: charger.location.address,
        lat: charger.lat,
        lng: charger.lng
      } : {
        address: 'No location set',
        lat: charger.lat,
        lng: charger.lng
      },
      pricePerUnit: 10,
      vendorId: charger.vendorId,
      vendor: charger.vendor,
      serialNumber: charger.deviceId,
      installationDate: charger.createdAt,
      lastSeen: charger.lastSeen,
      createdAt: charger.createdAt,
      sessions: charger.sessions,
      bookings: charger.bookings
    };

    res.status(200).json({
      success: true,
      charger: transformedCharger
    });
  } catch (error) {
    console.error('Controller error - getChargerById:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Create new charger (Admin)
const createCharger = async (req, res) => {
  try {
    const chargerData = req.body;
    
    const newCharger = await prisma.charger.create({
      data: {
        name: chargerData.chargerName,
        displayName: chargerData.displayName || chargerData.chargerName,
        status: 'OFFLINE',
        lat: chargerData.location?.lat || 0,
        lng: chargerData.location?.lng || 0,
        deviceId: chargerData.serialNumber || `CHR-${Date.now()}`,
        mqttTopic: `charger/${chargerData.serialNumber || Date.now()}`,
        vendorId: chargerData.vendorId || null,
        locationId: chargerData.locationId || null
      },
      include: {
        location: true,
        vendor: {
          select: {
            id: true,
            companyName: true,
            email: true
          }
        }
      }
    });

    const transformedCharger = {
      _id: newCharger.id.toString(),
      chargerId: newCharger.deviceId || `CHR${newCharger.id}`,
      chargerName: newCharger.name,
      displayName: newCharger.displayName,
      status: newCharger.status.toLowerCase().replace('_', ' '),
      location: newCharger.location ? {
        address: newCharger.location.address,
        lat: newCharger.lat,
        lng: newCharger.lng
      } : {
        address: 'No location set',
        lat: newCharger.lat,
        lng: newCharger.lng
      },
      vendorId: newCharger.vendorId,
      vendor: newCharger.vendor,
      createdAt: newCharger.createdAt
    };

    res.status(201).json({
      success: true,
      message: 'Charger created successfully',
      charger: transformedCharger
    });
  } catch (error) {
    console.error('Controller error - createCharger:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Update charger (Admin)
const updateCharger = async (req, res) => {
  try {
    const { id } = req.params;
    const chargerData = req.body;
    
    const updatedCharger = await prisma.charger.update({
      where: { id: parseInt(id) },
      data: {
        name: chargerData.chargerName,
        displayName: chargerData.displayName,
        lat: chargerData.location?.lat,
        lng: chargerData.location?.lng,
        deviceId: chargerData.serialNumber,
        vendorId: chargerData.vendorId,
        locationId: chargerData.locationId
      },
      include: {
        location: true,
        vendor: {
          select: {
            id: true,
            companyName: true,
            email: true
          }
        }
      }
    });

    const transformedCharger = {
      _id: updatedCharger.id.toString(),
      chargerId: updatedCharger.deviceId || `CHR${updatedCharger.id}`,
      chargerName: updatedCharger.name,
      displayName: updatedCharger.displayName,
      status: updatedCharger.status.toLowerCase().replace('_', ' '),
      location: updatedCharger.location ? {
        address: updatedCharger.location.address,
        lat: updatedCharger.lat,
        lng: updatedCharger.lng
      } : {
        address: 'No location set',
        lat: updatedCharger.lat,
        lng: updatedCharger.lng
      },
      vendorId: updatedCharger.vendorId,
      vendor: updatedCharger.vendor,
      createdAt: updatedCharger.createdAt
    };

    res.status(200).json({
      success: true,
      message: 'Charger updated successfully',
      charger: transformedCharger
    });
  } catch (error) {
    console.error('Controller error - updateCharger:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Delete charger (Admin)
const deleteCharger = async (req, res) => {
  try {
    const { id } = req.params;
    
    await prisma.charger.delete({
      where: { id: parseInt(id) }
    });

    res.status(200).json({
      success: true,
      message: 'Charger deleted successfully'
    });
  } catch (error) {
    console.error('Controller error - deleteCharger:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Update charger status (Admin)
const updateChargerStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!['AVAILABLE', 'OFFLINE', 'MAINTENANCE', 'IN_SESSION', 'RESERVED'].includes(status?.toUpperCase())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    const updatedCharger = await prisma.charger.update({
      where: { id: parseInt(id) },
      data: {
        status: status.toUpperCase()
      }
    });

    res.status(200).json({
      success: true,
      message: 'Charger status updated successfully',
      charger: {
        _id: updatedCharger.id.toString(),
        status: updatedCharger.status.toLowerCase().replace('_', ' ')
      }
    });
  } catch (error) {
    console.error('Controller error - updateChargerStatus:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get charger statistics (Admin)
const getChargerStats = async (req, res) => {
  try {
    const [
      totalChargers,
      availableChargers,
      inSessionChargers,
      offlineChargers,
      reservedChargers,
      maintenanceChargers
    ] = await Promise.all([
      prisma.charger.count(),
      prisma.charger.count({ where: { status: 'AVAILABLE' } }),
      prisma.charger.count({ where: { status: 'IN_SESSION' } }),
      prisma.charger.count({ where: { status: 'OFFLINE' } }),
      prisma.charger.count({ where: { status: 'RESERVED' } }),
      prisma.charger.count({ where: { status: 'MAINTENANCE' } })
    ]);

    // Get total revenue from completed sessions
    const revenueData = await prisma.session.aggregate({
      where: { status: 'ENDED' },
      _sum: { finalKwh: true },
      _count: true
    });

    const totalRevenue = (revenueData._sum.finalKwh || 0) * 10; // Assuming ₹10 per kWh
    const totalSessions = revenueData._count;

    res.status(200).json({
      success: true,
      stats: {
        totalChargers,
        availableChargers,
        inSessionChargers,
        offlineChargers,
        reservedChargers,
        maintenanceChargers,
        totalSessions,
        totalRevenue
      }
    });
  } catch (error) {
    console.error('Controller error - getChargerStats:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

module.exports = {
  getChargers,
  getChargerById,
  createCharger,
  updateCharger,
  deleteCharger,
  updateChargerStatus,
  getChargerStats
};
