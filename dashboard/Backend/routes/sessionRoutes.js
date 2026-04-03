const express = require("express");
const router = express.Router();

const {
  startSession,
  updateConsumption,
  stopSession,
  getSessions,
  getSessionById
} = require("../controllers/sessionController");

const authMiddleware = require("../middleware/authMiddleware");


// START SESSION
router.post("/start", authMiddleware, startSession);

// UPDATE CONSUMPTION
router.put("/update/:id", authMiddleware, updateConsumption);

// STOP SESSION
router.put("/stop/:id", authMiddleware, stopSession);

// GET ALL SESSIONS
router.get("/", authMiddleware, getSessions);

// GET SESSION BY ID
router.get("/:id", authMiddleware, getSessionById);

module.exports = router;