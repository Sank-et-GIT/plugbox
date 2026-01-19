import { Router } from "express";
import { PrismaClient, BookingStatus } from "@prisma/client";

const router = Router();
const prisma = new PrismaClient();

const HOLD_MINUTES = 2;

router.post("/hold", async (req, res) => {
  try {
    const { chargerId, userId } = req.body as {
      chargerId?: number;
      userId?: string;
    };

    if (typeof chargerId !== "number") {
      return res.status(400).json({ error: "chargerId must be a number" });
    }
    if (!userId || typeof userId !== "string") {
      return res.status(400).json({ error: "userId is required (string)" });
    }

    // Ensure charger exists
    const charger = await prisma.charger.findUnique({ where: { id: chargerId } });
    if (!charger) return res.status(404).json({ error: "Charger not found" });

    const now = new Date();

    // Is there already an active HOLD for this charger?
    const activeHold = await prisma.booking.findFirst({
      where: {
        chargerId,
        status: BookingStatus.HOLD,
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: "desc" },
    });

    if (activeHold) {
      return res.status(409).json({
        error: "Charger already held",
        activeHold: {
          id: activeHold.id,
          chargerId: activeHold.chargerId,
          userId: activeHold.userId,
          expiresAt: activeHold.expiresAt,
        },
      });
    }

    const expiresAt = new Date(now.getTime() + HOLD_MINUTES * 60 * 1000);

    const booking = await prisma.booking.create({
      data: {
        chargerId,
        userId,
        status: BookingStatus.HOLD,
        expiresAt,
      },
    });

    return res.status(201).json({
      ok: true,
      booking,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
