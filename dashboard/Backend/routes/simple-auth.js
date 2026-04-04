const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET || 'fallback_secret', {
    expiresIn: '7d'
  });
};

// Simple login bypass for testing
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    console.log('🔍 Login attempt:', email);
    
    // Simple test credentials
    if (email === 'test@gmail.com' && password === '123456') {
      const token = generateToken('test_user_id');
      
      return res.json({
        message: 'Login successful',
        token,
        user: {
          id: 'test_user_id',
          name: 'Test User',
          email: 'test@gmail.com',
          role: 'admin',
          phoneNumber: '+1234567890',
          avatar: ''
        }
      });
    }
    
    // Try another common test credential
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
    
    return res.status(401).json({ message: 'Invalid credentials' });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
});

router.get('/me', async (req, res) => {
  try {
    // For testing, return a mock user
    res.json({
      user: {
        id: 'test_user_id',
        name: 'Test User',
        email: 'test@gmail.com',
        role: 'admin',
        phoneNumber: '+1234567890',
        avatar: '',
        walletBalance: 0,
        kycStatus: 'VERIFIED'
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/logout', async (req, res) => {
  try {
    res.json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Server error during logout' });
  }
});

module.exports = router;
