const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createTestUsers() {
  try {
    console.log('Creating test users...');

    // Create Admin User
    const adminUser = await prisma.user.upsert({
      where: { email: 'admin@plugbox.com' },
      update: {},
      create: {
        email: 'admin@plugbox.com',
        name: 'Admin User',
        phone: '+919999999999',
        password: 'admin123',
        role: 'admin',
        isActive: true,
        firebaseUid: 'admin_firebase_uid',
      },
    });

    console.log('✅ Admin user created:', adminUser.email);

    // Create Vendor User 1
    const vendorUser1 = await prisma.user.upsert({
      where: { email: 'dashboard1@plugbox.com' },
      update: {},
      create: {
        email: 'dashboard1@plugbox.com',
        name: 'Test Vendor 1',
        phone: '+918888888888',
        password: 'vendor123',
        role: 'vendor',
        isActive: true,
        firebaseUid: 'vendor1_firebase_uid',
      },
    });

    // Create Vendor record for Vendor 1
    const vendor1 = await prisma.vendor.upsert({
      where: { userId: vendorUser1.id },
      update: {},
      create: {
        userId: vendorUser1.id,
        email: 'dashboard1@plugbox.com',
        companyName: 'Test Charging Company',
        phoneNumber: '+918888888888',
        password: 'vendor123',
        isActive: true,
        status: 'ACTIVE',
        kycStatus: 'VERIFIED',
        walletBalance: 1000,
      },
    });

    // Create wallet for Vendor 1
    await prisma.wallet.upsert({
      where: { userId: vendorUser1.id },
      update: {},
      create: {
        userId: vendorUser1.id,
        balance: 1000,
        deposit: 0,
      },
    });

    console.log('✅ Vendor 1 created:', vendorUser1.email);

    // Create Vendor User 2
    const vendorUser2 = await prisma.user.upsert({
      where: { email: 'dashboard2@plugbox.com' },
      update: {},
      create: {
        email: 'dashboard2@plugbox.com',
        name: 'Test Vendor 2',
        phone: '+917777777777',
        password: 'vendor123',
        role: 'vendor',
        isActive: true,
        firebaseUid: 'vendor2_firebase_uid',
      },
    });

    // Create Vendor record for Vendor 2
    const vendor2 = await prisma.vendor.upsert({
      where: { userId: vendorUser2.id },
      update: {},
      create: {
        userId: vendorUser2.id,
        email: 'dashboard2@plugbox.com',
        companyName: 'Another Charging Company',
        phoneNumber: '+917777777777',
        password: 'vendor123',
        isActive: true,
        status: 'ACTIVE',
        kycStatus: 'PENDING',
        walletBalance: 500,
      },
    });

    // Create wallet for Vendor 2
    await prisma.wallet.upsert({
      where: { userId: vendorUser2.id },
      update: {},
      create: {
        userId: vendorUser2.id,
        balance: 500,
        deposit: 0,
      },
    });

    console.log('✅ Vendor 2 created:', vendorUser2.email);

    console.log('\n🎉 Test users created successfully!');
    console.log('\nLogin Credentials:');
    console.log('===================');
    console.log('Admin Login:');
    console.log('  Email: admin@plugbox.com');
    console.log('  Password: admin123');
    console.log('\nVendor Login:');
    console.log('  Email: dashboard1@plugbox.com');
    console.log('  Password: vendor123');
    console.log('\nVendor Login 2:');
    console.log('  Email: dashboard2@plugbox.com');
    console.log('  Password: vendor123');

  } catch (error) {
    console.error('Error creating test users:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestUsers();
