require('dotenv').config();
// Set DATABASE_URL if not in env
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "file:" + __dirname + "/prisma/dev.db";
}
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createWorkingVendorCredentials() {
  try {
    console.log('🔧 Creating working vendor credentials...');
    
    // Define test vendors with passwords
    const testVendors = [
      {
        name: 'Test Vendor 1',
        email: 'vendor1@plugbox.com',
        phone: '9876543210',
        password: 'vendor123',
        companyName: 'EV Charge Solutions',
        kycStatus: 'VERIFIED'
      },
      {
        name: 'Test Vendor 2', 
        email: 'vendor2@plugbox.com',
        phone: '9876543211',
        password: 'vendor123',
        companyName: 'Green Energy Stations',
        kycStatus: 'PENDING'
      },
      {
        name: 'Test Vendor 3',
        email: 'vendor3@plugbox.com', 
        phone: '9876543212',
        password: 'vendor123',
        companyName: 'Power Grid Chargers',
        kycStatus: 'REJECTED'
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
            password: vendorData.password, // Store plain for now
            firebaseUid: `vendor_${vendorData.phone}_${Date.now()}`,
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
            walletBalance: 1000, // Give some balance
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
            balance: 1000,
            deposit: 0,
          }
        });
        console.log(`✅ Created wallet: ₹${wallet.balance}`);
      }
      
      console.log(`   📧 Email: ${vendorData.email}`);
      console.log(`   🔑 Password: ${vendorData.password}`);
      console.log(`   🏢 Company: ${vendorData.companyName}`);
    }
    
    console.log('\n🎉 Working vendor credentials created!');
    console.log('\n📋 Use these credentials to login:');
    console.log('Email: vendor1@plugbox.com | Password: vendor123');
    console.log('Email: vendor2@plugbox.com | Password: vendor123');
    console.log('Email: vendor3@plugbox.com | Password: vendor123');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createWorkingVendorCredentials();
