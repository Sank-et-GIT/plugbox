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
