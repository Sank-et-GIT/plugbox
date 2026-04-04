const express = require("express");
const router = express.Router();

const {
  createCharger,
  getChargers,
  getChargerById,
  updateCharger,
  deleteCharger,
  updateChargerStatus,
  getChargerStats
} = require("../controllers/chargerControllerPrisma");

const authMiddleware = require("../middleware/authMiddleware");

// API Routes for Charger Management

// POST /api/chargers - Create charger (Admin only)
// Creates new charger in database
router.post("/", authMiddleware, createCharger);

// GET /api/chargers - Get all chargers (Admin only)
// Returns all chargers from database
router.get("/", authMiddleware, getChargers);

// GET /api/chargers/stats - Get charger statistics (Admin only)
// Returns aggregated data about all chargers
router.get("/stats", authMiddleware, getChargerStats);

// GET /api/chargers/:id - Get single charger by ID (Admin only)
// Returns charger details
router.get("/:id", authMiddleware, getChargerById);

// PUT /api/chargers/:id - Update charger (Admin only)
// Updates charger details
router.put("/:id", authMiddleware, updateCharger);

// PATCH /api/chargers/:id/status - Update charger status (Admin only)
// Updates charger status
router.patch("/:id/status", authMiddleware, updateChargerStatus);

// DELETE /api/chargers/:id - Delete charger (Admin only)
// Deletes charger from database
router.delete("/:id", authMiddleware, deleteCharger);

module.exports = router;