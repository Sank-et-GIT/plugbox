require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function debugVendorLogin() {
  try {
    console.log('🔍 Debugging vendor login process...');
    
    const testEmail = 'dashboard1@plugbox.com';
    const testPassword = 'vendor123';
    
    console.log(`\n📧 Testing login for: ${testEmail}`);
    console.log(`🔑 Password: ${testPassword}`);
    
    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: testEmail },
      include: {
        vendor: true
      }
    });
    
    console.log('\n👤 User found:', !!user);
    if (user) {
      console.log('   User ID:', user.id);
      console.log('   User Name:', user.name);
      console.log('   User Email:', user.email);
      console.log('   User Role:', user.role);
      console.log('   User Active:', user.isActive);
      console.log('   Vendor record:', !!user.vendor);
      
      if (user.vendor) {
        console.log('   Vendor ID:', user.vendor.id);
        console.log('   Vendor Email:', user.vendor.email);
        console.log('   Vendor Phone:', user.vendor.phoneNumber);
        console.log('   Vendor Password Hash:', user.vendor.password ? 'Present' : 'Missing');
        console.log('   Vendor Company:', user.vendor.companyName);
        console.log('   Vendor KYC:', user.vendor.kycStatus);
        
        // Test password comparison
        if (user.vendor.password) {
          console.log('\n🔐 Testing password comparison...');
          const passwordMatch = await bcrypt.compare(testPassword, user.vendor.password);
          console.log('   Password Match:', passwordMatch);
          
          // Test with different passwords
          const testPasswords = ['vendor123', 'password123', 'admin123', '123456'];
          console.log('\n🧪 Testing multiple passwords:');
          for (const pwd of testPasswords) {
            const match = await bcrypt.compare(pwd, user.vendor.password);
            console.log(`   "${pwd}": ${match ? '✅ MATCH' : '❌ NO MATCH'}`);
          }
        } else {
          console.log('❌ No password found in vendor record!');
        }
      }
    }
    
    // Also check all vendors in database
    console.log('\n📋 All vendors in database:');
    const allVendors = await prisma.user.findMany({
      where: { role: 'vendor' },
      include: { vendor: true }
    });
    
    allVendors.forEach((vendor, index) => {
      console.log(`\nVendor ${index + 1}:`);
      console.log(`   Email: ${vendor.email}`);
      console.log(`   Vendor Email: ${vendor.vendor?.email || 'No vendor record'}`);
      console.log(`   Has Password: ${vendor.vendor?.password ? 'Yes' : 'No'}`);
      console.log(`   Active: ${vendor.isActive}`);
    });
    
  } catch (error) {
    console.error('❌ Debug error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugVendorLogin();
