require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

// Set DATABASE_URL for SQLite
process.env.DATABASE_URL = "file:./dev.db";

const prisma = new PrismaClient();

async function createAdminUser() {
  try {
    console.log('Creating admin user in SQLite database...');

    // Create admin user
    const adminUser = await prisma.user.create({
      data: {
        name: 'PlugBox Administrator',
        email: 'admin@plugbox.com',
        phone: '9999999999',
        firebaseUid: 'admin-uid-' + Date.now(),
        role: 'admin',
        isActive: true
      }
    });

    console.log('✅ Admin user created successfully');
    console.log('📧 Email: admin@plugbox.com');
    console.log('🔑 Password: password123 (if using local auth)');
    console.log('👤 Role: admin');
    console.log('🆔 User ID:', adminUser.id);
    console.log('📱 Phone:', adminUser.phone);
    console.log('🔥 Firebase UID:', adminUser.firebaseUid);

  } catch (error) {
    if (error.code === 'P2002') {
      console.log('❌ Admin user already exists (duplicate email)');
    } else {
      console.error('❌ Error creating admin:', error.message);
    }
  } finally {
    await prisma.$disconnect();
  }
}

createAdminUser();
