require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

// Set DATABASE_URL for SQLite
process.env.DATABASE_URL = "file:./dev.db";

const prisma = new PrismaClient();

async function listUsers() {
  try {
    console.log('Attempting to connect to database...');
    console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'Not set');
    
    const users = await prisma.user.findMany({
      include: {
        vendor: {
          select: {
            id: true,
            companyName: true,
            email: true,
            kycStatus: true,
            isActive: true,
            walletBalance: true
          }
        },
        wallet: {
          select: {
            id: true,
            balance: true,
            deposit: true
          }
        }
      }
    });

    console.log('\n=== USERS LIST ===');
    console.log(`Total users: ${users.length}`);
    console.log('');

    if (users.length === 0) {
      console.log('No users found in the database.');
      return;
    }

    users.forEach((user, index) => {
      console.log(`${index + 1}. User ID: ${user.id}`);
      console.log(`   Name: ${user.name || 'N/A'}`);
      console.log(`   Email: ${user.email || 'N/A'}`);
      console.log(`   Phone: ${user.phone}`);
      console.log(`   Firebase UID: ${user.firebaseUid}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Active: ${user.isActive ? 'Yes' : 'No'}`);
      console.log(`   Created: ${user.createdAt.toLocaleString()}`);
      console.log(`   Updated: ${user.updatedAt.toLocaleString()}`);
      console.log(`   Last Login: ${user.lastLogin ? user.lastLogin.toLocaleString() : 'Never'}`);
      
      if (user.vendor) {
        console.log(`   Vendor Info:`);
        console.log(`     - Vendor ID: ${user.vendor.id}`);
        console.log(`     - Company: ${user.vendor.companyName}`);
        console.log(`     - Vendor Email: ${user.vendor.email}`);
        console.log(`     - KYC Status: ${user.vendor.kycStatus}`);
        console.log(`     - Vendor Active: ${user.vendor.isActive ? 'Yes' : 'No'}`);
        console.log(`     - Wallet Balance: ₹${user.vendor.walletBalance}`);
      }
      
      if (user.wallet) {
        console.log(`   Wallet Info:`);
        console.log(`     - Wallet ID: ${user.wallet.id}`);
        console.log(`     - Balance: ₹${user.wallet.balance}`);
        console.log(`     - Deposit: ₹${user.wallet.deposit}`);
      }
      
      console.log('');
    });

  } catch (error) {
    console.error('Error fetching users:', error.message);
    console.error('\nTroubleshooting:');
    console.error('1. Make sure your DATABASE_URL is set correctly');
    console.error('2. Run "npx prisma db push" to create tables');
  } finally {
    await prisma.$disconnect();
  }
}

listUsers();
