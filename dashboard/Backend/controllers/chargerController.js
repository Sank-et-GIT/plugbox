const Charger = require("../models/Charger");

// CREATE CHARGER
exports.createCharger = async (req, res) => {
  try {

    const charger = new Charger(req.body);

    await charger.save();

    res.status(201).json({
      message: "Charger created successfully",
      charger
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


// GET ALL CHARGERS
exports.getChargers = async (req, res) => {
  try {

    const chargers = await Charger.find().populate("vendorId");

    res.json(chargers);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


// GET CHARGER BY ID
exports.getChargerById = async (req, res) => {
  try {

    const charger = await Charger.findById(req.params.id).populate("vendorId");

    if (!charger) {
      return res.status(404).json({
        message: "Charger not found"
      });
    }

    res.json(charger);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


// UPDATE CHARGER
exports.updateCharger = async (req, res) => {
  try {

    const charger = await Charger.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    res.json(charger);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


// DELETE CHARGER
exports.deleteCharger = async (req, res) => {
  try {

    await Charger.findByIdAndDelete(req.params.id);

    res.json({
      message: "Charger deleted successfully"
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};