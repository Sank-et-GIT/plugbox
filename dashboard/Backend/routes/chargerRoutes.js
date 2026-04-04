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
// Auto assigns vendorId from JWT token
// Auto generates chargerId
router.post("/", authMiddleware, createCharger);

// GET /api/chargers - Get all chargers for logged-in vendor
// Returns only chargers belonging to the authenticated vendor
// Supports query parameters: status, page, limit, sortBy, sortOrder
router.get("/", authMiddleware, getChargers);

// GET /api/chargers/stats - Get charger statistics for logged-in vendor
// Returns aggregated data about vendor's chargers
router.get("/stats", authMiddleware, getChargerStats);

// GET /api/chargers/:id - Get single charger by ID
// Only returns charger if it belongs to the authenticated vendor
router.get("/:id", authMiddleware, getChargerById);

// PUT /api/chargers/:id - Update charger
// Only updates charger if it belongs to the authenticated vendor
// Validates ownership and prevents vendorId modification
router.put("/:id", authMiddleware, updateCharger);

// PATCH /api/chargers/:id/status - Update charger status
// Only updates status if charger belongs to the authenticated vendor
// Validates status transitions
router.patch("/:id/status", authMiddleware, updateChargerStatus);

// DELETE /api/chargers/:id - Delete charger (soft delete)
// Only deletes charger if it belongs to the authenticated vendor
// Sets isActive to false instead of hard delete
router.delete("/:id", authMiddleware, deleteCharger);

module.exports = router;