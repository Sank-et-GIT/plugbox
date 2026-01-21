import { Router } from "express";
import { PrismaClient, SessionStatus } from "@prisma/client";

const router = Router();
const prisma = new PrismaClient();

/**
 * POST /device/status
 * Body: { chargerId: number, event: "CURRENT_DETECTED" }
 */
router.post("/status", async (req, res) => {
  try {
    const { chargerId, event } = req.body as {
      chargerId?: number;
      event?: string;
    };

    if (typeof chargerId !== "number") {
      return res.status(400).json({ error: "chargerId must be a number" });
    }
    if (!event) {
      return res.status(400).json({ error: "event is required" });
    }

    if (event !== "CURRENT_DETECTED" && event !== "CURRENT_STOPPED") {
  return res.status(400).json({ error: "Unsupported event" });
}

if (event === "CURRENT_STOPPED") {
  // Find ACTIVE session
  const session = await prisma.session.findFirst({
    where: {
      chargerId,
      status: SessionStatus.ACTIVE,
    },
    orderBy: { createdAt: "desc" },
  });

  if (!session || !session.startedAt) {
    return res.status(409).json({
      error: "No ACTIVE session found for charger",
    });
  }

  const endedAt = new Date();
  const durationSeconds = Math.floor(
    (endedAt.getTime() - session.startedAt.getTime()) / 1000
  );

  const updated = await prisma.session.update({
    where: { id: session.id },
    data: {
      status: SessionStatus.ENDED,
      endedAt,
    },
  });

  return res.json({
    ok: true,
    sessionId: updated.id,
    status: "SessionEnded",
    durationSeconds,
  });
}


    // Find latest UNLOCKED session for this charger
    const session = await prisma.session.findFirst({
      where: {
        chargerId,
        status: SessionStatus.UNLOCKED,
      },
      orderBy: { createdAt: "desc" },
    });

    if (!session) {
      return res.status(409).json({
        error: "No UNLOCKED session found for charger",
      });
    }

    const updated = await prisma.session.update({
      where: { id: session.id },
      data: {
        status: SessionStatus.ACTIVE,
        startedAt: new Date(),
      },
    });

    return res.json({
      ok: true,
      sessionId: updated.id,
      status: "ChargingActive",
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
