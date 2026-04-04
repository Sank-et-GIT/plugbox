const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const checkAdminAccess = async () => {
  try {
    console.log('🔍 Checking admin access and charger data...\n');

    // Check admin user details
    const adminUser = await prisma.user.findUnique({
      where: { email: 'admin@plugbox.com' },
      include: {
        vendor: true
      }
    });

    console.log('👑 Admin User Details:');
    console.log('   ID:', adminUser.id);
    console.log('   Name:', adminUser.name);
    console.log('   Email:', adminUser.email);
    console.log('   Role:', adminUser.role);
    console.log('   Vendor Record:', adminUser.vendor ? 'YES' : 'NO');

    // Check all chargers in database
    const allChargers = await prisma.charger.findMany({
      include: {
        location: true,
        vendor: {
          include: {
            user: true
          }
        }
      }
    });

    console.log(`\n📊 Total Chargers in Database: ${allChargers.length}`);
    allChargers.forEach((charger, index) => {
      console.log(`   ${index + 1}. ${charger.name} - Status: ${charger.status} - Vendor: ${charger.vendor?.user?.name || 'NONE'}`);
    });

    // Check vendor-specific chargers
    const vendorChargers = await prisma.charger.findMany({
      where: {
        vendorId: adminUser.vendor?.id
      }
    });

    console.log(`\n🏪 Vendor-specific Chargers (if admin treated as vendor): ${vendorChargers.length}`);

    // Check admin routes
    console.log('\n🛣️ Available Routes:');
    console.log('   /api/auth/login - General login');
    console.log('   /api/vendor/auth/login - Vendor login');
    console.log('   /api/chargers - All chargers (admin)');
    console.log('   /api/vendor/chargers - Vendor-specific chargers');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
};

checkAdminAccess();
