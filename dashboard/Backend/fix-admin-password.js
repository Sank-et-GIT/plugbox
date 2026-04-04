const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const fixAdminPassword = async () => {
  try {
    console.log('🔧 Fixing admin password...');

    // Find admin user
    const adminUser = await prisma.user.findUnique({
      where: { email: 'admin@plugbox.com' }
    });

    if (!adminUser) {
      console.log('❌ Admin user not found');
      return;
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash('password123', 10);
    
    // Create vendor record for admin with hashed password
    const existingVendor = await prisma.vendor.findUnique({
      where: { userId: adminUser.id }
    });

    if (!existingVendor) {
      await prisma.vendor.create({
        data: {
          userId: adminUser.id,
          email: adminUser.email,
          phoneNumber: adminUser.phone,
          password: hashedPassword,
          companyName: 'PlugBox Administration',
          kycStatus: 'APPROVED',
          isActive: true
        }
      });
      console.log('✅ Created vendor record for admin with hashed password');
    } else {
      await prisma.vendor.update({
        where: { userId: adminUser.id },
        data: { password: hashedPassword }
      });
      console.log('✅ Updated admin password with hash');
    }

    console.log('🔑 Admin credentials:');
    console.log('   Email: admin@plugbox.com');
    console.log('   Password: password123');
    console.log('   Status: Ready for database authentication');

  } catch (error) {
    console.error('❌ Error fixing admin password:', error);
  } finally {
    await prisma.$disconnect();
  }
};

fixAdminPassword();
