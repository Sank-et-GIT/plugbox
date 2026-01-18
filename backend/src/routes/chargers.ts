import { Router } from "express";
import { PrismaClient } from "@prisma/client";

const router = Router();
const prisma = new PrismaClient();

// GET /chargers
router.get("/", async (_req, res) => {
  try {
    const chargers = await prisma.charger.findMany({
      orderBy: { id: "asc" },
      select: {
        id: true,
        name: true,
        lat: true,
        lng: true,
        status: true,
        lastSeen: true,
      },
    });

    const now = Date.now();

    const enriched = chargers.map((c) => {
      const lastSeenSecondsAgo =
        c.lastSeen ? Math.floor((now - new Date(c.lastSeen).getTime()) / 1000) : null;

      return {
        ...c,
        lastSeenSecondsAgo,
      };
    });

    return res.json({ chargers: enriched });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
