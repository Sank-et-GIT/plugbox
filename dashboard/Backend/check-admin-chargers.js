const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const checkAdminChargers = async () => {
  try {
    console.log('🔍 Checking admin charger access...\n');

    // Get admin user and vendor
    const adminUser = await prisma.user.findUnique({
      where: { email: 'admin@plugbox.com' },
      include: { vendor: true }
    });

    console.log('👑 Admin User:');
    console.log('   User ID:', adminUser.id);
    console.log('   Vendor ID:', adminUser.vendor?.id);

    // Get all chargers
    const allChargers = await prisma.charger.findMany({
      include: {
        vendor: {
          include: { user: true }
        }
      }
    });

    console.log(`\n📊 All Chargers (${allChargers.length}):`);
    allChargers.forEach(charger => {
      console.log(`   ${charger.name} - Vendor: ${charger.vendor?.user?.name} (${charger.vendorId})`);
    });

    // Test admin service call
    console.log('\n🧪 Testing admin service call...');
    const { ChargerService } = require('./services/chargerService');
    const chargerService = new ChargerService();
    
    const result = await chargerService.getAllChargers();
    console.log('Service result success:', result.success);
    console.log('Service chargers count:', result.chargers?.length || 0);
    
    if (result.chargers && result.chargers.length > 0) {
      console.log('First charger:', result.chargers[0]);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
};

checkAdminChargers();
