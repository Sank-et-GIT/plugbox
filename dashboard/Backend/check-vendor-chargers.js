const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const checkVendorChargers = async () => {
  try {
    console.log('🔍 Checking vendor-charger relationships...\n');

    // Get all vendors
    const vendors = await prisma.vendor.findMany({
      include: {
        user: true
      }
    });

    console.log(`📊 Found ${vendors.length} vendors:`);
    vendors.forEach(vendor => {
      console.log(`   - ${vendor.user.name} (${vendor.email}) - ID: ${vendor.id}`);
    });

    // Get all chargers
    const chargers = await prisma.charger.findMany({
      include: {
        vendor: {
          include: {
            user: true
          }
        }
      }
    });

    console.log(`\n📊 Found ${chargers.length} chargers:`);
    chargers.forEach(charger => {
      console.log(`   - ${charger.name} - Vendor: ${charger.vendor?.user?.name || 'NONE'} (${charger.vendorId || 'NULL'})`);
    });

    // Check chargers without vendor
    const chargersWithoutVendor = chargers.filter(c => !c.vendorId);
    console.log(`\n⚠️ Chargers without vendor: ${chargersWithoutVendor.length}`);

    if (chargersWithoutVendor.length > 0 && vendors.length > 0) {
      console.log('\n🔧 Assigning chargers to test vendor...');
      const testVendor = vendors.find(v => v.email === 'testvendor@plugbox.com');
      
      if (testVendor) {
        for (const charger of chargersWithoutVendor) {
          await prisma.charger.update({
            where: { id: charger.id },
            data: { vendorId: testVendor.id }
          });
          console.log(`   ✅ Assigned ${charger.name} to ${testVendor.user.name}`);
        }
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
};

checkVendorChargers();
