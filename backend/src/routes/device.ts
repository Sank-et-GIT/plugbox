import { Router } from "express";
import { PrismaClient } from "@prisma/client";

const router = Router();
const prisma = new PrismaClient();

// POST /device/heartbeat
router.post("/heartbeat", async (req, res) => {
  try {
    const { chargerId, status } = req.body as {
      chargerId?: number;
      status?: string;
    };

    if (chargerId === undefined || chargerId === null) {
      return res.status(400).json({ error: "chargerId is required" });
    }
    if (typeof chargerId !== "number" || Number.isNaN(chargerId)) {
      return res.status(400).json({ error: "chargerId must be a number" });
    }
    if (status !== undefined && typeof status !== "string") {
      return res.status(400).json({ error: "status must be a string" });
    }

    const updated = await prisma.charger.update({
      where: { id: chargerId },
      data: {
        ...(status ? { status } : {}),
        lastSeen: new Date(),
      },
      select: { id: true, status: true, lastSeen: true },
    });

    return res.json({ ok: true, charger: updated });
  } catch (err: any) {
    if (err?.code === "P2025") {
      return res.status(404).json({ error: "Charger not found" });
    }
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
