const { PrismaClient } = require('@prisma/client');

class ChargerService {
  constructor() {
    this.prisma = new PrismaClient();
  }

  async getAllChargers(filters = {}) {
    try {
      const { status, page = 1, limit = 10, search, sortBy = 'id', sortOrder = 'asc' } = filters;
      
      // Build where clause
      const where = {};
      if (status && status !== 'all') {
        where.status = status;
      }
      
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { displayName: { contains: search, mode: 'insensitive' } },
          { deviceId: { contains: search, mode: 'insensitive' } }
        ];
      }

      // Get chargers with location data
      const chargers = await this.prisma.charger.findMany({
        where,
        include: {
          location: true,
          _count: {
            select: {
              sessions: true,
              bookings: true
            }
          }
        },
        orderBy: {
          [sortBy]: sortOrder
        },
        skip: (page - 1) * limit,
        take: limit
      });

      // Get total count for pagination
      const totalCount = await this.prisma.charger.count({ where });

      // Transform data to match frontend expectations
      const transformedChargers = chargers.map(charger => ({
        _id: charger.id.toString(),
        chargerId: `CHR${String(charger.id).padStart(6, '0')}`,
        chargerName: charger.name,
        displayName: charger.displayName,
        status: charger.status,
        chargerType: 'AC', // Default value - can be enhanced
        connectorType: 'Type2', // Default value - can be enhanced
        pricePerUnit: 15, // Default value - can be enhanced
        serialNumber: charger.deviceId,
        location: charger.location || {
          address: 'Address not available',
          lat: charger.lat,
          lng: charger.lng
        },
        lat: charger.lat,
        lng: charger.lng,
        totalSessions: charger._count.sessions,
        totalBookings: charger._count.bookings,
        totalRevenue: 0, // Can be calculated from transactions
        lastSeen: charger.lastSeen,
        createdAt: charger.createdAt,
        updatedAt: charger.updatedAt
      }));

