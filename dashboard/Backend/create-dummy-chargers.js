require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createDummyChargers() {
  try {
    console.log('🔧 Creating dummy charger data for vendors...');
    
    // Get all vendors
    const vendors = await prisma.user.findMany({
      where: { role: 'vendor' },
      include: { vendor: true }
    });
    
    console.log(`Found ${vendors.length} vendors`);
    
    // Sample charger data
    const chargerTemplates = [
      {
        name: 'Main Street EV Charger',
        status: 'ONLINE',
        lat: 19.0760,
        lng: 72.8777,
        deviceId: 'EV-CHR-001',
        displayName: 'PlugBox #1',
        slotNumber: 1
      },
      {
        name: 'Highway Charging Station',
        status: 'ONLINE',
        lat: 18.5204,
        lng: 73.8567,
        deviceId: 'EV-CHR-002',
        displayName: 'PlugBox #2',
        slotNumber: 1
      },
      {
        name: 'Mall Parking Charger',
        status: 'OFFLINE',
        lat: 19.0130,
        lng: 72.8350,
        deviceId: 'EV-CHR-003',
        displayName: 'PlugBox #3',
        slotNumber: 1
      },
      {
        name: 'Airport EV Station',
        status: 'ONLINE',
        lat: 19.0896,
        lng: 72.8656,
        deviceId: 'EV-CHR-004',
        displayName: 'PlugBox #4',
        slotNumber: 1
      },
      {
        name: 'Tech Park Charger',
        status: 'MAINTENANCE',
        lat: 18.6400,
        lng: 73.7850,
        deviceId: 'EV-CHR-005',
        displayName: 'PlugBox #5',
        slotNumber: 1
      }
    ];
    
    let totalChargersCreated = 0;
    
    // Create chargers for each vendor
    for (const vendor of vendors) {
      if (!vendor.vendor) {
        console.log(`⚠️ Skipping ${vendor.email} - no vendor record`);
        continue;
      }
      
      console.log(`\n📋 Creating chargers for: ${vendor.vendor.companyName} (${vendor.email})`);
      
      // Create 2-3 chargers per vendor
      const numChargers = Math.min(3, chargerTemplates.length);
      
      for (let i = 0; i < numChargers; i++) {
        const template = chargerTemplates[i];
        
        // Check if charger already exists
        const existingCharger = await prisma.charger.findFirst({
          where: {
            deviceId: `${template.deviceId}-${vendor.vendor.id.slice(-4)}`
          }
        });
        
        if (existingCharger) {
          console.log(`   ⏭️ Charger already exists: ${existingCharger.name}`);
          continue;
        }
        
        // Create unique charger for this vendor
        const charger = await prisma.charger.create({
          data: {
            vendorId: vendor.vendor.id,
            name: `${template.name} - ${vendor.vendor.companyName}`,
            status: template.status,
            lat: template.lat + (Math.random() * 0.01 - 0.005), // Slight variation
            lng: template.lng + (Math.random() * 0.01 - 0.005), // Slight variation
            deviceId: `${template.deviceId}-${vendor.vendor.id.slice(-4)}`,
            displayName: `${template.displayName} - ${vendor.vendor.companyName}`,
            slotNumber: template.slotNumber,
            lastSeen: new Date(Date.now() - Math.random() * 10 * 60 * 1000), // Within last 10 minutes
          }
        });
        
        console.log(`   ✅ Created: ${charger.name} (${charger.deviceId}) - ${charger.status}`);
        totalChargersCreated++;
      }
    }
    
    console.log(`\n🎉 Successfully created ${totalChargersCreated} chargers!`);
    
    // Display summary
    const finalChargerCount = await prisma.charger.count();
    const onlineChargers = await prisma.charger.count({ where: { status: 'ONLINE' } });
    const offlineChargers = await prisma.charger.count({ where: { status: 'OFFLINE' } });
    const maintenanceChargers = await prisma.charger.count({ where: { status: 'MAINTENANCE' } });
    
    console.log('\n📊 Final Summary:');
    console.log(`   Total Chargers: ${finalChargerCount}`);
    console.log(`   Online: ${onlineChargers}`);
    console.log(`   Offline: ${offlineChargers}`);
    console.log(`   Maintenance: ${maintenanceChargers}`);
    
  } catch (error) {
    console.error('❌ Error creating dummy chargers:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createDummyChargers();
