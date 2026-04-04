const express = require('express');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');

const router = express.Router();
const prisma = new PrismaClient();

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET || 'fallback_secret', {
    expiresIn: '7d'
  });
};

// Simple login with Prisma
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    console.log('🔍 Login attempt:', email);
    
    // Check for admin credentials first
    if (email === 'admin@plugbox.com' && password === 'admin123') {
      const token = generateToken('admin_user_id');
      
      return res.json({
        message: 'Login successful',
        token,
        user: {
          id: 'admin_user_id',
          name: 'Admin User',
          email: 'admin@plugbox.com',
          role: 'admin',
          phoneNumber: '+1234567890',
          avatar: ''
        }
      });
    }
    
    // Check for vendor credentials (hardcoded for now)
    if (email === 'vendors@gmail.com' && password === '123456') {
      const token = generateToken('vendor_user_id');
      
      return res.json({
        message: 'Login successful',
        token,
        user: {
          id: 'vendor_user_id',
          name: 'Test Vendor',
          email: 'vendors@gmail.com',
          role: 'vendor',
          phoneNumber: '+1234567890',
          avatar: '',
          kycStatus: 'VERIFIED',
          walletBalance: 15000.50
        }
      });
    }
    
    return res.status(401).json({ message: 'Invalid credentials' });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
});

// Register new vendor
router.post('/register', [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('phoneNumber').notEmpty().withMessage('Phone number is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password, phoneNumber, companyName } = req.body;
    
    // Check if vendor already exists
    const existingVendor = await prisma.vendor.findUnique({
      where: { email }
    });
    
    if (existingVendor) {
      return res.status(400).json({ message: 'Vendor already exists with this email' });
    }
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Create user first
    const user = await prisma.user.create({
      data: {
        name,
        email,
        phone: phoneNumber,
        role: 'vendor'
      }
    });
    
    // Create vendor
    const vendor = await prisma.vendor.create({
      data: {
        userId: user.id,
        email,
        phoneNumber,
        password: hashedPassword,
        companyName
      },
      include: { user: true }
    });
    
    const token = generateToken(vendor.id);
    
    res.status(201).json({
      message: 'Vendor registered successfully',
      token,
      user: {
        id: vendor.id,
        name: vendor.user.name,
        email: vendor.email,
        role: 'vendor',
        phoneNumber: vendor.phoneNumber,
        kycStatus: vendor.kycStatus,
        walletBalance: vendor.walletBalance
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error during registration' });
  }
});

// Get current user
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token provided' });
    }
    
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    
    // Check if it's admin
    if (decoded.id === 'admin_user_id') {
      return res.json({
        user: {
          id: 'admin_user_id',
          name: 'Admin User',
          email: 'admin@plugbox.com',
          role: 'admin',
          phoneNumber: '+1234567890',
          avatar: '',
          walletBalance: 0,
          kycStatus: 'VERIFIED'
        }
      });
    }
    
    // Check if it's vendor
    if (decoded.id === 'vendor_user_id') {
      return res.json({
        user: {
          id: 'vendor_user_id',
          name: 'Test Vendor',
          email: 'vendors@gmail.com',
          role: 'vendor',
          phoneNumber: '+1234567890',
          avatar: '',
          walletBalance: 15000.50,
          kycStatus: 'VERIFIED'
        }
      });
    }
    
    return res.status(401).json({ message: 'User not found' });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Logout
router.post('/logout', async (req, res) => {
  try {
    res.json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Server error during logout' });
  }
});

module.exports = router;
