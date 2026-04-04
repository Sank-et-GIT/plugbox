const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const queryChargers = async () => {
  try {
    console.log('🔍 Querying Charger table data...\n');

    // Get all chargers
    const chargers = await prisma.charger.findMany({
      include: {
        location: true,
        vendor: {
          include: {
            user: true
          }
        }
      }
    });

    console.log(`📊 Found ${chargers.length} chargers:\n`);
    
    chargers.forEach((charger, index) => {
      console.log(`🔌 Charger ${index + 1}:`);
      console.log(`   ID: ${charger.id}`);
      console.log(`   Name: ${charger.name}`);
      console.log(`   Display Name: ${charger.displayName}`);
      console.log(`   Status: ${charger.status}`);
      console.log(`   Location: ${charger.lat}, ${charger.lng}`);
      console.log(`   Device ID: ${charger.deviceId || 'N/A'}`);
      console.log(`   Slot Number: ${charger.slotNumber}`);
      console.log(`   MQTT Topic: ${charger.mqttTopic || 'N/A'}`);
      console.log(`   Location: ${charger.location?.name || 'N/A'}`);
      console.log(`   Vendor: ${charger.vendor?.user?.name || 'N/A'} (${charger.vendor?.email || 'N/A'})`);
      console.log(`   Created: ${charger.createdAt}`);
      console.log(`   Last Seen: ${charger.lastSeen || 'Never'}`);
      console.log('---');
    });

    // Show table structure
    console.log('\n📋 Charger Table Structure:');
    console.log('Field | Type | Description');
    console.log('------|------|------------');
    console.log('id | Int | Primary Key (Auto-increment)');
    console.log('name | String | Charger name');
    console.log('lat | Float | Latitude coordinate');
    console.log('lng | Float | Longitude coordinate');
    console.log('status | String | Charger status (OFFLINE, AVAILABLE, IN_SESSION, etc.)');
    console.log('createdAt | DateTime | Creation timestamp');
    console.log('lastSeen | DateTime? | Last seen timestamp (optional)');
    console.log('deviceId | String? | Unique device identifier (optional)');
    console.log('displayName | String | Display name for UI');
    console.log('locationId | Int? | Foreign key to Location table (optional)');
    console.log('mqttTopic | String? | MQTT topic for communication (optional)');
    console.log('slotNumber | Int | Physical slot number');
    console.log('vendorId | String? | Foreign key to Vendor table (optional)');

  } catch (error) {
    console.error('❌ Error querying chargers:', error);
  } finally {
    await prisma.$disconnect();
  }
};

queryChargers();
