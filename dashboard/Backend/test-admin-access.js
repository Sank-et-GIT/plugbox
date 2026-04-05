const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Create test admin token
const createTestToken = (role = 'admin') => {
  return jwt.sign(
    { 
      id: 'test-admin-id',
      role: role,
      email: 'admin@plugbox.com'
    }, 
    process.env.JWT_SECRET || 'fallback_secret', 
    { expiresIn: '7d' }
  );
};

// Import vendor controller functions
const { getVendorStats, getVendors } = require('./controllers/vendorController');

// Test routes with auth middleware bypass
app.get('/test/vendor/stats', (req, res) => {
  // Mock admin user
  req.user = { id: 'test-admin-id', role: 'admin' };
  return getVendorStats(req, res);
});

app.get('/test/vendor', (req, res) => {
  // Mock admin user
  req.user = { id: 'test-admin-id', role: 'admin' };
  return getVendors(req, res);
});

// Get test token endpoint
app.get('/test/token', (req, res) => {
  const adminToken = createTestToken('admin');
  const vendorToken = createTestToken('vendor');
  
  res.json({
    adminToken,
    vendorToken,
    message: 'Use these tokens for testing'
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Test server running' });
});

const PORT = 5003;

const server = app.listen(PORT, () => {
  console.log(`Test server running on port ${PORT}`);
  console.log(`Test endpoints:`);
  console.log(`- GET http://localhost:${PORT}/test/token - Get test tokens`);
  console.log(`- GET http://localhost:${PORT}/test/vendor/stats - Test vendor stats (admin)`);
  console.log(`- GET http://localhost:${PORT}/test/vendor - Test vendor list (admin)`);
  console.log(`\nExample usage:`);
  console.log(`curl -H "Authorization: Bearer <token>" http://localhost:${PORT}/test/vendor/stats`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

module.exports = app;
