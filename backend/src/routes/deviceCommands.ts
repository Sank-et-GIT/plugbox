import { Router } from "express";
import { PrismaClient, CommandStatus, CommandType, SessionStatus } from "@prisma/client";


const router = Router();
const prisma = new PrismaClient();

/**
 * GET /device/commands?chargerId=1
 * Device polls backend for next pending command.
 */
router.get("/commands", async (req, res) => {
  try {
    const chargerIdRaw = req.query.chargerId;
    const chargerId = Number(chargerIdRaw);

    if (!chargerIdRaw || Number.isNaN(chargerId)) {
      return res.status(400).json({ error: "chargerId query param is required (number)" });
    }

    const charger = await prisma.charger.findUnique({ where: { id: chargerId } });
    if (!charger) return res.status(404).json({ error: "Charger not found" });

    // Get oldest pending command for this charger
    const cmd = await prisma.deviceCommand.findFirst({
      where: { chargerId, status: CommandStatus.PENDING },
      orderBy: { createdAt: "asc" },
    });

    // Return null if no command
    return res.json({
      command: cmd
        ? {
            id: cmd.id,
            type: cmd.type,
            payload: cmd.payload,
            createdAt: cmd.createdAt,
            sessionId: cmd.sessionId,
          }
        : null,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /device/ack
 * Body: { chargerId: number, commandId: number }
 */
router.post("/ack", async (req, res) => {
  try {
    const { chargerId, commandId } = req.body as {
      chargerId?: number;
      commandId?: number;
    };

    if (typeof chargerId !== "number") {
      return res.status(400).json({ error: "chargerId must be a number" });
    }
    if (typeof commandId !== "number") {
      return res.status(400).json({ error: "commandId must be a number" });
    }

    const cmd = await prisma.deviceCommand.findUnique({
      where: { id: commandId },
    });

    if (!cmd) {
      return res.status(404).json({ error: "Command not found" });
    }

    if (cmd.chargerId !== chargerId) {
      return res.status(409).json({ error: "Command does not belong to this charger" });
    }

    // Idempotent ACK
    if (cmd.status === CommandStatus.ACKED) {
      return res.json({ ok: true, alreadyAcked: true });
    }

    const updated = await prisma.deviceCommand.update({
      where: { id: commandId },
      data: {
        status: CommandStatus.ACKED,
        ackedAt: new Date(),
      },
    });

    // Update session status for UNLOCK
    if (updated.sessionId && updated.type === CommandType.UNLOCK) {
      await prisma.session.update({
        where: { id: updated.sessionId },
        data: { status: SessionStatus.UNLOCKED },
      });
    }

    return res.json({
      ok: true,
      commandId: updated.id,
      status: updated.status,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
