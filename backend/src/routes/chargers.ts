import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { validateChargerCreation, validateChargerUpdate, validateStatusUpdate } from "../middleware/validation";

const router = Router();
const prisma = new PrismaClient();

// GET /chargers
router.get("/", async (_req, res) => {
  try {
    const chargers = await prisma.charger.findMany({
      orderBy: { id: "asc" },
      select: {
        id: true,
        name: true,
        lat: true,
        lng: true,
        status: true,
        lastSeen: true,
      },
    });

    const now = Date.now();

    const enriched = chargers.map((c) => {
      const lastSeenSecondsAgo =
        c.lastSeen ? Math.floor((now - new Date(c.lastSeen).getTime()) / 1000) : null;

      return {
        ...c,
        lastSeenSecondsAgo,
      };
    });

    return res.json({ chargers: enriched });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /chargers - Create new charger with validation
router.post("/", validateChargerCreation, async (req, res) => {
  try {
    const {
      chargerName,
      chargerType,
      connectorType,
      location,
      pricePerUnit,
      serialNumber
    } = req.body;

    // Check if charger with same serial number already exists (if provided)
    if (serialNumber) {
      const existingCharger = await prisma.charger.findFirst({
        where: { deviceId: serialNumber }
      });

      if (existingCharger) {
        return res.status(409).json({
          success: false,
          message: "A charger with this serial number already exists",
          errors: ["Serial number must be unique"]
        });
      }
    }

    // Create the charger
    const newCharger = await prisma.charger.create({
      data: {
        name: chargerName,
        displayName: chargerName,
        lat: location.lat,
        lng: location.lng,
        status: "OFFLINE", // Default status for new chargers
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

    // Return success response
    return res.status(201).json({
      success: true,
      message: "Charger created successfully",
      charger: {
        id: newCharger.id,
        chargerId: `CHR${String(newCharger.id).padStart(6, '0')}`,
        chargerName: newCharger.name,
        chargerType,
        connectorType,
        location: newCharger.location,
        pricePerUnit,
        serialNumber: newCharger.deviceId,
        status: newCharger.status,
        createdAt: newCharger.createdAt
      }
    });

  } catch (error) {
    console.error("Error creating charger:", error);
    
    // Handle Prisma specific errors
    if (error.code === 'P2002') {
      return res.status(409).json({
        success: false,
        message: "A charger with this identifier already exists",
        errors: ["Duplicate entry detected"]
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create charger",
      error: error.message
    });
  }
});

// PUT /chargers/:id - Update charger with validation
router.put("/:id", validateChargerUpdate, async (req, res) => {
  try {
    const chargerId = parseInt(req.params.id);
    const updateData = req.body;

    // Check if charger exists
    const existingCharger = await prisma.charger.findUnique({
      where: { id: chargerId },
      include: { location: true }
    });

    if (!existingCharger) {
      return res.status(404).json({
        success: false,
        message: "Charger not found",
        errors: [`No charger found with ID: ${chargerId}`]
      });
    }

    // Check serial number uniqueness if being updated
    if (updateData.serialNumber && updateData.serialNumber !== existingCharger.deviceId) {
      const duplicateCharger = await prisma.charger.findFirst({
        where: { deviceId: updateData.serialNumber }
      });

      if (duplicateCharger) {
        return res.status(409).json({
          success: false,
          message: "A charger with this serial number already exists",
          errors: ["Serial number must be unique"]
        });
      }
    }

    // Prepare update data
    const chargerUpdateData: any = {};
    
    if (updateData.chargerName) {
      chargerUpdateData.name = updateData.chargerName;
      chargerUpdateData.displayName = updateData.chargerName;
    }
    
    if (updateData.serialNumber !== undefined) {
      chargerUpdateData.deviceId = updateData.serialNumber;
      chargerUpdateData.mqttTopic = updateData.serialNumber ? `charger/${updateData.serialNumber}` : null;
    }

    // Update location if provided
    let locationUpdate = null;
    if (updateData.location) {
      locationUpdate = {
        where: { id: existingCharger.location?.id },
        data: {
          ...(updateData.location.address && { address: updateData.location.address }),
          ...(updateData.location.lat !== undefined && { lat: updateData.location.lat }),
          ...(updateData.location.lng !== undefined && { lng: updateData.location.lng })
        }
      };

      // Update charger coordinates if location coordinates are provided
      if (updateData.location.lat !== undefined) chargerUpdateData.lat = updateData.location.lat;
      if (updateData.location.lng !== undefined) chargerUpdateData.lng = updateData.location.lng;
    }

    // Update charger
    const updatedCharger = await prisma.charger.update({
      where: { id: chargerId },
      data: chargerUpdateData,
      include: { location: true }
    });

    // Update location separately if needed
    if (locationUpdate && existingCharger.location) {
      await prisma.location.update(locationUpdate);
    }

    return res.json({
      success: true,
      message: "Charger updated successfully",
      charger: {
        id: updatedCharger.id,
        chargerId: `CHR${String(updatedCharger.id).padStart(6, '0')}`,
        chargerName: updatedCharger.name,
        location: updatedCharger.location,
        serialNumber: updatedCharger.deviceId,
        status: updatedCharger.status,
        updatedAt: updatedCharger.updatedAt
      }
    });

  } catch (error) {
    console.error("Error updating charger:", error);
    
    if (error.code === 'P2002') {
      return res.status(409).json({
        success: false,
        message: "A charger with this identifier already exists",
        errors: ["Duplicate entry detected"]
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to update charger",
      error: error.message
    });
  }
});

// DELETE /chargers/:id - Delete charger
router.delete("/:id", async (req, res) => {
  try {
    const chargerId = parseInt(req.params.id);

    // Check if charger exists
    const existingCharger = await prisma.charger.findUnique({
      where: { id: chargerId },
      include: {
        bookings: { where: { status: { in: ['HOLD', 'STARTED'] } } },
        sessions: { where: { status: { in: ['CREATED', 'UNLOCK_SENT', 'UNLOCKED', 'PLUG_WAIT', 'ACTIVE'] } } }
      }
    });

    if (!existingCharger) {
      return res.status(404).json({
        success: false,
        message: "Charger not found",
        errors: [`No charger found with ID: ${chargerId}`]
      });
    }

    // Check if charger has active bookings or sessions
    if (existingCharger.bookings.length > 0 || existingCharger.sessions.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete charger with active bookings or sessions",
        errors: ["Please complete or cancel all active bookings and sessions before deleting this charger"]
      });
    }

    // Delete the charger (cascade will handle related records)
    await prisma.charger.delete({
      where: { id: chargerId }
    });

    return res.json({
      success: true,
      message: "Charger deleted successfully"
    });

  } catch (error) {
    console.error("Error deleting charger:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete charger",
      error: error.message
    });
  }
});

// PATCH /chargers/:id/status - Update charger status
router.patch("/:id/status", validateStatusUpdate, async (req, res) => {
  try {
    const chargerId = parseInt(req.params.id);
    const { status } = req.body;

    // Check if charger exists
    const existingCharger = await prisma.charger.findUnique({
      where: { id: chargerId }
    });

    if (!existingCharger) {
      return res.status(404).json({
        success: false,
        message: "Charger not found",
        errors: [`No charger found with ID: ${chargerId}`]
      });
    }

    // Validate status transitions
    const validTransitions: { [key: string]: string[] } = {
      'OFFLINE': ['Available', 'On_Maintenance'],
      'Available': ['Offline', 'In_Session', 'Reserved', 'On_Maintenance'],
      'In_Session': ['Available', 'Offline', 'On_Maintenance'],
      'Reserved': ['Available', 'Offline', 'In_Session', 'On_Maintenance'],
      'On_Maintenance': ['Available', 'Offline']
    };

    if (!validTransitions[existingCharger.status]?.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status transition",
        errors: [`Cannot change status from ${existingCharger.status} to ${status}`]
      });
    }

    // Update status
    const updatedCharger = await prisma.charger.update({
      where: { id: chargerId },
      data: { status }
    });

    return res.json({
      success: true,
      message: "Charger status updated successfully",
      charger: {
        id: updatedCharger.id,
        chargerId: `CHR${String(updatedCharger.id).padStart(6, '0')}`,
        status: updatedCharger.status,
        updatedAt: updatedCharger.updatedAt
      }
    });

  } catch (error) {
    console.error("Error updating charger status:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update charger status",
      error: error.message
    });
  }
});

// GET /chargers/:id - Get single charger details
router.get("/:id", async (req, res) => {
  try {
    const chargerId = parseInt(req.params.id);

    const charger = await prisma.charger.findUnique({
      where: { id: chargerId },
      include: {
        location: true,
        bookings: {
          take: 5,
          orderBy: { createdAt: 'desc' }
        },
        sessions: {
          take: 5,
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!charger) {
      return res.status(404).json({
        success: false,
        message: "Charger not found",
        errors: [`No charger found with ID: ${chargerId}`]
      });
    }

    return res.json({
      success: true,
      charger: {
        id: charger.id,
        chargerId: `CHR${String(charger.id).padStart(6, '0')}`,
        chargerName: charger.name,
        displayName: charger.displayName,
        location: charger.location,
        status: charger.status,
        serialNumber: charger.deviceId,
        mqttTopic: charger.mqttTopic,
        lastSeen: charger.lastSeen,
        createdAt: charger.createdAt,
        updatedAt: charger.updatedAt,
        recentBookings: charger.bookings,
        recentSessions: charger.sessions
      }
    });

  } catch (error) {
    console.error("Error fetching charger:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch charger",
      error: error.message
    });
  }
});

export default router;
