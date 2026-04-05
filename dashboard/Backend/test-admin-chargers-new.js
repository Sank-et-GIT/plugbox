const axios = require('axios');

async function testAdminChargers() {
  try {
    console.log('Testing /api/admin/chargers-prisma endpoint...');
    const response = await axios.get('http://localhost:5002/api/admin/chargers-prisma');
    console.log('Response status:', response.status);
    console.log('Number of chargers:', response.data.chargers?.length || 0);
    if (response.data.chargers?.length > 0) {
      console.log('First charger structure:', JSON.stringify(response.data.chargers[0], null, 2));
    }
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testAdminChargers();
