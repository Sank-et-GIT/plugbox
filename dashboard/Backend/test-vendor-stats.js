const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const testVendorStats = async () => {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/plugbox');
    console.log('Connected to MongoDB');
    
    const Vendor = require('./models/Vendor');
    
    // Clear existing vendors and create test data
    await Vendor.deleteMany({});
    
    // Create test vendors
    const testVendors = [
      {
        vendorName: 'Quick Charge Stations',
        email: 'quick@charge.com',
        mobileNumber: '9876543210',
        shopAddress: '123 Main St, Mumbai, Maharashtra 400001',
        bankAccountNumber: '1234567890123456',
        ifscCode: 'HDFC0001234',
        bankName: 'HDFC Bank',
        accountHolderName: 'Quick Charge',
        panNumber: 'ABCDE1234F',
        aadhaarNumber: '123456789012',
        businessType: 'EV Charging Station',
        description: 'Fast EV charging stations',
        status: 'active',
        commission: 10,
        verificationStatus: 'verified',
        totalRevenue: 250000,
        totalPayout: 225000,
        pendingPayout: 25000,
        totalChargers: 8,
        activeChargers: 7,
        totalSessions: 450,
        averageRating: 4.7
      },
      {
        vendorName: 'Green Energy Hub',
        email: 'green@energy.com',
        mobileNumber: '9876543211',
        shopAddress: '456 Park Ave, Delhi, Delhi 110001',
        bankAccountNumber: '9876543210987654',
        ifscCode: 'ICIC0001234',
        bankName: 'ICICI Bank',
        accountHolderName: 'Green Energy',
        panNumber: 'FGHIJ5678K',
        aadhaarNumber: '987654321098',
        businessType: 'Solar EV Charging',
        description: 'Solar-powered EV charging',
        status: 'active',
        commission: 12,
        verificationStatus: 'verified',
        totalRevenue: 180000,
        totalPayout: 158400,
        pendingPayout: 21600,
        totalChargers: 5,
        activeChargers: 4,
        totalSessions: 320,
        averageRating: 4.3
      },
      {
        vendorName: 'Metro Charge Points',
        email: 'metro@charge.com',
        mobileNumber: '9876543212',
        shopAddress: '789 Station Rd, Bangalore, Karnataka 560001',
        bankAccountNumber: '5555666677778888',
        ifscCode: 'SBI0001234',
        bankName: 'State Bank of India',
        accountHolderName: 'Metro Charge',
        panNumber: 'LMNOP9012Q',
        aadhaarNumber: '555666777888',
        businessType: 'Public EV Charging',
        description: 'Public charging stations near metro',
        status: 'pending',
        commission: 8,
        verificationStatus: 'pending',
        totalRevenue: 95000,
        totalPayout: 87400,
        pendingPayout: 7600,
        totalChargers: 3,
        activeChargers: 2,
        totalSessions: 180,
        averageRating: 4.1
      }
    ];
    
    await Vendor.insertMany(testVendors);
    
    // Test the aggregation query used in getVendorStats
    const stats = await Vendor.aggregate([
      {
        $group: {
          _id: null,
          totalVendors: { $sum: 1 },
          activeVendors: {
            $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
          },
          pendingVendors: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
          },
          verifiedVendors: {
            $sum: { $cond: [{ $eq: ['$verificationStatus', 'verified'] }, 1, 0] }
          },
          totalRevenue: { $sum: '$totalRevenue' },
          totalPayout: { $sum: '$totalPayout' },
          averageRating: { $avg: '$averageRating' }
        }
      }
    ]);
    
    console.log('\n✅ Test vendors created successfully!');
    console.log('📊 Vendor Stats Test Results:');
    console.log('Total Vendors:', stats[0]?.totalVendors || 0);
    console.log('Active Vendors:', stats[0]?.activeVendors || 0);
    console.log('Pending Vendors:', stats[0]?.pendingVendors || 0);
    console.log('Verified Vendors:', stats[0]?.verifiedVendors || 0);
    console.log('Total Revenue:', stats[0]?.totalRevenue || 0);
    console.log('Total Payout:', stats[0]?.totalPayout || 0);
    console.log('Average Rating:', (stats[0]?.averageRating || 0).toFixed(1));
    
    console.log('\n🎉 The vendor stats endpoint should now show these values!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    mongoose.connection.close();
  }
};

testVendorStats();
