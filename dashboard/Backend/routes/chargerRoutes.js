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
} = require("../controllers/chargerController");

const authMiddleware = require("../middleware/authMiddleware");

// API Routes for Charger Management

// POST /api/chargers - Create charger
// Creates new charger in database
router.post("/", createCharger);

// GET /api/chargers - Get all chargers
// Returns all chargers from database
router.get("/", getChargers);

// GET /api/chargers/stats - Get charger statistics
// Returns aggregated data about all chargers
router.get("/stats", getChargerStats);

// GET /api/chargers/:id - Get single charger by ID
// Returns charger details
router.get("/:id", getChargerById);

// PUT /api/chargers/:id - Update charger
// Updates charger details
router.put("/:id", updateCharger);

// PATCH /api/chargers/:id/status - Update charger status
// Updates charger status
router.patch("/:id/status", updateChargerStatus);

// DELETE /api/chargers/:id - Delete charger
// Deletes charger from database
router.delete("/:id", deleteCharger);

module.exports = router;