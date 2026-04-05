// Test admin chargers endpoint without authentication
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testAdminChargers() {
  try {
    console.log('🔍 Testing admin chargers endpoint...');
    
    // Get all chargers with vendor information
    const chargers = await prisma.charger.findMany({
      include: {
        vendor: {
          include: {
            user: true
          }
        },
        location: true,
        sessions: {
          where: {
            status: 'ENDED'
          },
          take: 5,
          orderBy: {
            createdAt: 'desc'
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`Found ${chargers.length} chargers`);

    // Transform data for frontend
    const transformedChargers = chargers.map(charger => ({
      id: charger.id,
      name: charger.name,
      deviceId: charger.deviceId,
      displayName: charger.displayName,
      status: charger.status,
      location: charger.location ? {
        address: charger.location.address,
        lat: charger.location.lat,
        lng: charger.location.lng
      } : null,
      coordinates: {
        lat: charger.lat,
        lng: charger.lng
      },
      vendor: charger.vendor ? {
        id: charger.vendor.id,
        name: charger.vendor.companyName,
        email: charger.vendor.email,
        phoneNumber: charger.vendor.phoneNumber,
        user: {
          name: charger.vendor.user?.name || 'Unknown',
          email: charger.vendor.user?.email || 'Unknown'
        }
      } : null,
      slotNumber: charger.slotNumber,
      lastSeen: charger.lastSeen,
      createdAt: charger.createdAt,
      recentSessions: charger.sessions.length
    }));

    // Calculate statistics
    const totalChargers = transformedChargers.length;
    const onlineChargers = transformedChargers.filter(c => c.status === 'ONLINE').length;
    const offlineChargers = transformedChargers.filter(c => c.status === 'OFFLINE').length;
    const maintenanceChargers = transformedChargers.filter(c => c.status === 'MAINTENANCE').length;
    const totalVendors = [...new Set(transformedChargers.map(c => c.vendor?.id).filter(Boolean))].length;

    const response = {
      success: true,
      chargers: transformedChargers,
      stats: {
        totalChargers,
        onlineChargers,
        offlineChargers,
        maintenanceChargers,
        totalVendors
      }
    };

    console.log('✅ Successfully returning charger data:', {
      chargerCount: response.chargers.length,
      stats: response.stats
    });

    // Display sample data
    console.log('\n📋 Sample Charger Data:');
    response.chargers.slice(0, 3).forEach((charger, index) => {
      console.log(`\nCharger ${index + 1}:`);
      console.log(`  Name: ${charger.name}`);
      console.log(`  Device ID: ${charger.deviceId}`);
      console.log(`  Status: ${charger.status}`);
      console.log(`  Vendor: ${charger.vendor?.name || 'Unknown'}`);
      console.log(`  Location: ${charger.location?.address || 'Not set'}`);
      console.log(`  Coordinates: ${charger.coordinates.lat}, ${charger.coordinates.lng}`);
      console.log(`  Last Seen: ${charger.lastSeen || 'Never'}`);
    });

    console.log('\n📊 Statistics:');
    console.log(`  Total Chargers: ${response.stats.totalChargers}`);
    console.log(`  Online: ${response.stats.onlineChargers}`);
    console.log(`  Offline: ${response.stats.offlineChargers}`);
    console.log(`  Maintenance: ${response.stats.maintenanceChargers}`);
    console.log(`  Total Vendors: ${response.stats.totalVendors}`);

    return response;
  } catch (err) {
    console.error('❌ Error:', err);
    return { success: false, error: err.message };
  } finally {
    await prisma.$disconnect();
  }
}

testAdminChargers();
