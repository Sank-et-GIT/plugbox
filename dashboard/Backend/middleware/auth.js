const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid token. User not found.' });
    }

    if (!user.isActive) {
      return res.status(401).json({ message: 'Account is deactivated.' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token.' });
    } else if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired.' });
    }
    res.status(500).json({ message: 'Server error in authentication.' });
  }
};

const vendorAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if it's a regular admin user from database
    const adminUser = await prisma.user.findUnique({
      where: { id: decoded.id }
    });
    
    if (adminUser && adminUser.role === 'admin') {
      req.vendor = {
        id: adminUser.id,
        email: adminUser.email,
        role: 'admin',
        isActive: adminUser.isActive,
        user: adminUser
      };
      return next();
    }
    
    const vendor = await prisma.vendor.findUnique({
      where: { id: decoded.id },
      include: {
        user: true
      }
    });
    
    if (!vendor) {
      return res.status(401).json({ message: 'Invalid token. Vendor not found.' });
    }

    if (!vendor.isActive) {
      return res.status(401).json({ message: 'Account is deactivated.' });
    }

    req.vendor = vendor;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token.' });
    } else if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired.' });
    }
    res.status(500).json({ message: 'Server error in authentication.' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: 'Access denied. Insufficient permissions.' 
      });
    }
    next();
  };
};

module.exports = { auth, vendorAuth, authorize };
