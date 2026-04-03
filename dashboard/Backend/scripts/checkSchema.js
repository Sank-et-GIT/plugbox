const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

const checkSchema = async () => {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    console.log('\n📋 User Schema Fields:');
    console.log('====================');
    
    const schema = User.schema;
    const paths = schema.paths;
    
    Object.keys(paths).forEach(fieldName => {
      const field = paths[fieldName];
      console.log(`📝 ${fieldName}:`);
      console.log(`   Type: ${field.instance || field.options.type}`);
      console.log(`   Required: ${field.isRequired || false}`);
      console.log(`   Default: ${field.defaultValue}`);
      console.log(`   Unique: ${field.options.unique || false}`);
      console.log('');
    });

    console.log('\n🗄️ Collection Indexes:');
    console.log('===================');
    const indexes = await User.collection.getIndexes();
    Object.keys(indexes).forEach(indexName => {
      console.log(`🔑 ${indexName}:`, JSON.stringify(indexes[indexName]));
    });

    console.log('\n📊 Sample Document Structure:');
    console.log('==========================');
    const sampleDoc = new User({
      name: 'Test User',
      email: 'test@example.com',
      phoneNumber: '+1234567890',
      password: 'testpassword123',
      role: 'admin'
    });
    
    console.log('📄 Sample object:', JSON.stringify(sampleDoc.toObject(), null, 2));

  } catch (error) {
    console.error('💥 Schema check error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
};

checkSchema();
