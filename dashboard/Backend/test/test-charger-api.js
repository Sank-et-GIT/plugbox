// Test script for Charger API endpoints
// Run with: node test/test-charger-api.js

const axios = require('axios');

const API_BASE = 'http://localhost:5000/api';

// Test data
const testCharger = {
  chargerName: 'Test Charger API',
  chargerType: 'AC',
  connectorType: 'Type2',
  location: {
    address: '123 Test Street, Test City',
    lat: 19.0760,
    lng: 72.8777
  },
  pricePerUnit: 15.50,
  serialNumber: 'TEST001',
  installationDate: '2024-01-15'
};

// Mock JWT token (you'll need to replace this with a real token from your auth)
const mockToken = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjYwZjFiMmMzZDRlNWY2YTdiOGM5ZDBlMWYyYTNiIiwiaWF0IjoxNzEyNDM0NjAwLCJleHAiOjE3MTI1MjEwMDB9.test';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Authorization': mockToken,
    'Content-Type': 'application/json'
  }
};

async function testChargerAPI() {
  console.log('🧪 Testing Charger API Endpoints...\n');

  try {
    // Test 1: Get all chargers (should be empty initially)
    console.log('1️⃣ Testing GET /api/chargers');
    const getChargersResponse = await api.get('/chargers');
    console.log('✅ Get chargers successful:', getChargersResponse.data);
    console.log('📊 Total chargers:', getChargersResponse.data.chargers?.length || 0);
    console.log('');

    // Test 2: Create a new charger
    console.log('2️⃣ Testing POST /api/chargers');
    const createChargerResponse = await api.post('/chargers', testCharger);
    console.log('✅ Create charger successful:', createChargerResponse.data);
    const chargerId = createChargerResponse.data.charger._id;
    const generatedChargerId = createChargerResponse.data.charger.chargerId;
    console.log('🆔 Generated Charger ID:', generatedChargerId);
    console.log('');

    // Test 3: Get single charger
    console.log('3️⃣ Testing GET /api/chargers/:id');
    const getSingleChargerResponse = await api.get(`/chargers/${chargerId}`);
    console.log('✅ Get single charger successful:', getSingleChargerResponse.data);
    console.log('');

    // Test 4: Update charger
    console.log('4️⃣ Testing PUT /api/chargers/:id');
    const updateData = {
      chargerName: 'Updated Test Charger',
      pricePerUnit: 20.00
    };
    const updateChargerResponse = await api.put(`/chargers/${chargerId}`, updateData);
    console.log('✅ Update charger successful:', updateChargerResponse.data);
    console.log('');

    // Test 5: Update charger status
    console.log('5️⃣ Testing PATCH /api/chargers/:id/status');
    const statusUpdateResponse = await api.patch(`/chargers/${chargerId}/status`, {
      status: 'On_Maintenance'
    });
    console.log('✅ Update charger status successful:', statusUpdateResponse.data);
    console.log('');

    // Test 6: Get charger statistics
    console.log('6️⃣ Testing GET /api/chargers/stats');
    const statsResponse = await api.get('/chargers/stats');
    console.log('✅ Get charger stats successful:', statsResponse.data);
    console.log('');

    // Test 7: Get all chargers again (should show our test charger)
    console.log('7️⃣ Testing GET /api/chargers (after creation)');
    const finalChargersResponse = await api.get('/chargers');
    console.log('✅ Final chargers list:', finalChargersResponse.data);
    console.log('📊 Total chargers now:', finalChargersResponse.data.chargers?.length || 0);
    console.log('');

    // Test 8: Delete charger (soft delete)
    console.log('8️⃣ Testing DELETE /api/chargers/:id');
    const deleteChargerResponse = await api.delete(`/chargers/${chargerId}`);
    console.log('✅ Delete charger successful:', deleteChargerResponse.data);
    console.log('');

    console.log('🎉 All tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      console.log('\n💡 Note: You may need to update the mockToken with a valid JWT token');
      console.log('   Get a valid token by logging in through the frontend or using the auth endpoint');
    }
    
    if (error.response?.status === 403) {
      console.log('\n💡 Note: Access denied. Check if the token has proper vendor permissions');
    }
  }
}

// Test validation endpoints
async function testValidation() {
  console.log('\n🔍 Testing Validation...\n');

  try {
    // Test invalid charger data
    console.log('Testing invalid charger creation (missing required fields)...');
    await api.post('/chargers', {
      chargerName: 'Invalid Charger'
      // Missing other required fields
    });
  } catch (error) {
    console.log('✅ Validation error caught correctly:', error.response?.data);
  }

  try {
    // Test invalid coordinates
    console.log('Testing invalid coordinates...');
    await api.post('/chargers', {
      ...testCharger,
      location: {
        address: 'Test Address',
        lat: 91, // Invalid latitude
        lng: 181 // Invalid longitude
      }
    });
  } catch (error) {
    console.log('✅ Coordinate validation error caught correctly:', error.response?.data);
  }

  try {
    // Test negative price
    console.log('Testing negative price...');
    await api.post('/chargers', {
      ...testCharger,
      pricePerUnit: -10
    });
  } catch (error) {
    console.log('✅ Price validation error caught correctly:', error.response?.data);
  }
}

// Run tests
if (require.main === module) {
  testChargerAPI()
    .then(() => testValidation())
    .then(() => {
      console.log('\n🏁 All validation tests completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Test suite failed:', error);
      process.exit(1);
    });
}

module.exports = { testChargerAPI, testValidation };
