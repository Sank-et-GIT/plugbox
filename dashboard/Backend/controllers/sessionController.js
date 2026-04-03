const Session = require("../models/Session");


// START SESSION
exports.startSession = async (req, res) => {
  try {

    const session = new Session(req.body);

    await session.save();

    res.status(201).json({
      message: "Charging session started",
      session
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


// UPDATE ENERGY CONSUMPTION
exports.updateConsumption = async (req, res) => {
  try {

    const session = await Session.findById(req.params.id);

    if (!session) {
      return res.status(404).json({
        message: "Session not found"
      });
    }

    session.unitsConsumed = req.body.unitsConsumed;

    session.totalCost =
      session.unitsConsumed * session.pricePerKwh;

    await session.save();

    res.json({
      message: "Consumption updated",
      session
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


// STOP SESSION
exports.stopSession = async (req, res) => {
  try {

    const session = await Session.findById(req.params.id);

    if (!session) {
      return res.status(404).json({
        message: "Session not found"
      });
    }

    session.endTime = new Date();
    session.status = "COMPLETED";

    await session.save();

    res.json({
      message: "Charging session stopped",
      session
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


// GET ALL SESSIONS
exports.getSessions = async (req, res) => {
  try {

    const sessions = await Session.find()
      .populate("userId")
      .populate("vendorId")
      .populate("chargerId");

    res.json(sessions);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


// GET SESSION BY ID
exports.getSessionById = async (req, res) => {
  try {

    const session = await Session.findById(req.params.id)
      .populate("userId")
      .populate("vendorId")
      .populate("chargerId");

    if (!session) {
      return res.status(404).json({
        message: "Session not found"
      });
    }

    res.json(session);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};