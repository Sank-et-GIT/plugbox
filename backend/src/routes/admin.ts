import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import vendorRoutes from "./vendors";

const router = Router();
const prisma = new PrismaClient();

// Use vendor routes
router.use("/", vendorRoutes);

// GET /admin/chargers
router.get("/chargers", async (_req, res) => {
  try {
    const chargers = await prisma.charger.findMany({
      orderBy: { id: "asc" },
    });

    return res.json({ chargers });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /admin/chargers/:id/status
router.patch("/chargers/:id/status", async (req, res) => {
  try {
    const idRaw = req.params.id;
    const id = Number(idRaw);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: "Invalid charger id" });
    }

    const { status } = req.body as { status?: string };

    // Keep strict allowed values (match your DB enum/string)
    const allowed = ["ONLINE", "OFFLINE"];
    if (!status || !allowed.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Use one of: ${allowed.join(", ")}` });
    }

    // Update charger
    const updated = await prisma.charger.update({
      where: { id },
      data: { status },
    });

    return res.json({ ok: true, charger: updated });
  } catch (err: any) {
    // Prisma "record not found"
    if (err?.code === "P2025") {
      return res.status(404).json({ error: "Charger not found" });
    }
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
