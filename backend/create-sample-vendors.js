require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

// Set DATABASE_URL for SQLite
process.env.DATABASE_URL = "file:./dev.db";

const prisma = new PrismaClient();

async function createSampleVendors() {
  try {
    console.log('Creating sample vendors...');

    // Sample data
    const vendorsData = [
      {
        name: 'Test Vendor 1',
        email: 'vendor1@plugbox.com',
        phone: '9876543210',
        firebaseUid: 'firebase-uid-1',
        companyName: 'EV Charge Solutions',
        vendorEmail: 'vendor1@plugbox.com',
        phoneNumber: '9876543210',
        password: 'password123',
        isActive: true,
        kycStatus: 'VERIFIED',
        walletBalance: 5000.00
      },
      {
        name: 'Test Vendor 2',
        email: 'vendor2@plugbox.com',
        phone: '9876543211',
        firebaseUid: 'firebase-uid-2',
        companyName: 'Green Energy Stations',
        vendorEmail: 'vendor2@plugbox.com',
        phoneNumber: '9876543211',
        password: 'password123',
        isActive: true,
        kycStatus: 'PENDING',
        walletBalance: 2500.50
      },
      {
        name: 'Test Vendor 3',
        email: 'vendor3@plugbox.com',
        phone: '9876543212',
        firebaseUid: 'firebase-uid-3',
        companyName: 'Power Grid Chargers',
        vendorEmail: 'vendor3@plugbox.com',
        phoneNumber: '9876543212',
        password: 'password123',
        isActive: false,
        kycStatus: 'REJECTED',
        walletBalance: 1000.00
      }
    ];

    for (const data of vendorsData) {
      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: data.email }
      });

      if (existingUser) {
        console.log(`⚠️ User ${data.email} already exists`);
        continue;
      }

      // Create user first
      const user = await prisma.user.create({
        data: {
          name: data.name,
          email: data.email,
          phone: data.phone,
          firebaseUid: data.firebaseUid,
          role: 'vendor'
        }
      });

      console.log(`✅ Created user: ${user.name} (${user.email})`);

      // Create vendor linked to user
      const vendor = await prisma.vendor.create({
        data: {
          userId: user.id,
          companyName: data.companyName,
          email: data.vendorEmail,
          phoneNumber: data.phoneNumber,
          password: data.password,
          isActive: data.isActive,
          kycStatus: data.kycStatus,
          walletBalance: data.walletBalance
        }
      });

      console.log(`✅ Created vendor: ${vendor.companyName} (${vendor.email})`);
      console.log(`   KYC Status: ${vendor.kycStatus}`);
      console.log(`   Wallet Balance: ₹${vendor.walletBalance}`);
      console.log('');
    }

    console.log('🎉 Sample vendors created successfully!');

  } catch (error) {
    console.error('❌ Error creating vendors:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createSampleVendors();
