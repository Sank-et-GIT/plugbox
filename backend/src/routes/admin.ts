import { Router } from "express";
import { PrismaClient } from "@prisma/client";

const router = Router();
const prisma = new PrismaClient();

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

export default router;
