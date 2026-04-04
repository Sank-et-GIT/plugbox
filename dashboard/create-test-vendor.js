// Auto-create test vendor for testing
const axios = require('axios');
const mongoose = require('mongoose');

const createTestVendor = async () => {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/plugbox');
    
    // Create test vendor
    const Vendor = require('./models/Vendor');
    
    // Check if test vendor exists
    const existingVendor = await Vendor.findOne({ email: 'testvendor@plugbox.com' });
    
    if (!existingVendor) {
      const testVendor = new Vendor({
        vendorName: 'Test EV Charging Company',
        email: 'testvendor@plugbox.com',
        mobileNumber: '9876543210',
        shopAddress: '123 Test Street, Mumbai, Maharashtra 400001',
        bankAccountNumber: '1234567890123456',
        ifscCode: 'HDFC0001234',
        bankName: 'HDFC Bank',
        accountHolderName: 'Test Vendor',
        panNumber: 'ABCDE1234F',
        aadhaarNumber: '123456789012',
        businessType: 'EV Charging Station',
        description: 'Test EV charging station for development',
        status: 'active',
        commission: 10,
        verificationStatus: 'verified'
      });
      
      await testVendor.save();
      console.log('✅ Test vendor created successfully!');
      console.log('Email: testvendor@plugbox.com');
      console.log('Password: (set during registration)');
    } else {
      console.log('✅ Test vendor already exists!');
    }
    
    // Create test charger for the vendor
    const Charger = require('./models/Charger');
    const vendor = await Vendor.findOne({ email: 'testvendor@plugbox.com' });
    
    if (vendor) {
      const existingCharger = await Charger.findOne({ vendorId: vendor._id });
      
      if (!existingCharger) {
        const testCharger = new Charger({
          vendorId: vendor._id,
          chargerName: 'Main Street EV Charger',
          chargerType: 'AC',
          connectorType: 'Type2',
          location: {
            address: '123 Main Street, Mumbai, Maharashtra 400001',
            lat: 19.0760,
            lng: 72.8777
          },
          pricePerUnit: 12.50,
          serialNumber: 'EV-CHR-TEST-001',
          status: 'Available'
        });
        
        await testCharger.save();
        console.log('✅ Test charger created successfully!');
        console.log('Charger ID:', testCharger.chargerId);
      } else {
        console.log('✅ Test charger already exists!');
      }
    }
    
    console.log('\n🎉 Auto-setup complete!');
    console.log('You can now login and test the charger management system.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    mongoose.connection.close();
  }
};

createTestVendor();
