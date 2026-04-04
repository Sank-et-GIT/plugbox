const axios = require('axios');

const testAPI = async () => {
  try {
    console.log('🧪 Testing final API setup...\n');

    // Test admin login
    console.log('1. Testing admin login...');
    const adminLogin = await axios.post('http://localhost:5001/api/auth/login', {
      email: 'admin@plugbox.com',
      password: 'password123'
    });
    
    console.log('✅ Admin login successful');
    console.log('Token received:', adminLogin.data.token ? 'YES' : 'NO');
    console.log('User role:', adminLogin.data.user.role);

    // Test admin chargers
    console.log('\n2. Testing admin chargers...');
    const adminChargers = await axios.get('http://localhost:5001/api/chargers', {
      headers: {
        'Authorization': `Bearer ${adminLogin.data.token}`
      }
    });

    console.log('✅ Admin chargers response');
    console.log('Success:', adminChargers.data.success);
    console.log('Chargers count:', adminChargers.data.chargers?.length || 0);
    
    if (adminChargers.data.chargers && adminChargers.data.chargers.length > 0) {
      console.log('First charger:', adminChargers.data.chargers[0].chargerName);
    }

    // Test vendor login
    console.log('\n3. Testing vendor login...');
    const vendorLogin = await axios.post('http://localhost:5001/api/auth/login', {
      email: 'testvendor@plugbox.com',
      password: 'password123'
    });
    
    console.log('✅ Vendor login successful');
    console.log('Token received:', vendorLogin.data.token ? 'YES' : 'NO');
    console.log('User role:', vendorLogin.data.user.role);

    // Test vendor chargers
    console.log('\n4. Testing vendor chargers...');
    const vendorChargers = await axios.get('http://localhost:5001/api/vendor/chargers', {
      headers: {
        'Authorization': `Bearer ${vendorLogin.data.token}`
      }
    });

    console.log('✅ Vendor chargers response');
    console.log('Success:', vendorChargers.data.success);
    console.log('Chargers count:', vendorChargers.data.data?.length || 0);
    
    if (vendorChargers.data.data && vendorChargers.data.data.length > 0) {
      console.log('First charger:', vendorChargers.data.data[0].name);
    }

    console.log('\n🎉 ALL TESTS COMPLETED SUCCESSFULLY!');
    console.log('🌐 Frontend should now work properly at http://localhost:3002');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
};

testAPI();
