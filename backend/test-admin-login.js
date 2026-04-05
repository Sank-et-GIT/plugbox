require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

// Set DATABASE_URL for SQLite
process.env.DATABASE_URL = "file:./dev.db";

const prisma = new PrismaClient();

async function testAdminLogin() {
  try {
    console.log('Testing admin login from database...');
    
    // Test 1: Check if admin user exists in database
    const adminUser = await prisma.user.findUnique({
      where: { email: 'admin@plugbox.com' },
      include: {
        vendor: true
      }
    });
    
    console.log('\n1. Admin User Lookup:');
    if (adminUser) {
      console.log('✅ Found admin in database:');
      console.log(`   ID: ${adminUser.id}`);
      console.log(`   Email: ${adminUser.email}`);
      console.log(`   Role: ${adminUser.role}`);
      console.log(`   Active: ${adminUser.isActive}`);
      console.log(`   Name: ${adminUser.name}`);
      console.log(`   Phone: ${adminUser.phone}`);
    } else {
      console.log('❌ Admin user NOT found in database');
    }
    
    // Test 2: Simulate login logic
    const email = 'admin@plugbox.com';
    const password = 'password123';
    
    console.log('\n2. Login Simulation:');
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);
    
    if (adminUser && adminUser.role === 'admin') {
      // This is the current logic from auth-prisma.js
      const passwordMatch = password === 'password123';
      console.log(`   Password Match: ${passwordMatch ? '✅ Yes' : '❌ No'}`);
      console.log('   Logic: Using hardcoded password check (password === "password123")');
    } else {
      console.log('❌ Cannot test login - admin user not found or wrong role');
    }
    
    // Test 3: Check if we can change admin password
    console.log('\n3. Password Flexibility Test:');
    console.log('   Current: Hardcoded check (password === "password123")');
    console.log('   Issue: Password cannot be changed from database');
    console.log('   Recommendation: Should use bcrypt.compare() like vendors');
    
    // Test 4: What if we try wrong password
    const wrongPassword = 'wrongpassword';
    const wrongMatch = adminUser && adminUser.role === 'admin' ? wrongPassword === 'password123' : false;
    console.log(`\n4. Wrong Password Test (${wrongPassword}): ${wrongMatch ? '✅ Would pass' : '❌ Would fail'}`);
    
    console.log('\n=== CONCLUSION ===');
    console.log('✅ Admin login IS dynamic from database (user lookup)');
    console.log('❌ Password check is HARDCODED (not from database)');
    console.log('🔧 Status: Semi-dynamic - user from DB, password hardcoded');

  } catch (error) {
    console.error('Error testing admin login:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testAdminLogin();
