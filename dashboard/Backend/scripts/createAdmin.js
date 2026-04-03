const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
require('dotenv').config();

const createAdmin = async () => {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGO_URI);
    console.log('🔗 Connected to MongoDB');

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: 'Saibhoyar12345@gmail.com' });
    
    if (existingAdmin) {
      console.log('⚠️ Admin user already exists');
      await mongoose.connection.close();
      return;
    }

    // Create admin user
    const adminUser = new User({
      name: 'Sai Bhoyar',
      email: 'Saibhoyar12345@gmail.com',
      password: '123456',
      phoneNumber: '1234567890',
      role: 'admin',
      isActive: true
    });

    await adminUser.save();
    console.log('✅ Admin user created successfully');
    console.log('📧 Email: Saibhoyar12345@gmail.com');
    console.log('🔑 Password: 123456');
    console.log('👤 Role: admin');

  } catch (error) {
    console.error('❌ Error creating admin:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
};

createAdmin();
