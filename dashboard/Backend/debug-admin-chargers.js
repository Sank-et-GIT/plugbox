const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const debugAdminChargers = async () => {
  try {
    console.log('🔍 Debugging admin chargers service...\n');

    // Test direct Prisma query
    const directQuery = await prisma.charger.findMany({
      include: {
        location: true,
        vendor: {
          include: { user: true }
        }
      }
    });

    console.log('📊 Direct Prisma Query Results:');
    console.log('   Total chargers found:', directQuery.length);
    directQuery.forEach((charger, index) => {
      console.log(`   ${index + 1}. ${charger.name} - Status: ${charger.status}`);
    });

    // Test service method
    console.log('\n🧪 Testing ChargerService...');
    try {
      const chargerService = require('./services/chargerService');
      
      const result = await chargerService.getAllChargers();
      console.log('Service success:', result.success);
      console.log('Service message:', result.message);
      console.log('Service chargers count:', result.chargers?.length || 0);
      
      if (result.chargers && result.chargers.length > 0) {
        console.log('First charger from service:', result.chargers[0]);
      }
    } catch (serviceError) {
      console.error('❌ Service error:', serviceError.message);
    }

  } catch (error) {
    console.error('❌ Debug error:', error);
  } finally {
    await prisma.$disconnect();
  }
};

debugAdminChargers();
