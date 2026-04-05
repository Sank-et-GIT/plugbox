import { Router } from "express";
import { PrismaClient } from "@prisma/client";

const router = Router();
const prisma = new PrismaClient();

// GET /admin/vendors - Get all vendors with stats
router.get("/vendors", async (_req, res) => {
  try {
    const vendors = await prisma.vendor.findMany({
      include: {
        user: {
          select: {
            name: true,
            email: true,
            phone: true,
          },
        },
        chargers: {
          select: {
            id: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Calculate stats for each vendor
    const vendorsWithStats = vendors.map(vendor => ({
      ...vendor,
      totalChargers: vendor.chargers.length,
      activeChargers: vendor.chargers.filter(c => c.status === "ONLINE").length,
    }));

    // Calculate overall stats
    const totalVendors = vendors.length;
    const activeVendors = vendors.filter(v => v.status === "ACTIVE").length;
    const totalChargers = vendors.reduce((sum, v) => sum + v.chargers.length, 0);

    return res.json({
      vendors: vendorsWithStats,
      stats: {
        totalVendors,
        activeVendors,
        totalChargers,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /admin/vendor-users - Get users with vendor role from users table
router.get("/vendor-users", async (_req, res) => {
  try {
    const vendorUsers = await prisma.user.findMany({
      where: {
        role: "vendor"
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
      orderBy: { createdAt: "desc" },
    });

    // Transform data to match frontend expectations
    const transformedVendors = vendorUsers.map(user => ({
      id: user.id,
      name: user.name,
      email: user.email,
      phoneNumber: user.phone,
      companyName: user.vendor?.companyName || "",
      isActive: user.isActive,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin,
      chargerCount: user.vendor?.chargers?.length || 0,
      activeChargers: user.vendor?.chargers?.filter(c => c.status === "ONLINE").length || 0,
      walletBalance: user.wallet?.balance || 0,
      kycStatus: user.vendor?.kycStatus || "PENDING",
      vendorId: user.vendor?.id,
    }));

    // Calculate stats
    const totalVendors = transformedVendors.length;
    const activeVendors = transformedVendors.filter(v => v.isActive).length;
    const totalChargers = transformedVendors.reduce((sum, v) => sum + v.chargerCount, 0);

    return res.json({
      vendors: transformedVendors,
      stats: {
        totalVendors,
        activeVendors,
        totalChargers,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /admin/vendor-users/:id/status - Update vendor user status
router.patch("/vendor-users/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body as { isActive?: boolean };

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

    return res.json({ ok: true, user: updatedUser });
  } catch (err: any) {
    if (err?.code === "P2025") {
      return res.status(404).json({ error: "Vendor user not found" });
    }
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
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
      companyName,
      firebaseUid 
    } = req.body as {
      name?: string;
      email?: string;
      phone?: string;
      password?: string;
      companyName?: string;
      firebaseUid?: string;
    };

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
          password,
          firebaseUid: firebaseUid || `vendor_${phone}_${Date.now()}`,
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
  } catch (err: any) {
    if (err?.code === "P2002") {
      return res.status(400).json({ 
        error: "User with this email or phone already exists" 
      });
    }
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
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
  } catch (err: any) {
    if (err?.code === "P2025") {
      return res.status(404).json({ error: "Vendor user not found" });
    }
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /admin/vendors/:id - Get single vendor details
router.get("/vendors/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const vendor = await prisma.vendor.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            name: true,
            email: true,
            phone: true,
          },
        },
        chargers: {
          include: {
            location: true,
            sessions: {
              select: {
                id: true,
                startTime: true,
                endTime: true,
                energyConsumed: true,
                totalAmount: true,
              },
            },
          },
        },
      },
    });

    if (!vendor) {
      return res.status(404).json({ error: "Vendor not found" });
    }

    // Calculate vendor stats
    const totalRevenue = vendor.chargers.reduce((sum, charger) => {
      return sum + charger.sessions.reduce((sessionSum, session) => {
        return sessionSum + (session.totalAmount || 0);
      }, 0);
    }, 0);

    const totalSessions = vendor.chargers.reduce((sum, charger) => 
      sum + charger.sessions.length, 0);

    const vendorWithStats = {
      ...vendor,
      stats: {
        totalRevenue,
        totalSessions,
        totalChargers: vendor.chargers.length,
        activeChargers: vendor.chargers.filter(c => c.status === "ONLINE").length,
      },
    };

    return res.json(vendorWithStats);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /admin/vendors/:id/status - Update vendor status
router.patch("/vendors/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body as { status?: string };

    const allowedStatuses = ["ACTIVE", "INACTIVE", "PENDING", "SUSPENDED"];
    if (!status || !allowedStatuses.includes(status)) {
      return res.status(400).json({ 
        error: `Invalid status. Use one of: ${allowedStatuses.join(", ")}` 
      });
    }

    const updatedVendor = await prisma.vendor.update({
      where: { id },
      data: { status },
    });

    return res.json({ ok: true, vendor: updatedVendor });
  } catch (err: any) {
    if (err?.code === "P2025") {
      return res.status(404).json({ error: "Vendor not found" });
    }
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /admin/vendors/stats - Get vendor statistics
router.get("/vendors/stats", async (_req, res) => {
  try {
    const [
      totalVendors,
      activeVendors,
      pendingVendors,
      suspendedVendors,
      totalChargers,
      activeChargers,
    ] = await Promise.all([
      prisma.vendor.count(),
      prisma.vendor.count({ where: { status: "ACTIVE" } }),
      prisma.vendor.count({ where: { status: "PENDING" } }),
      prisma.vendor.count({ where: { status: "SUSPENDED" } }),
      prisma.charger.count(),
      prisma.charger.count({ where: { status: "ONLINE" } }),
    ]);

    return res.json({
      totalVendors,
      activeVendors,
      pendingVendors,
      suspendedVendors,
      totalChargers,
      activeChargers,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
