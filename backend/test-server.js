require('dotenv').config();
// Set DATABASE_URL if not in env
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "file:" + __dirname + "/prisma/dev.db";
}

const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Request logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    console.log(`[HTTP] ${req.method} ${req.originalUrl} → ${res.statusCode} (${ms}ms)`);
  });
  next();
});

// Health check
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// GET /admin/vendor-users - Get users with vendor role from users table
app.get('/admin/vendor-users', async (_req, res) => {
  try {
    console.log('🔍 Fetching vendor users from database...');
    
    const vendorUsers = await prisma.user.findMany({
      where: {
        role: 'vendor'
      },
      include: {
        vendor: {
          include: {
            chargers: {
              select: {
                id: true,
                status: true,
              },
            },
          },
        },
        wallet: {
          select: {
            balance: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    console.log(`Found ${vendorUsers.length} vendor users`);

    // Transform data to match frontend expectations
    const transformedVendors = vendorUsers.map(user => ({
      id: user.id,
      name: user.name,
      email: user.email,
      phoneNumber: user.phone,
      companyName: user.vendor?.companyName || '',
      isActive: user.isActive,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin,
      chargerCount: user.vendor?.chargers?.length || 0,
      activeChargers: user.vendor?.chargers?.filter(c => c.status === 'ONLINE').length || 0,
      walletBalance: user.wallet?.balance || 0,
      kycStatus: user.vendor?.kycStatus || 'PENDING',
      vendorId: user.vendor?.id,
    }));

    // Calculate stats
    const totalVendors = transformedVendors.length;
    const activeVendors = transformedVendors.filter(v => v.isActive).length;
    const totalChargers = transformedVendors.reduce((sum, v) => sum + v.chargerCount, 0);

    const response = {
      vendors: transformedVendors,
      stats: {
        totalVendors,
        activeVendors,
        totalChargers,
      },
    };

    console.log('✅ Successfully returning vendor data:', {
      vendorCount: response.vendors.length,
      stats: response.stats
    });

    return res.json(response);
  } catch (err) {
    console.error('❌ Error fetching vendor users:', err);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Test server running on http://localhost:${PORT}`);
  console.log(`📊 Vendor endpoint available at: http://localhost:${PORT}/admin/vendor-users`);
  console.log(`💚 Health check at: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});
