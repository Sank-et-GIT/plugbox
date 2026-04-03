const Vendor = require("../models/Vendor");

// Add Vendor
exports.createVendor = async (req, res) => {
  try {

    const vendor = new Vendor(req.body);

    await vendor.save();

    res.status(201).json({
      message: "Vendor created successfully",
      vendor
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


// Get All Vendors
exports.getVendors = async (req, res) => {
  try {

    const vendors = await Vendor.find();

    res.json(vendors);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


// Get Vendor By ID
exports.getVendorById = async (req, res) => {
  try {

    const vendor = await Vendor.findById(req.params.id);

    if (!vendor) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    res.json(vendor);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


// Update Vendor
exports.updateVendor = async (req, res) => {
  try {

    const vendor = await Vendor.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    res.json(vendor);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
// Delete Vendor
exports.deleteVendor = async (req, res) => {
  try {

    await Vendor.findByIdAndDelete(req.params.id);

    res.json({
      message: "Vendor deleted successfully"
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

