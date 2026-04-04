const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const checkUsers = async () => {
  try {
    console.log('🔍 Checking users table data...\n');

    // Get all users
    const users = await prisma.user.findMany({
      include: {
        vendor: true
      }
    });

    console.log(`📊 Found ${users.length} users:`);
    users.forEach((user, index) => {
      console.log(`\n👤 User ${index + 1}:`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Name: ${user.name}`);
      console.log(`   Email: ${user.email || 'N/A'}`);
      console.log(`   Phone: ${user.phone}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Active: ${user.isActive}`);
      console.log(`   Firebase UID: ${user.firebaseUid}`);
      console.log(`   Created: ${user.createdAt}`);
      
      if (user.vendor) {
        console.log(`   🏢 Vendor Info:`);
        console.log(`      Vendor ID: ${user.vendor.id}`);
        console.log(`      Company: ${user.vendor.companyName || 'N/A'}`);
        console.log(`      Vendor Email: ${user.vendor.email}`);
        console.log(`      KYC Status: ${user.vendor.kycStatus}`);
        console.log(`      Wallet Balance: ${user.vendor.walletBalance}`);
      }
    });

    // Check for admin users specifically
    const adminUsers = users.filter(u => u.role === 'admin');
    console.log(`\n👑 Admin Users (${adminUsers.length}):`);
    adminUsers.forEach(admin => {
      console.log(`   - ${admin.name} (${admin.email || 'N/A'}) - Active: ${admin.isActive}`);
    });

    // Check for vendor users specifically
    const vendorUsers = users.filter(u => u.role === 'vendor');
    console.log(`\n🏪 Vendor Users (${vendorUsers.length}):`);
    vendorUsers.forEach(vendor => {
      console.log(`   - ${vendor.name} (${vendor.email || 'N/A'}) - Active: ${vendor.isActive}`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
};

checkUsers();
