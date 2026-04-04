const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const createTestUser = async () => {
  try {
    console.log('Creating test user and vendor...');

    // Create test user
    const hashedPassword = await bcrypt.hash('password123', 10);
    
    const user = await prisma.user.create({
      data: {
        phone: '9876543210',
        name: 'Test Vendor User',
        email: 'testvendor@plugbox.com',
        firebaseUid: 'test-uid-' + Date.now(),
        role: 'vendor',
        isActive: true
      }
    });

    console.log('✅ Test user created:', user);

    // Create test vendor
    const vendor = await prisma.vendor.create({
      data: {
        userId: user.id,
        companyName: 'Test EV Charging Company',
        email: 'testvendor@plugbox.com',
        phoneNumber: '9876543210',
        password: hashedPassword,
        isActive: true,
        kycStatus: 'APPROVED'
      }
    });

    console.log('✅ Test vendor created:', vendor);
    console.log('\n📋 Login Credentials:');
    console.log('Email: testvendor@plugbox.com');
    console.log('Password: password123');

  } catch (error) {
    console.error('❌ Error creating test user:', error);
  } finally {
    await prisma.$disconnect();
  }
};

createTestUser();
