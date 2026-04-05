require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

// Set DATABASE_URL for SQLite
process.env.DATABASE_URL = "file:./dev.db";

const prisma = new PrismaClient();

async function findAdmin() {
  try {
    console.log('Searching for admin user: admin@plugbox.com');
    
    // Search for admin user by email
    const adminUser = await prisma.user.findUnique({
      where: { email: 'admin@plugbox.com' },
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

    if (adminUser) {
      console.log('\n✅ Found Admin User:');
      console.log(`   User ID: ${adminUser.id}`);
      console.log(`   Name: ${adminUser.name || 'N/A'}`);
      console.log(`   Email: ${adminUser.email}`);
      console.log(`   Phone: ${adminUser.phone}`);
      console.log(`   Firebase UID: ${adminUser.firebaseUid}`);
      console.log(`   Role: ${adminUser.role}`);
      console.log(`   Active: ${adminUser.isActive ? 'Yes' : 'No'}`);
      console.log(`   Created: ${adminUser.createdAt.toLocaleString()}`);
      console.log(`   Last Login: ${adminUser.lastLogin ? adminUser.lastLogin.toLocaleString() : 'Never'}`);
      
      if (adminUser.vendor) {
        console.log(`   Vendor Info:`);
        console.log(`     - Vendor ID: ${adminUser.vendor.id}`);
        console.log(`     - Company: ${adminUser.vendor.companyName}`);
        console.log(`     - Vendor Email: ${adminUser.vendor.email}`);
      }
      
    } else {
      console.log('\n❌ Admin user not found in users table');
      
      // Let's also check all users to see what roles exist
      console.log('\nChecking all users in the database...');
      const allUsers = await prisma.user.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true
        }
      });
      
      console.log(`\nTotal users found: ${allUsers.length}`);
      allUsers.forEach((user, index) => {
        console.log(`${index + 1}. ${user.name || 'N/A'} (${user.email}) - Role: ${user.role} - Active: ${user.isActive ? 'Yes' : 'No'}`);
      });
    }

  } catch (error) {
    console.error('Error searching for admin:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

findAdmin();
