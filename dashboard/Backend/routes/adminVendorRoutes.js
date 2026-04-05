const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

// GET /admin/vendor-users - Get users with vendor role from users table
router.get("/vendor-users", async (req, res) => {
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

// POST /admin/vendor-users - Create new vendor user
router.post("/vendor-users", async (req, res) => {
  try {
    const { 
      name, 
      email, 
      phone, 
      password, 
      companyName
    } = req.body;

    // Validate required fields
    if (!phone || !password) {
      return res.status(400).json({ 
        error: "Phone and password are required" 
      });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { phone }
    });

    if (existingUser) {
      return res.status(400).json({ 
        error: "User with this phone number already exists" 
      });
    }

    // Create user and vendor in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create user
      const user = await tx.user.create({
        data: {
          phone,
          name: name || "",
          email: email || null,
          firebaseUid: `vendor_${phone}_${Date.now()}`,
          role: "vendor",
          isActive: true,
        },
      });

      // Create vendor record
      const vendor = await tx.vendor.create({
        data: {
          userId: user.id,
          companyName: companyName || "",
          email: email || `${phone}@vendor.com`,
          phoneNumber: phone,
          password,
          isActive: true,
          kycStatus: "PENDING",
          walletBalance: 0,
        },
      });

      // Create wallet
      await tx.wallet.create({
        data: {
          userId: user.id,
          balance: 0,
          deposit: 0,
        },
      });

      return { user, vendor };
    });

    return res.json({ 
      success: true, 
      message: "Vendor user created successfully",
      user: result.user,
      vendor: result.vendor
    });
  } catch (err) {
    console.error('❌ Error creating vendor:', err);
    if (err.code === 'P2002') {
      return res.status(400).json({ 
        error: "User with this email or phone already exists" 
      });
    }
    return res.status(500).json({ error: "Internal server error", details: err.message });
  }
});

// PATCH /admin/vendor-users/:id/status - Update vendor user status
router.patch("/vendor-users/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ 
        error: "isActive field is required and must be a boolean" 
      });
    }

    const updatedUser = await prisma.user.update({
      where: { 
        id,
        role: "vendor" // Ensure we only update vendor users
      },
      data: { isActive },
    });

    return res.json({ success: true, user: updatedUser });
  } catch (err) {
    console.error('❌ Error updating vendor status:', err);
    if (err.code === 'P2025') {
      return res.status(404).json({ error: "Vendor user not found" });
    }
    return res.status(500).json({ error: "Internal server error", details: err.message });
  }
});

// DELETE /admin/vendor-users/:id - Delete vendor user
router.delete("/vendor-users/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Delete user and related records in a transaction
    await prisma.$transaction(async (tx) => {
      // Delete vendor record first (due to foreign key constraint)
      await tx.vendor.deleteMany({
        where: { userId: id }
      });

      // Delete wallet
      await tx.wallet.deleteMany({
        where: { userId: id }
      });

      // Delete user
      await tx.user.delete({
        where: { 
          id,
          role: "vendor" // Ensure we only delete vendor users
        }
      });
    });

    return res.json({ 
      success: true, 
      message: "Vendor user deleted successfully" 
    });
  } catch (err) {
    console.error('❌ Error deleting vendor:', err);
    if (err.code === 'P2025') {
      return res.status(404).json({ error: "Vendor user not found" });
    }
    return res.status(500).json({ error: "Internal server error", details: err.message });
  }
});

module.exports = router;
