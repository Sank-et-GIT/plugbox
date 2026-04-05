import { Router } from "express";
import { PrismaClient, CommandStatus, CommandType, SessionStatus } from "@prisma/client";
import { logDebug, logError, logInfo, logWarn } from "../lib/logger";

const router = Router();
const prisma = new PrismaClient();

// ─────────────────────────────────────────────────────────────────────────────
// GET /device/commands?chargerId=1
//
// Purpose:
//   Device polls backend for the next pending command.
//
// Flow:
//   1. Validate chargerId
//   2. Check charger exists
//   3. Fetch oldest PENDING command for that charger
//   4. Return command or null
// ─────────────────────────────────────────────────────────────────────────────
router.get("/commands", async (req, res) => {
  try {
    const chargerIdRaw = req.query.chargerId;
    const chargerId = Number(chargerIdRaw);

    logDebug("device_commands_requested", {
      category: "device",
      chargerIdRaw,
      chargerId,
    });

    if (!chargerIdRaw || Number.isNaN(chargerId)) {
      return res.status(400).json({ error: "chargerId query param is required (number)" });
    }

    const charger = await prisma.charger.findUnique({
      where: { id: chargerId },
    });

    logDebug("device_commands_charger_lookup", {
      category: "device",
      chargerId,
      found: !!charger,
    });

    if (!charger) {
      return res.status(404).json({ error: "Charger not found" });
    }

    // Get oldest pending command for this charger
    const cmd = await prisma.deviceCommand.findFirst({
      where: { chargerId, status: CommandStatus.PENDING },
      orderBy: { createdAt: "asc" },
    });

    logInfo("device_commands_result", {
      category: "device",
      chargerId,
      found: !!cmd,
      commandId: cmd?.id ?? null,
      commandType: cmd?.type ?? null,
      sessionId: cmd?.sessionId ?? null,
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
  } catch (err: any) {
    logError("device_commands_failed", {
      category: "device",
      chargerId: req.query?.chargerId,
      errorMessage: err?.message,
      stack: err?.stack,
    });

    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /device/ack
//
// Body:
//   { chargerId: number, commandId: number }
//
// Purpose:
//   Device acknowledges that it received/executed a command.
//
// Flow:
//   1. Validate chargerId and commandId
//   2. Load command
//   3. Ensure command belongs to this charger
//   4. If already ACKED, return idempotent success
//   5. Mark command as ACKED
//   6. If command was UNLOCK, move session to UNLOCKED
// ─────────────────────────────────────────────────────────────────────────────
router.post("/ack", async (req, res) => {
  try {
    const { chargerId, commandId } = req.body as {
      chargerId?: number;
      commandId?: number;
    };

    logDebug("device_ack_requested", {
      category: "device",
      chargerId,
      commandId,
    });

    if (typeof chargerId !== "number") {
      return res.status(400).json({ error: "chargerId must be a number" });
    }

    if (typeof commandId !== "number") {
      return res.status(400).json({ error: "commandId must be a number" });
    }

    const cmd = await prisma.deviceCommand.findUnique({
      where: { id: commandId },
    });

    logDebug("device_ack_command_lookup", {
      category: "device",
      chargerId,
      commandId,
      found: !!cmd,
      status: cmd?.status,
      type: cmd?.type,
      sessionId: cmd?.sessionId,
    });

    if (!cmd) {
      return res.status(404).json({ error: "Command not found" });
    }

    if (cmd.chargerId !== chargerId) {
      logWarn("device_ack_charger_mismatch", {
        category: "device",
        chargerId,
        commandId,
        actualChargerId: cmd.chargerId,
      });

      return res.status(409).json({ error: "Command does not belong to this charger" });
    }

    // Idempotent ACK
    if (cmd.status === CommandStatus.ACKED) {
      logInfo("device_ack_already_acked", {
        category: "device",
        chargerId,
        commandId,
      });

      return res.json({ ok: true, alreadyAcked: true });
    }

    const updated = await prisma.deviceCommand.update({
      where: { id: commandId },
      data: {
        status: CommandStatus.ACKED,
        ackedAt: new Date(),
      },
    });

    logInfo("device_ack_updated", {
      category: "device",
      chargerId,
      commandId: updated.id,
      status: updated.status,
      type: updated.type,
      sessionId: updated.sessionId,
    });

    // Update session status for UNLOCK command
    if (updated.sessionId && updated.type === CommandType.UNLOCK) {
      await prisma.session.update({
        where: { id: updated.sessionId },
        data: { status: SessionStatus.UNLOCKED },
      });

      logInfo("device_ack_session_unlocked", {
        category: "session",
        chargerId,
        commandId: updated.id,
        sessionId: updated.sessionId,
        status: SessionStatus.UNLOCKED,
      });
    }

    return res.json({
      ok: true,
      commandId: updated.id,
      status: updated.status,
    });
  } catch (err: any) {
    logError("device_ack_failed", {
      category: "device",
      chargerId: req.body?.chargerId,
      commandId: req.body?.commandId,
      errorMessage: err?.message,
      stack: err?.stack,
    });

    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;