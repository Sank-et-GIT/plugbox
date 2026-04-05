const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkVendors() {
  try {
    const vendors = await prisma.vendor.findMany();
    console.log('Total vendors:', vendors.length);
    if (vendors.length > 0) {
      console.log('First vendor:', JSON.stringify(vendors[0], null, 2));
    } else {
      console.log('No vendors found in Prisma database');
    }
  } catch (error) {
    console.error('Error checking vendors:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkVendors();
