const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Mock controller functions
const getVendorStats = async (req, res) => {
  try {
    res.json({
      success: true,
      stats: {
        totalVendors: 3,
        activeVendors: 2,
        pendingVendors: 1,
        verifiedVendors: 2,
        totalRevenue: 525000,
        totalPayout: 470800,
        averageRating: 4.37
      },
      statusBreakdown: [
        { _id: 'active', count: 2 },
        { _id: 'pending', count: 1 }
      ],
      verificationBreakdown: [
        { _id: 'verified', count: 2 },
        { _id: 'pending', count: 1 }
      ]
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const getVendors = async (req, res) => {
  try {
    const mockVendors = [
      {
        _id: '60f1b2c3d4e5f6a7b8c9d0e1',
        vendorName: 'Quick Charge Stations',
        email: 'quick@charge.com',
        mobileNumber: '9876543210',
        shopName: 'Quick Charge Hub',
        shopAddress: '123 Main St, Mumbai, Maharashtra 400001',
        status: 'active',
        verificationStatus: 'verified',
        totalRevenue: 250000,
        totalPayout: 225000,
        pendingPayout: 25000,
        totalChargers: 8,
        activeChargers: 7,
        totalSessions: 450,
        averageRating: 4.7,
        createdAt: new Date('2024-01-15'),
        updatedAt: new Date('2024-01-15')
      },
      {
        _id: '60f1b2c3d4e5f6a7b8c9d0e2',
        vendorName: 'Green Energy Hub',
        email: 'green@energy.com',
        mobileNumber: '9876543211',
        shopName: 'Green Energy Station',
        shopAddress: '456 Park Ave, Delhi, Delhi 110001',
        status: 'active',
        verificationStatus: 'verified',
        totalRevenue: 180000,
        totalPayout: 158400,
        pendingPayout: 21600,
        totalChargers: 5,
        activeChargers: 4,
        totalSessions: 320,
        averageRating: 4.3,
        createdAt: new Date('2024-01-10'),
        updatedAt: new Date('2024-01-10')
      },
      {
        _id: '60f1b2c3d4e5f6a7b8c9d0e3',
        vendorName: 'Metro Charge Points',
        email: 'metro@charge.com',
        mobileNumber: '9876543212',
        shopName: 'Metro Charging',
        shopAddress: '789 Station Rd, Bangalore, Karnataka 560001',
        status: 'pending',
        verificationStatus: 'pending',
        totalRevenue: 95000,
        totalPayout: 87400,
        pendingPayout: 7600,
        totalChargers: 3,
        activeChargers: 2,
        totalSessions: 180,
        averageRating: 4.1,
        createdAt: new Date('2024-01-05'),
        updatedAt: new Date('2024-01-05')
      }
    ];

    res.json({
      success: true,
      vendors: mockVendors,
      pagination: {
        page: 1,
        limit: 10,
        total: mockVendors.length,
        pages: Math.ceil(mockVendors.length / 10)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Test routes without auth
app.get('/test/vendor/stats', getVendorStats);
app.get('/test/vendor', getVendors);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Test server running' });
});

const PORT = 5002;

const server = app.listen(PORT, () => {
  console.log(`Test server running on port ${PORT}`);
  console.log(`Test endpoints:`);
  console.log(`- GET http://localhost:${PORT}/test/vendor/stats`);
  console.log(`- GET http://localhost:${PORT}/test/vendor`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

module.exports = app;
