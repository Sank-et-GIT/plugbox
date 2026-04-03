const express = require("express");
const router = express.Router();

const {
  createCharger,
  getChargers,
  getChargerById,
  updateCharger,
  deleteCharger
} = require("../controllers/chargerController");

const authMiddleware = require("../middleware/authMiddleware");

// CREATE CHARGER
router.post("/", authMiddleware, createCharger);

// GET ALL CHARGERS
router.get("/", authMiddleware, getChargers);

// GET CHARGER BY ID
router.get("/:id", authMiddleware, getChargerById);

// UPDATE CHARGER
router.put("/:id", authMiddleware, updateCharger);

// DELETE CHARGER
router.delete("/:id", authMiddleware, deleteCharger);

module.exports = router;