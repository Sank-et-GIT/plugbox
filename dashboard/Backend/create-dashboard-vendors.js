require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createDashboardVendorCredentials() {
  try {
    console.log('🔧 Creating dashboard vendor credentials...');
    
    // Define test vendors with passwords
    const testVendors = [
      {
        name: 'Dashboard Vendor 1',
        email: 'dashboard1@plugbox.com',
        phone: '1111111111',
        password: 'vendor123',
        companyName: 'Dashboard EV Solutions',
        kycStatus: 'VERIFIED'
      },
      {
        name: 'Dashboard Vendor 2', 
        email: 'dashboard2@plugbox.com',
        phone: '2222222222',
        password: 'vendor123',
        companyName: 'Dashboard Charging Co',
        kycStatus: 'PENDING'
      }
    ];

    for (const vendorData of testVendors) {
      console.log(`\n🔄 Processing: ${vendorData.email}`);
      
      // Hash the password
      const hashedPassword = await bcrypt.hash(vendorData.password, 10);
      
      // Check if user exists
      let user = await prisma.user.findUnique({
        where: { email: vendorData.email }
      });
      
      if (!user) {
        // Create user
        user = await prisma.user.create({
          data: {
            phone: vendorData.phone,
            name: vendorData.name,
            email: vendorData.email,
            firebaseUid: `dashboard_${vendorData.phone}_${Date.now()}`,
            role: 'vendor',
            isActive: true,
          }
        });
        console.log(`✅ Created user: ${user.email}`);
      } else {
        console.log(`📋 User exists: ${user.email}`);
      }
      
      // Check if vendor record exists
      let vendor = await prisma.vendor.findFirst({
        where: { userId: user.id }
      });
      
      if (!vendor) {
        // Create vendor record
        vendor = await prisma.vendor.create({
          data: {
            userId: user.id,
            companyName: vendorData.companyName,
            email: vendorData.email, // Use same email as user
            phoneNumber: vendorData.phone,
            password: hashedPassword, // Store hashed password
            isActive: true,
            kycStatus: vendorData.kycStatus,
            walletBalance: 2000, // Give some balance
          }
        });
        console.log(`✅ Created vendor: ${vendor.companyName}`);
      } else {
        // Update existing vendor with correct password
        vendor = await prisma.vendor.update({
          where: { id: vendor.id },
          data: {
            password: hashedPassword,
            email: vendorData.email,
            phoneNumber: vendorData.phone,
          }
        });
        console.log(`🔄 Updated vendor: ${vendor.companyName}`);
      }
      
      // Create wallet if not exists
      let wallet = await prisma.wallet.findUnique({
        where: { userId: user.id }
      });
      
      if (!wallet) {
        wallet = await prisma.wallet.create({
          data: {
            userId: user.id,
            balance: 2000,
            deposit: 0,
          }
        });
        console.log(`✅ Created wallet: ₹${wallet.balance}`);
      }
      
      console.log(`   📧 Email: ${vendorData.email}`);
      console.log(`   🔑 Password: ${vendorData.password}`);
      console.log(`   🏢 Company: ${vendorData.companyName}`);
    }
    
    console.log('\n🎉 Dashboard vendor credentials created!');
    console.log('\n📋 Use these credentials to login:');
    console.log('Email: dashboard1@plugbox.com | Password: vendor123');
    console.log('Email: dashboard2@plugbox.com | Password: vendor123');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createDashboardVendorCredentials();
