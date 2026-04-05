require('dotenv').config();
// Set DATABASE_URL if not in env
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "file:" + __dirname + "/prisma/dev.db";
}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getVendorCredentials() {
  try {
    console.log('🔍 Getting vendor credentials from database...');
    
    // Get all users with vendor role
    const vendorUsers = await prisma.user.findMany({
      where: {
        role: 'vendor'
      },
      include: {
        vendor: true,
        wallet: true
      },
      orderBy: { createdAt: 'desc' },
    });

    console.log(`\n📋 Found ${vendorUsers.length} vendor users:\n`);
    
    vendorUsers.forEach((user, index) => {
      console.log(`👤 Vendor ${index + 1}:`);
      console.log(`   Name: ${user.name || 'Not set'}`);
      console.log(`   Email: ${user.email || 'Not set'}`);
      console.log(`   Phone: ${user.phone}`);
      console.log(`   Password: ${user.password}`);
      console.log(`   Company: ${user.vendor?.companyName || 'Not set'}`);
      console.log(`   Status: ${user.isActive ? 'Active' : 'Inactive'}`);
      console.log(`   KYC Status: ${user.vendor?.kycStatus || 'PENDING'}`);
      console.log(`   Wallet Balance: ₹${user.wallet?.balance || 0}`);
      console.log(`   Created: ${user.createdAt}`);
      console.log(`   Firebase UID: ${user.firebaseUid}`);
      console.log(`   User ID: ${user.id}`);
      console.log(`   Vendor ID: ${user.vendor?.id || 'No vendor record'}`);
      console.log('---');
    });

    // Also check if there are any admin users
    const adminUsers = await prisma.user.findMany({
      where: {
        role: 'admin'
      }
    });

    if (adminUsers.length > 0) {
      console.log(`\n🔐 Found ${adminUsers.length} admin users:\n`);
      adminUsers.forEach((admin, index) => {
        console.log(`👨‍💼 Admin ${index + 1}:`);
        console.log(`   Name: ${admin.name || 'Not set'}`);
        console.log(`   Email: ${admin.email || 'Not set'}`);
        console.log(`   Phone: ${admin.phone}`);
        console.log(`   Password: ${admin.password}`);
        console.log(`   Status: ${admin.isActive ? 'Active' : 'Inactive'}`);
        console.log(`   User ID: ${admin.id}`);
        console.log('---');
      });
    }

  } catch (error) {
    console.error('❌ Error fetching vendor credentials:', error);
  } finally {
    await prisma.$disconnect();
  }
}

getVendorCredentials();
