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

// Login with Prisma database
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    console.log('🔍 Database login attempt:', email);
    
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }
    
    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        vendor: true
      }
    });
    
    if (!user) {
      console.log('❌ User not found:', email);
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    // Check if user is active
    if (!user.isActive) {
      console.log('❌ User is inactive:', email);
      return res.status(401).json({ message: 'Account is inactive' });
    }
    
    let passwordMatch = false;
    let userData = {};
    
    // Handle admin login (no password hash in database)
    if (user.role === 'admin') {
      // For admin, check against plain password (should be hashed in production)
      passwordMatch = password === 'password123'; // Temporary - should use bcrypt
      userData = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phoneNumber: user.phone,
        avatar: '',
        walletBalance: 0,
        kycStatus: 'VERIFIED'
      };
    }
    
    // Handle vendor login
    else if (user.role === 'vendor' && user.vendor) {
      // Check password against vendor table (hashed)
      passwordMatch = await bcrypt.compare(password, user.vendor.password);
      userData = {
        id: user.vendor.id,
        name: user.name,
        email: user.vendor.email,
        role: user.role,
        phoneNumber: user.vendor.phoneNumber,
        avatar: '',
        walletBalance: user.vendor.walletBalance,
        kycStatus: user.vendor.kycStatus,
        companyName: user.vendor.companyName
      };
    }
    
    if (!passwordMatch) {
      console.log('❌ Password mismatch for:', email);
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    // Generate token
    const token = generateToken(userData.id);
    
    console.log('✅ Login successful:', email, 'Role:', user.role);
    
    res.json({
      message: 'Login successful',
      token,
      user: userData
    });
    
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
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
    
    // Find user from database using decoded ID (could be user ID or vendor ID)
    let user = null;
    
    // First try to find as vendor (since most logins will be vendors)
    user = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: {
        vendor: true
      }
    });
    
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }
    
    let userData = {};
    
    if (user.role === 'admin') {
      userData = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phoneNumber: user.phone,
        avatar: '',
        walletBalance: 0,
        kycStatus: 'VERIFIED'
      };
    } else if (user.role === 'vendor' && user.vendor) {
      userData = {
        id: user.vendor.id,
        name: user.name,
        email: user.vendor.email,
        role: user.role,
        phoneNumber: user.vendor.phoneNumber,
        avatar: '',
        walletBalance: user.vendor.walletBalance,
        kycStatus: user.vendor.kycStatus,
        companyName: user.vendor.companyName
      };
    }
    
    res.json({ user: userData });
    
  } catch (error) {
    console.error('❌ Get user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Logout
router.post('/logout', async (req, res) => {
  try {
    res.json({ message: 'Logout successful' });
  } catch (error) {
    console.error('❌ Logout error:', error);
    res.status(500).json({ message: 'Server error during logout' });
  }
});

module.exports = router;