      return {
        success: true,
        chargers: transformedChargers,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalCount,
          pages: Math.ceil(totalCount / limit)
        }
      };
    } catch (error) {
      console.error('Error fetching chargers:', error);
      return {
        success: false,
        message: 'Failed to fetch chargers',
        error: error.message
      };
    }
  }

  async getChargerById(chargerId) {
    try {
      const charger = await this.prisma.charger.findUnique({
        where: { id: parseInt(chargerId) },
        include: {
          location: true,
          sessions: {
            take: 10,
            orderBy: { createdAt: 'desc' }
          },
          bookings: {
            take: 10,
            orderBy: { createdAt: 'desc' }
          },
          _count: {
            select: {
              sessions: true,
              bookings: true
            }
          }
        }
      });

      if (!charger) {
        return {
          success: false,
          message: 'Charger not found'
        };
      }

      const transformedCharger = {
        _id: charger.id.toString(),
        chargerId: `CHR${String(charger.id).padStart(6, '0')}`,
        chargerName: charger.name,
        displayName: charger.displayName,
        status: charger.status,
        chargerType: 'AC',
        connectorType: 'Type2',
        pricePerUnit: 15,
        serialNumber: charger.deviceId,
        location: charger.location || {
          address: 'Address not available',
          lat: charger.lat,
          lng: charger.lng
        },
        lat: charger.lat,
        lng: charger.lng,
        totalSessions: charger._count.sessions,
        totalBookings: charger._count.bookings,
        totalRevenue: 0,
        lastSeen: charger.lastSeen,
        createdAt: charger.createdAt,
        updatedAt: charger.updatedAt,
        recentSessions: charger.sessions,
        recentBookings: charger.bookings
      };

      return {
        success: true,
        charger: transformedCharger
      };
    } catch (error) {
      console.error('Error fetching charger:', error);
      return {
        success: false,
        message: 'Failed to fetch charger',
        error: error.message
      };
    }
  }

  async getChargerStats() {
    try {
      const stats = await this.prisma.charger.groupBy({
        by: ['status'],
        _count: {
          id: true
        }
      });

      const totalChargers = await this.prisma.charger.count();

      const statsObj = {
        totalChargers,
        availableChargers: 0,
        inSessionChargers: 0,
        reservedChargers: 0,
        offlineChargers: 0,
        onMaintenanceChargers: 0,
        totalRevenue: 0
      };

      stats.forEach(stat => {
        switch (stat.status) {
          case 'Available':
            statsObj.availableChargers = stat._count.id;
            break;
          case 'In_Session':
            statsObj.inSessionChargers = stat._count.id;
            break;
          case 'Reserved':
            statsObj.reservedChargers = stat._count.id;
            break;
          case 'Offline':
            statsObj.offlineChargers = stat._count.id;
            break;
          case 'On_Maintenance':
            statsObj.onMaintenanceChargers = stat._count.id;
            break;
        }
      });

      return {
        success: true,
        stats: statsObj
      };
    } catch (error) {
      console.error('Error fetching charger stats:', error);
      return {
        success: false,
        message: 'Failed to fetch charger stats',
        error: error.message
      };
    }
  }

  async createCharger(chargerData) {
    try {
      const { chargerName, chargerType, connectorType, location, pricePerUnit, serialNumber } = chargerData;

      // Check if charger with same serial number already exists
      if (serialNumber) {
        const existingCharger = await this.prisma.charger.findFirst({
          where: { deviceId: serialNumber }
        });

        if (existingCharger) {
          return {
            success: false,
            message: 'A charger with this serial number already exists'
          };
        }
      }

      const newCharger = await this.prisma.charger.create({
        data: {
          name: chargerName,
          displayName: chargerName,
          lat: location.lat,
          lng: location.lng,
          status: 'OFFLINE',
          deviceId: serialNumber || null,
          mqttTopic: serialNumber ? `charger/${serialNumber}` : null,
          location: {
            create: {
              name: chargerName,
              address: location.address,
              lat: location.lat,
              lng: location.lng
            }
          }
        },
        include: {
          location: true
        }
      });

      const transformedCharger = {
        _id: newCharger.id.toString(),
        chargerId: `CHR${String(newCharger.id).padStart(6, '0')}`,
        chargerName: newCharger.name,
        displayName: newCharger.displayName,
        status: newCharger.status,
        chargerType,
        connectorType,
        pricePerUnit,
        serialNumber: newCharger.deviceId,
        location: newCharger.location,
        lat: newCharger.lat,
        lng: newCharger.lng,
        totalSessions: 0,
        totalBookings: 0,
        totalRevenue: 0,
        lastSeen: newCharger.lastSeen,
        createdAt: newCharger.createdAt,
        updatedAt: newCharger.updatedAt
      };

      return {
        success: true,
        message: 'Charger created successfully',
        charger: transformedCharger
      };
    } catch (error) {
      console.error('Error creating charger:', error);
      return {
        success: false,
        message: 'Failed to create charger',
        error: error.message
      };
    }
  }

  async updateCharger(chargerId, chargerData) {
    try {
      const charger = await this.prisma.charger.findUnique({
        where: { id: parseInt(chargerId) },
        include: { location: true }
      });

      if (!charger) {
        return {
          success: false,
          message: 'Charger not found'
        };
      }

      const { chargerName, chargerType, connectorType, location, pricePerUnit, serialNumber } = chargerData;

      // Check serial number uniqueness if being updated
      if (serialNumber && serialNumber !== charger.deviceId) {
        const duplicateCharger = await this.prisma.charger.findFirst({
          where: { deviceId: serialNumber }
        });

        if (duplicateCharger) {
          return {
            success: false,
            message: 'A charger with this serial number already exists'
          };
        }
      }

      const updateData = {};
      if (chargerName) {
        updateData.name = chargerName;
        updateData.displayName = chargerName;
      }
      if (serialNumber !== undefined) {
        updateData.deviceId = serialNumber;
        updateData.mqttTopic = serialNumber ? `charger/${serialNumber}` : null;
      }
      if (location.lat !== undefined) updateData.lat = location.lat;
      if (location.lng !== undefined) updateData.lng = location.lng;

      const updatedCharger = await this.prisma.charger.update({
        where: { id: parseInt(chargerId) },
        data: updateData,
        include: { location: true }
      });

      // Update location if provided
      if (location.address || location.lat !== undefined || location.lng !== undefined) {
        await this.prisma.location.update({
          where: { id: updatedCharger.location?.id },
          data: {
            ...(location.address && { address: location.address }),
            ...(location.lat !== undefined && { lat: location.lat }),
            ...(location.lng !== undefined && { lng: location.lng })
          }
        });
      }

      const transformedCharger = {
        _id: updatedCharger.id.toString(),
        chargerId: `CHR${String(updatedCharger.id).padStart(6, '0')}`,
        chargerName: updatedCharger.name,
        displayName: updatedCharger.displayName,
        status: updatedCharger.status,
        chargerType,
        connectorType,
        pricePerUnit,
        serialNumber: updatedCharger.deviceId,
        location: updatedCharger.location,
        lat: updatedCharger.lat,
        lng: updatedCharger.lng,
        totalSessions: 0,
        totalBookings: 0,
        totalRevenue: 0,
        lastSeen: updatedCharger.lastSeen,
        createdAt: updatedCharger.createdAt,
        updatedAt: updatedCharger.updatedAt
      };

      return {
        success: true,
        message: 'Charger updated successfully',
        charger: transformedCharger
      };
    } catch (error) {
      console.error('Error updating charger:', error);
      return {
        success: false,
        message: 'Failed to update charger',
        error: error.message
      };
    }
  }

  async deleteCharger(chargerId) {
    try {
      const charger = await this.prisma.charger.findUnique({
        where: { id: parseInt(chargerId) },
        include: {
          bookings: { where: { status: { in: ['HOLD', 'STARTED'] } } },
          sessions: { where: { status: { in: ['CREATED', 'UNLOCK_SENT', 'UNLOCKED', 'PLUG_WAIT', 'ACTIVE'] } } }
        }
      });

      if (!charger) {
        return {
          success: false,
          message: 'Charger not found'
        };
      }

      if (charger.bookings.length > 0 || charger.sessions.length > 0) {
        return {
          success: false,
          message: 'Cannot delete charger with active bookings or sessions'
        };
      }

      await this.prisma.charger.delete({
        where: { id: parseInt(chargerId) }
      });

      return {
        success: true,
        message: 'Charger deleted successfully'
      };
    } catch (error) {
      console.error('Error deleting charger:', error);
      return {
        success: false,
        message: 'Failed to delete charger',
        error: error.message
      };
    }
  }

  async updateChargerStatus(chargerId, status) {
    try {
      const charger = await this.prisma.charger.findUnique({
        where: { id: parseInt(chargerId) }
      });

      if (!charger) {
        return {
          success: false,
          message: 'Charger not found'
        };
      }

      // Validate status transitions
      const validTransitions = {
        'OFFLINE': ['Available', 'On_Maintenance'],
        'Available': ['Offline', 'In_Session', 'Reserved', 'On_Maintenance'],
        'In_Session': ['Available', 'Offline', 'On_Maintenance'],
        'Reserved': ['Available', 'Offline', 'In_Session', 'On_Maintenance'],
        'On_Maintenance': ['Available', 'Offline']
      };

      if (!validTransitions[charger.status]?.includes(status)) {
        return {
          success: false,
          message: `Cannot change status from ${charger.status} to ${status}`
        };
      }

      const updatedCharger = await this.prisma.charger.update({
        where: { id: parseInt(chargerId) },
        data: { status }
      });

      return {
        success: true,
        message: 'Charger status updated successfully',
        charger: {
          _id: updatedCharger.id.toString(),
          chargerId: `CHR${String(updatedCharger.id).padStart(6, '0')}`,
          status: updatedCharger.status,
          updatedAt: updatedCharger.updatedAt
        }
      };
    } catch (error) {
      console.error('Error updating charger status:', error);
      return {
        success: false,
        message: 'Failed to update charger status',
        error: error.message
      };
    }
  }
}

module.exports = new ChargerService();
