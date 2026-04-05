const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testVendorData() {
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
    
  } catch (error) {
    console.error('❌ Database error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testVendorData();
