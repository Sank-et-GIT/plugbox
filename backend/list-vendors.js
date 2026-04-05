require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

// Set DATABASE_URL for SQLite
process.env.DATABASE_URL = "file:./dev.db";

const prisma = new PrismaClient();

async function listVendors() {
  try {
    console.log('Attempting to connect to database...');
    console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'Not set');
    
    const vendors = await prisma.vendor.findMany({
      include: {
        user: {
          select: {
            name: true,
            email: true,
            phone: true
          }
        },
        chargers: {
          select: {
            id: true,
            name: true,
            status: true
          }
        }
      }
    });

    console.log('\n=== VENDORS LIST ===');
    console.log(`Total vendors: ${vendors.length}`);
    console.log('');

    if (vendors.length === 0) {
      console.log('No vendors found in the database.');
      console.log('\nTo add sample vendors, check the dashboard/Backend directory for setup scripts.');
      return;
    }

    vendors.forEach((vendor, index) => {
      console.log(`${index + 1}. Vendor ID: ${vendor.id}`);
      console.log(`   Company Name: ${vendor.companyName || 'N/A'}`);
      console.log(`   Email: ${vendor.email}`);
      console.log(`   Phone: ${vendor.phoneNumber}`);
      console.log(`   KYC Status: ${vendor.kycStatus}`);
      console.log(`   Active: ${vendor.isActive ? 'Yes' : 'No'}`);
      console.log(`   Wallet Balance: ₹${vendor.walletBalance}`);
      console.log(`   Created: ${vendor.createdAt.toLocaleString()}`);
      console.log(`   Last Login: ${vendor.lastLogin ? vendor.lastLogin.toLocaleString() : 'Never'}`);
      
      if (vendor.user) {
        console.log(`   User Name: ${vendor.user.name || 'N/A'}`);
        console.log(`   User Email: ${vendor.user.email || 'N/A'}`);
        console.log(`   User Phone: ${vendor.user.phone}`);
      }
      
      console.log(`   Chargers: ${vendor.chargers.length} chargers`);
      if (vendor.chargers.length > 0) {
        vendor.chargers.forEach(charger => {
          console.log(`     - ${charger.name} (${charger.status})`);
        });
      }
      console.log('');
    });

  } catch (error) {
    console.error('Error fetching vendors:', error.message);
    console.error('\nTroubleshooting:');
    console.error('1. Make sure your DATABASE_URL is set in .env file');
    console.error('2. For PostgreSQL: postgresql://username:password@localhost:5432/plugbox');
    console.error('3. For SQLite: file:./dev.db');
    console.error('4. Run "npx prisma db push" to create tables');
  } finally {
    await prisma.$disconnect();
  }
}

listVendors();
