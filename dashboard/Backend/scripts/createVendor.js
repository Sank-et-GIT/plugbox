const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
require('dotenv').config();

const createVendor = async () => {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGO_URI);
    console.log('🔗 Connected to MongoDB');

    // Check if vendor already exists
    const existingVendor = await User.findOne({ email: 'vendor@test.com' });
    
    if (existingVendor) {
      console.log('⚠️ Vendor user already exists');
      await mongoose.connection.close();
      return;
    }

    // Create vendor user
    const vendorUser = new User({
      name: 'Test Vendor',
      email: 'vendor@test.com',
      password: 'vendor123',
      phoneNumber: '9876543210',
      role: 'vendor',
      isActive: true
    });

    await vendorUser.save();
    console.log('✅ Vendor user created successfully');
    console.log('📧 Email: vendor@test.com');
    console.log('🔑 Password: vendor123');
    console.log('👤 Role: vendor');

  } catch (error) {
    console.error('❌ Error creating vendor:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
};

createVendor();
