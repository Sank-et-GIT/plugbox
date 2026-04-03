const Admin = require("../models/Admin");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// REGISTER ADMIN
exports.registerAdmin = async (req, res) => {
try {
const { name, email, password } = req.body;

const existingAdmin = await Admin.findOne({ email });

if (existingAdmin) {
  return res.status(400).json({ message: "Admin already exists" });
}

const hashedPassword = await bcrypt.hash(password, 10);

const admin = new Admin({
  name,
  email,
  password: hashedPassword
});

await admin.save();

res.status(201).json({
  message: "Admin registered successfully"
});
} catch (error) {
res.status(500).json({ error: error.message });
}
};

// LOGIN ADMIN
exports.loginAdmin = async (req, res) => {
try {
const { email, password } = req.body;

const admin = await Admin.findOne({ email });

if (!admin) {
  return res.status(404).json({ message: "Admin not found" });
}

const isMatch = await bcrypt.compare(password, admin.password);

if (!isMatch) {
  return res.status(401).json({ message: "Invalid password" });
}

const token = jwt.sign(
  { adminId: admin._id },
  process.env.JWT_SECRET,
  { expiresIn: "1d" }
);

res.json({
  message: "Login successful",
  token
});
} catch (error) {
res.status(500).json({ error: error.message });
}
};

// GET ADMIN PROFILE
exports.getAdminProfile = async (req, res) => {
try {
const admin = await Admin.findById(req.adminId).select("-password");

res.json(admin);

} catch (error) {
res.status(500).json({ error: error.message });
}
};
