const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const fixAdminRole = async () => {
  try {
    console.log('🔧 Fixing admin role and access...\n');

    // Find admin user
    const adminUser = await prisma.user.findUnique({
      where: { email: 'admin@plugbox.com' }
    });

    if (!adminUser) {
      console.log('❌ Admin user not found');
      return;
    }

    // Remove vendor record from admin (if exists)
    const adminVendor = await prisma.vendor.findUnique({
      where: { userId: adminUser.id }
    });

    if (adminVendor) {
      await prisma.vendor.delete({
        where: { userId: adminUser.id }
      });
      console.log('✅ Removed vendor record from admin user');
    }

    // Ensure admin role is correct
    await prisma.user.update({
      where: { id: adminUser.id },
      data: { role: 'admin' }
    });

    console.log('✅ Admin role confirmed');
    console.log('\n👑 Admin Details:');
    console.log('   Name:', adminUser.name);
    console.log('   Email:', adminUser.email);
    console.log('   Role:', adminUser.role);
    console.log('   Vendor Record: NONE (Correct for admin)');

    // Create some admin-owned chargers for testing
    console.log('\n🔌 Creating admin-owned chargers...');
    
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
        vendorId: adminUser.id // Use admin user ID as vendorId for admin chargers
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
        vendorId: adminUser.id
      }
    ];

    for (const chargerData of adminChargers) {
      await prisma.charger.create({
        data: chargerData
      });
      console.log(`   ✅ Created ${chargerData.name}`);
    }

    console.log('\n🎯 Admin now has full access and dedicated chargers');

  } catch (error) {
    console.error('❌ Error fixing admin role:', error);
  } finally {
    await prisma.$disconnect();
  }
};

fixAdminRole();
