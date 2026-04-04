const axios = require('axios');

const testAdminComplete = async () => {
  try {
    console.log('🧪 Testing complete admin flow...\n');

    // Test admin login
    console.log('1. Testing admin login...');
    const adminLogin = await axios.post('http://localhost:5001/api/auth/login', {
      email: 'admin@plugbox.com',
      password: 'password123'
    });
    
    console.log('✅ Admin login successful');
    console.log('User role:', adminLogin.data.user.role);
    console.log('User name:', adminLogin.data.user.name);

    // Test admin user info
    console.log('\n2. Testing admin user info...');
    const userInfo = await axios.get('http://localhost:5001/api/auth/me', {
      headers: {
        'Authorization': `Bearer ${adminLogin.data.token}`
      }
    });

    console.log('✅ User info response');
    console.log('User role from /me:', userInfo.data.user.role);
    console.log('User name from /me:', userInfo.data.user.name);

    // Test admin chargers
    console.log('\n3. Testing admin chargers...');
    const adminChargers = await axios.get('http://localhost:5001/api/chargers', {
      headers: {
        'Authorization': `Bearer ${adminLogin.data.token}`
      }
    });

    console.log('✅ Admin chargers response');
    console.log('Success:', adminChargers.data.success);
    console.log('Chargers count:', adminChargers.data.chargers?.length || 0);
    
    if (adminChargers.data.chargers && adminChargers.data.chargers.length > 0) {
      console.log('Chargers found:');
      adminChargers.data.chargers.forEach((charger, index) => {
        console.log(`   ${index + 1}. ${charger.chargerName} - Status: ${charger.status}`);
      });
    }

    console.log('\n🎉 ADMIN FLOW TEST COMPLETE!');
    console.log('🌐 Frontend should now show all chargers for admin');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
};

testAdminComplete();
