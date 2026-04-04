const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function addSampleChargers() {
  try {
    // First, let's check if we have locations
    const locations = await prisma.location.findMany();
    console.log('Found locations:', locations.length);

    // If no locations, create some sample locations
    if (locations.length === 0) {
      console.log('Creating sample locations...');
      await prisma.location.createMany({
        data: [
          {
            name: 'Pune IT Park',
            address: 'Hinjewadi Phase 2, Pune',
            lat: 18.6077,
            lng: 73.7497
          },
          {
            name: 'Mumbai Central Mall',
            address: 'Senapati Bapat Marg, Lower Parel, Mumbai',
            lat: 19.017,
            lng: 72.8456
          },
          {
            name: 'Bangalore Electronic City',
            address: 'EPIP Zone, Electronic City, Bangalore',
            lat: 12.8399,
            lng: 77.677
          }
        ]
      });
    }

    // Get locations again
    const updatedLocations = await prisma.location.findMany();
    console.log('Locations after creation:', updatedLocations.length);

    // Now create sample chargers
    const chargers = await prisma.charger.findMany();
    console.log('Current chargers:', chargers.length);

    if (chargers.length === 0) {
      console.log('Creating sample chargers...');
      await prisma.charger.createMany({
        data: [
          {
            name: 'Pune-IT-01',
            displayName: 'PlugBox #1',
            status: 'OFFLINE',
            lat: 18.6077,
            lng: 73.7497,
            locationId: updatedLocations[0].id,
            deviceId: 'PB-PUN-001',
            mqttTopic: 'charger/pun-001'
          },
          {
            name: 'Mumbai-Central-01',
            displayName: 'PlugBox #2',
            status: 'AVAILABLE',
            lat: 19.017,
            lng: 72.8456,
            locationId: updatedLocations[1].id,
            deviceId: 'PB-MUM-001',
            mqttTopic: 'charger/mum-001'
          },
          {
            name: 'Bangalore-EC-01',
            displayName: 'PlugBox #3',
            status: 'IN_SESSION',
            lat: 12.8399,
            lng: 77.677,
            locationId: updatedLocations[2].id,
            deviceId: 'PB-BLR-001',
            mqttTopic: 'charger/blr-001'
          },
          {
            name: 'Pune-IT-02',
            displayName: 'PlugBox #4',
            status: 'OFFLINE',
            lat: 18.6078,
            lng: 73.7498,
            locationId: updatedLocations[0].id,
            deviceId: 'PB-PUN-002',
            mqttTopic: 'charger/pun-002'
          },
          {
            name: 'Mumbai-Central-02',
            displayName: 'PlugBox #5',
            status: 'RESERVED',
            lat: 19.0171,
            lng: 72.8457,
            locationId: updatedLocations[1].id,
            deviceId: 'PB-MUM-002',
            mqttTopic: 'charger/mum-002'
          }
        ]
      });
    }

    // Check final result
    const finalChargers = await prisma.charger.findMany({
      include: { location: true }
    });
    
    console.log('✅ Sample chargers created:', finalChargers.length);
    finalChargers.forEach(charger => {
      console.log(`- ${charger.name} (${charger.status}) at ${charger.location?.name}`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addSampleChargers();
