const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
};

// Register Vendor
const registerVendor = async (req, res) => {
  try {
    const { name, email, password, phoneNumber, companyName } = req.body;

    // Check if vendor already exists
    const existingVendor = await prisma.vendor.findUnique({
      where: { email }
    });

    if (existingVendor) {
      return res.status(400).json({ message: 'Vendor already exists with this email' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user first
    const user = await prisma.user.create({
      data: {
        phone: phoneNumber,
        name: name || companyName || 'Vendor',
        email,
        role: 'vendor',
        isActive: true,
        firebaseUid: `vendor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      }
    });

    // Create vendor
    const vendor = await prisma.vendor.create({
      data: {
        userId: user.id,
        companyName,
        email,
        phoneNumber,
        password: hashedPassword,
        isActive: true
      },
      include: {
        user: true
      }
    });

    const token = generateToken(vendor.id);

    res.status(201).json({
      message: 'Vendor registered successfully',
      token,
      vendor: {
        id: vendor.id,
        companyName: vendor.companyName,
        email: vendor.email,
        phoneNumber: vendor.phoneNumber,
        isActive: vendor.isActive,
        createdAt: vendor.createdAt
      }
    });
  } catch (error) {
    console.error('Vendor registration error:', error);
    res.status(500).json({ message: 'Server error during registration' });
  }
};

// Login Vendor (Unified for both Admin and Vendor)
const loginVendor = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check for hardcoded admin credentials first
    if (email === 'admin@plugbox.com' && password === 'password123') {
      const token = generateToken('admin_user_id');
      
      return res.json({
        message: 'Login successful',
        token,
        vendor: {
          id: 'admin_user_id',
          companyName: 'PlugBox Admin',
          email: 'admin@plugbox.com',
          phoneNumber: '+1234567890',
          isActive: true,
          walletBalance: 0,
          role: 'admin',
          name: 'Admin User'
        }
      });
    }

    // Only check database if not admin credentials
    const vendor = await prisma.vendor.findUnique({
      where: { email },
      include: {
        user: true
      }
    });

    if (!vendor) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (!vendor.isActive) {
      return res.status(401).json({ message: 'Account is deactivated' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, vendor.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Update last login
    await prisma.vendor.update({
      where: { id: vendor.id },
      data: { lastLogin: new Date() }
    });

    const token = generateToken(vendor.id);

    res.json({
      message: 'Login successful',
      token,
      vendor: {
        id: vendor.id,
        companyName: vendor.companyName,
        email: vendor.email,
        phoneNumber: vendor.phoneNumber,
        isActive: vendor.isActive,
        walletBalance: vendor.walletBalance,
        lastLogin: vendor.lastLogin,
        role: 'vendor',
        name: vendor.user?.name || vendor.companyName
      }
    });
  } catch (error) {
    console.error('Vendor login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
};

// Get Vendor Profile (Unified for both Admin and Vendor)
const getVendorProfile = async (req, res) => {
  try {
    // Check if it's the hardcoded admin
    if (req.vendor.id === 'admin_user_id') {
      return res.json({
        vendor: {
          id: 'admin_user_id',
          companyName: 'PlugBox Admin',
          email: 'admin@plugbox.com',
          phoneNumber: '+1234567890',
          kycStatus: 'APPROVED',
          isActive: true,
          walletBalance: 0,
          role: 'admin',
          name: 'Admin User',
          user: {
            name: 'Admin User',
            phone: '+1234567890',
            email: 'admin@plugbox.com'
          }
        }
      });
    }

    const vendor = await prisma.vendor.findUnique({
      where: { id: req.vendor.id },
      include: {
        user: true,
        chargers: {
          select: {
            id: true,
            name: true,
            status: true,
            displayName: true,
            locationId: true,
            createdAt: true
          }
        }
      }
    });

    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    res.json({
      vendor: {
        id: vendor.id,
        companyName: vendor.companyName,
        email: vendor.email,
        phoneNumber: vendor.phoneNumber,
        isActive: vendor.isActive,
        walletBalance: vendor.walletBalance,
        createdAt: vendor.createdAt,
        lastLogin: vendor.lastLogin,
        chargers: vendor.chargers,
        role: 'vendor',
        name: vendor.user?.name || vendor.companyName,
        user: {
          name: vendor.user.name,
          phone: vendor.user.phone,
          email: vendor.user.email
        }
      }
    });
  } catch (error) {
    console.error('Get vendor profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update Vendor Profile
const updateVendorProfile = async (req, res) => {
  try {
    const { companyName, phoneNumber } = req.body;
    const updateData = {};

    if (companyName) updateData.companyName = companyName;
    if (phoneNumber) updateData.phoneNumber = phoneNumber;

    const vendor = await prisma.vendor.update({
      where: { id: req.vendor.id },
      data: updateData,
      include: {
        user: true
      }
    });

    res.json({
      message: 'Profile updated successfully',
      vendor: {
        id: vendor.id,
        companyName: vendor.companyName,
        email: vendor.email,
        phoneNumber: vendor.phoneNumber,
        kycStatus: vendor.kycStatus,
        isActive: vendor.isActive,
        walletBalance: vendor.walletBalance
      }
    });
  } catch (error) {
    console.error('Update vendor profile error:', error);
    res.status(500).json({ message: 'Server error during profile update' });
  }
};

// Logout Vendor
const logoutVendor = async (req, res) => {
  try {
    res.json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Server error during logout' });
  }
};

module.exports = {
  registerVendor,
  loginVendor,
  getVendorProfile,
  updateVendorProfile,
  logoutVendor
};
