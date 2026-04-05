// Set up environment with correct database path
process.env.DATABASE_URL = "file:./dev.db";
process.env.PORT = "3001";

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testAndFixVendorData() {
  try {
    console.log('🔍 Testing database connection and vendor data...');
    
    // Test 1: Check if users table has vendor role users
    const vendorUsers = await prisma.user.findMany({
      where: { role: 'vendor' },
      include: {
        vendor: true,
        wallet: true
      }
    });
    
    console.log(`Found ${vendorUsers.length} users with vendor role:`);
    vendorUsers.forEach(user => {
      console.log(`  - ${user.name} (${user.email}) - Active: ${user.isActive}`);
      console.log(`    Vendor ID: ${user.vendor?.id || 'No vendor record'}`);
      console.log(`    Wallet Balance: ${user.wallet?.balance || 0}`);
      console.log(`    Phone: ${user.phone}`);
    });
    
    if (vendorUsers.length === 0) {
      console.log('\n❌ No vendor users found! Creating sample vendors...');
      await require('./create-sample-vendors.js');
    }
    
    // Test 2: Check vendor table separately
    const vendors = await prisma.vendor.findMany({
      include: {
        user: true,
        chargers: true
      }
    });
    
    console.log(`\nFound ${vendors.length} records in vendor table:`);
    vendors.forEach(vendor => {
      console.log(`  - ${vendor.companyName} (${vendor.email})`);
      console.log(`    User: ${vendor.user?.name || 'No linked user'}`);
      console.log(`    Chargers: ${vendor.chargers.length}`);
    });
    
    console.log('\n✅ Database test completed successfully!');
    console.log('📋 Next steps:');
    console.log('1. Start backend server: npm run dev');
    console.log('2. Test API endpoint: GET http://localhost:3001/api/admin/vendor-users');
    
  } catch (error) {
    console.error('❌ Database error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testAndFixVendorData();
