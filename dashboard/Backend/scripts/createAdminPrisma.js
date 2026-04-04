const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const createAdmin = async () => {
  try {
    console.log('Creating admin user...');

    // Check if admin already exists
    const existingAdmin = await prisma.user.findFirst({
      where: { 
        email: 'admin@plugbox.com',
        role: 'admin'
      }
    });
    
    if (existingAdmin) {
      console.log('⚠️ Admin user already exists');
      console.log('📧 Email:', existingAdmin.email);
      console.log('🔑 Password: password123');
      await prisma.$disconnect();
      return;
    }

    // Create admin user
    const hashedPassword = await bcrypt.hash('password123', 10);
    
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
    console.log('🔑 Password: password123');
    console.log('👤 Role: admin');
    console.log('🆔 User ID:', adminUser.id);

  } catch (error) {
    console.error('❌ Error creating admin:', error);
  } finally {
    await prisma.$disconnect();
  }
};

createAdmin();
