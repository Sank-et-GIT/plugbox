const express = require('express');
const User = require('../models/User');
const router = express.Router();

router.get('/schema', async (req, res) => {
  try {
    console.log('🔍 Debug: Checking schema...');
    
    const schema = User.schema;
    const paths = schema.paths;
    
    const schemaInfo = {};
    Object.keys(paths).forEach(fieldName => {
      const field = paths[fieldName];
      schemaInfo[fieldName] = {
        type: field.instance || field.options.type,
        required: field.isRequired || false,
        default: field.defaultValue,
        unique: field.options.unique || false,
        enum: field.options.enum || null
      };
    });

    res.json({
      message: 'Schema debug info',
      schema: schemaInfo,
      collection: User.collection.name
    });
  } catch (error) {
    console.error('💥 Schema debug error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/test-user', async (req, res) => {
  try {
    console.log('🧪 Testing user creation...');
    
    const testData = {
      name: 'Debug User',
      email: 'debug@test.com',
      phoneNumber: '+1234567890',
      password: 'testpassword123',
      role: 'admin'
    };
    
    console.log('📝 Test data:', testData);
    
    const user = new User(testData);
    console.log('👤 User instance created:', user._id);
    
    const userObj = user.toObject();
    console.log('📄 User object:', userObj);
    
    res.json({
      message: 'Test user created successfully',
      user: userObj,
      userId: user._id
    });
  } catch (error) {
    console.error('💥 Test user error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
