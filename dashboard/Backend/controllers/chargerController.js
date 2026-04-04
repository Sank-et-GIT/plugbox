const chargerService = require('../services/chargerService');

// Get all chargers
const getChargers = async (req, res) => {
  try {
    const { status, page, limit, search, sortBy, sortOrder } = req.query;
    
    const result = await chargerService.getAllChargers({
      status,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 10,
      search,
      sortBy,
      sortOrder
    });

    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    console.error('Controller error - getChargers:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get charger by ID
const getChargerById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await chargerService.getChargerById(id);
    
    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (error) {
    console.error('Controller error - getChargerById:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Create new charger
const createCharger = async (req, res) => {
  try {
    const chargerData = req.body;
    
    const result = await chargerService.createCharger(chargerData);
    
    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Controller error - createCharger:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Update charger
const updateCharger = async (req, res) => {
  try {
    const { id } = req.params;
    const chargerData = req.body;
    
    const result = await chargerService.updateCharger(id, chargerData);
    
    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Controller error - updateCharger:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Delete charger
const deleteCharger = async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await chargerService.deleteCharger(id);
    
    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Controller error - deleteCharger:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Update charger status
const updateChargerStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const result = await chargerService.updateChargerStatus(id, status);
    
    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Controller error - updateChargerStatus:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get charger statistics
const getChargerStats = async (req, res) => {
  try {
    const result = await chargerService.getChargerStats();
    
    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(500).json(result);
    }
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