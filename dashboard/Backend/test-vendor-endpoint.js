const axios = require('axios');

async function testVendorEndpoint() {
  try {
    console.log('Testing /api/admin/vendor-users endpoint...');
    const response = await axios.get('http://localhost:5002/api/admin/vendor-users');
    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testVendorEndpoint();
