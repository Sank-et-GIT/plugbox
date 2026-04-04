const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const fixAdminAccess = async () => {
  try {
    console.log('🔧 Fixing admin access and charger visibility...\n');

    // Find admin user
    const adminUser = await prisma.user.findUnique({
      where: { email: 'admin@plugbox.com' }
    });

    if (!adminUser) {
      console.log('❌ Admin user not found');
      return;
    }

    // Create admin vendor record for proper foreign key relationship
    let adminVendor = await prisma.vendor.findUnique({
      where: { userId: adminUser.id }
    });

    if (!adminVendor) {
      const hashedPassword = await bcrypt.hash('password123', 10);
      adminVendor = await prisma.vendor.create({
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
      console.log('✅ Created admin vendor record');
    }

    // Update existing chargers to be accessible by admin
    const existingChargers = await prisma.charger.findMany();
    console.log(`\n📊 Updating ${existingChargers.length} chargers for admin access...`);

    for (const charger of existingChargers) {
      if (!charger.vendorId) {
        await prisma.charger.update({
          where: { id: charger.id },
          data: { vendorId: adminVendor.id }
        });
        console.log(`   ✅ Assigned ${charger.name} to admin`);
      }
    }

    // Create admin-specific chargers
    console.log('\n🔌 Creating admin-specific chargers...');
    
    const adminChargers = [
      {
        name: 'Admin-Charger-01',
        displayName: 'Admin Charger #1',
        status: 'AVAILABLE',
        lat: 18.5204,
        lng: 73.8567,
        deviceId: 'ADMIN-001',
        mqttTopic: 'charger/admin-001',
        slotNumber: 1,
        vendorId: adminVendor.id
      },
      {
        name: 'Admin-Charger-02',
        displayName: 'Admin Charger #2',
        status: 'OFFLINE',
        lat: 19.0760,
        lng: 72.8777,
        deviceId: 'ADMIN-002',
        mqttTopic: 'charger/admin-002',
        slotNumber: 1,
        vendorId: adminVendor.id
      }
    ];

    for (const chargerData of adminChargers) {
      await prisma.charger.create({
        data: chargerData
      });
      console.log(`   ✅ Created ${chargerData.name}`);
    }

    console.log('\n🎯 Final Admin Setup:');
    console.log('   Admin User ID:', adminUser.id);
    console.log('   Admin Vendor ID:', adminVendor.id);
    console.log('   Total Chargers:', existingChargers.length + adminChargers.length);
    console.log('   Access Level: FULL ADMIN');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
};

fixAdminAccess();
