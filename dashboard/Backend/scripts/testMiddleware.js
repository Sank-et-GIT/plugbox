const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

const testMiddleware = async () => {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    console.log('\n🔍 Checking User schema middleware...');
    
    // Check pre-save hooks
    const preHooks = User.schema.pres || {};
    console.log('📝 Pre hooks:', Object.keys(preHooks));
    
    if (preHooks.save) {
      console.log('💾 Pre-save hooks found:', preHooks.save.length);
      preHooks.save.forEach((hook, index) => {
        console.log(`🔧 Hook ${index}:`, hook.toString().substring(0, 100) + '...');
      });
    }

    console.log('\n🧪 Testing user creation...');
    
    const userData = {
      name: 'Test User',
      email: 'test@example.com',
      phoneNumber: '+1234567890',
      password: 'testpassword123',
      role: 'admin'
    };
    
    console.log('📝 Creating user with data:', userData);
    
    const user = new User(userData);
    console.log('👤 User instance created');
    
    // Test the pre-save middleware manually
    console.log('🔧 Testing pre-save middleware...');
    
    const mockNext = (error) => {
      if (error) {
        console.error('❌ Next called with error:', error);
      } else {
        console.log('✅ Next called successfully');
      }
    };
    
    // Call the pre-save middleware
    const preSaveMiddleware = user.schema.pres.save[0];
    await preSaveMiddleware.call(user, mockNext);

  } catch (error) {
    console.error('💥 Test error:', error);
    console.error('📍 Error stack:', error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
};

testMiddleware();
