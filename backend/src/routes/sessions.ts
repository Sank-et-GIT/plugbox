import { Router } from "express";
import {
  PrismaClient,
  BookingStatus,
  SessionStatus,
  CommandType,
  CommandStatus,
} from "@prisma/client";

const router = Router();
const prisma = new PrismaClient();

router.post("/start", async (req, res) => {
  try {
    const { chargerId, userId } = req.body as { chargerId?: number; userId?: string };

    if (typeof chargerId !== "number") {
      return res.status(400).json({ error: "chargerId must be a number" });
    }
    if (!userId || typeof userId !== "string") {
      return res.status(400).json({ error: "userId is required (string)" });
    }

    const charger = await prisma.charger.findUnique({ where: { id: chargerId } });
    if (!charger) return res.status(404).json({ error: "Charger not found" });

    const now = new Date();

    // must have an active HOLD for this charger (any user for now; we’ll enforce user match later)
    const activeHold = await prisma.booking.findFirst({
      where: {
        chargerId,
        status: BookingStatus.HOLD,
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!activeHold) {
      return res.status(409).json({ error: "No active hold for this charger" });
    }

    // Create session
    const session = await prisma.session.create({
      data: {
        chargerId,
        userId,
        status: SessionStatus.CREATED,
      },
    });

    // Queue UNLOCK command for device
    const cmd = await prisma.deviceCommand.create({
      data: {
        chargerId,
        type: CommandType.UNLOCK,
        status: CommandStatus.PENDING,
        sessionId: session.id,
        payload: { reason: "SESSION_START" },
      },
    });

    // Optional: mark session status as UNLOCK_SENT
    await prisma.session.update({
      where: { id: session.id },
      data: { status: SessionStatus.UNLOCK_SENT },
    });

    return res.status(201).json({
      ok: true,
      sessionId: session.id,
      commandId: cmd.id,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
