require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

// Set DATABASE_URL for SQLite
process.env.DATABASE_URL = "file:./dev.db";

const prisma = new PrismaClient();

async function searchAdminComprehensive() {
  try {
    console.log('Comprehensive search for admin users...');
    
    // Search 1: Exact email match
    const adminByEmail = await prisma.user.findUnique({
      where: { email: 'admin@plugbox.com' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true
      }
    });
    
    console.log('\n1. Search by exact email (admin@plugbox.com):');
    if (adminByEmail) {
      console.log('✅ Found:', adminByEmail);
    } else {
      console.log('❌ Not found');
    }
    
    // Search 2: All admin role users
    const adminByRole = await prisma.user.findMany({
      where: { role: 'admin' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true
      }
    });
    
    console.log('\n2. Search by role (admin):');
    console.log(`Found ${adminByRole.length} admin users:`);
    adminByRole.forEach((admin, index) => {
      console.log(`${index + 1}.`, admin);
    });
    
    // Search 3: All users with 'admin' in email
    const adminInEmail = await prisma.user.findMany({
      where: {
        email: {
          contains: 'admin'
        }
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true
      }
    });
    
    console.log('\n3. Search for "admin" in email:');
    console.log(`Found ${adminInEmail.length} users with "admin" in email:`);
    adminInEmail.forEach((user, index) => {
      console.log(`${index + 1}.`, user);
    });
    
    // Search 4: All users summary
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true
      }
    });
    
    console.log('\n4. All users in database:');
    console.log(`Total: ${allUsers.length} users`);
    allUsers.forEach((user, index) => {
      console.log(`${index + 1}. ${user.name} (${user.email}) - Role: ${user.role}`);
    });

  } catch (error) {
    console.error('Error searching for admin:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

searchAdminComprehensive();
