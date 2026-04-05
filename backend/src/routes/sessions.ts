// ─────────────────────────────────────────────────────────────────────────────
// src/routes/sessions.ts
//
// Purpose:
//   Handles session lifecycle for charger usage.
//
// Main responsibilities:
//   1. Start a session from an active HOLD booking
//   2. Create UNLOCK command for device
//   3. Stop a session and calculate refund
//   4. Return live meter/session summary
//   5. Restore active session on app relaunch
//
// Notes:
//   - MQTT publish is used for device actions
//   - Session start depends on an active HOLD booking
//   - Session stop may create a REFUND wallet transaction
// ─────────────────────────────────────────────────────────────────────────────

import prisma from "../lib/prismaClient";
import { Router, Request, Response } from "express";
import {
  BookingStatus,
  SessionStatus,
  CommandType,
  CommandStatus,
  WalletTxnType,
} from "@prisma/client";
import { mqttPublish } from "../mqtt/mqttClient";
import { logDebug, logError, logInfo, logWarn } from "../lib/logger";

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// POST /sessions/start
//
// Body:
// {
//   chargerId: number,
//   userId: string
// }
//
// Flow:
//   1. Validate input
//   2. Check charger exists
//   3. Check user has active HOLD booking
//   4. Create session
//   5. Create UNLOCK device command
//   6. Move session to UNLOCK_SENT
//   7. Move booking to STARTED
//   8. Publish SOLENOID_UNLOCK via MQTT
// ─────────────────────────────────────────────────────────────────────────────
router.post("/start", async (req: Request, res: Response) => {
  try {
    const { chargerId, userId } = req.body as {
      chargerId?: number;
      userId?: string;
    };

    logDebug("session_start_requested", {
      category: "session",
      chargerId,
      userId,
    });

    if (typeof chargerId !== "number") {
      return res.status(400).json({ ok: false, error: "chargerId must be a number" });
    }

    if (!userId) {
      return res.status(400).json({ ok: false, error: "userId is required" });
    }

    const charger = await prisma.charger.findUnique({
      where: { id: chargerId },
    });

    logDebug("session_start_charger_lookup", {
      category: "session",
      chargerId,
      found: !!charger,
    });

    if (!charger) {
      return res.status(404).json({ ok: false, error: "Charger not found" });
    }

    // User must have an active HOLD booking for this charger
    const activeHold = await prisma.booking.findFirst({
      where: {
        chargerId,
        userId,
        status: BookingStatus.HOLD,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    logDebug("session_start_active_hold_lookup", {
      category: "session",
      chargerId,
      userId,
      bookingId: activeHold?.id,
      found: !!activeHold,
    });

    if (!activeHold) {
      logWarn("session_start_no_active_hold", {
        category: "session",
        chargerId,
        userId,
      });

      return res.status(409).json({
        ok: false,
        error: "No active booking found. Please book first.",
      });
    }

    // Create session in CREATED state
    const session = await prisma.session.create({
      data: {
        chargerId,
        userId,
        bookingId: activeHold.id,
        status: SessionStatus.CREATED,
        walletTxnId: activeHold.walletTxnId,
      },
    });

    logInfo("session_record_created", {
      category: "session",
      sessionId: session.id,
      chargerId,
      userId,
      bookingId: activeHold.id,
      walletTxnId: activeHold.walletTxnId,
      status: SessionStatus.CREATED,
    });

    // Create UNLOCK device command
    const cmd = await prisma.deviceCommand.create({
      data: {
        chargerId,
        sessionId: session.id,
        type: CommandType.UNLOCK,
        status: CommandStatus.PENDING,
        payload: { reason: "SESSION_START" },
      },
    });

    logInfo("session_unlock_command_created", {
      category: "session",
      sessionId: session.id,
      commandId: cmd.id,
      chargerId,
      type: CommandType.UNLOCK,
      status: CommandStatus.PENDING,
    });

    // Move session to UNLOCK_SENT
    await prisma.session.update({
      where: { id: session.id },
      data: { status: SessionStatus.UNLOCK_SENT },
    });

    logInfo("session_status_updated", {
      category: "session",
      sessionId: session.id,
      status: SessionStatus.UNLOCK_SENT,
    });

    // Move booking from HOLD to STARTED
    await prisma.booking.update({
      where: { id: activeHold.id },
      data: { status: BookingStatus.STARTED },
    });

    logInfo("session_booking_status_updated", {
      category: "session",
      bookingId: activeHold.id,
      sessionId: session.id,
      status: BookingStatus.STARTED,
    });

    // Publish unlock command to device
    const doorTopic = charger.mqttTopic ? `${charger.mqttTopic}/door` : "pb_device_01/door";

    logInfo("session_unlock_publish_started", {
      category: "session",
      sessionId: session.id,
      chargerId,
      topic: doorTopic,
      payload: "SOLENOID_UNLOCK",
    });

    mqttPublish(doorTopic, "SOLENOID_UNLOCK");

    logInfo("session_started", {
      category: "session",
      sessionId: session.id,
      chargerId,
      userId,
      commandId: cmd.id,
      topic: doorTopic,
    });

    return res.status(201).json({
      ok: true,
      sessionId: session.id,
      commandId: cmd.id,
    });
  } catch (err: any) {
    logError("session_start_failed", {
      category: "session",
      chargerId: req.body?.chargerId,
      userId: req.body?.userId,
      errorMessage: err?.message,
      stack: err?.stack,
    });

    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /sessions/stop
//
// Body:
// {
//   sessionId: number
// }
//
// Flow:
//   1. Validate input
//   2. Load session + charger + booking
//   3. Read latest meter value
//   4. Calculate used amount and refund
//   5. Create refund transaction if needed
//   6. Mark session as ENDED
//   7. Publish hardware shutdown/reset commands
// ─────────────────────────────────────────────────────────────────────────────
router.post("/stop", async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body as { sessionId?: number };

    logDebug("session_stop_requested", {
      category: "session",
      sessionId,
    });

    if (typeof sessionId !== "number") {
      return res.status(400).json({ ok: false, error: "sessionId must be a number" });
    }

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { charger: true, booking: true },
    });

    logDebug("session_stop_lookup", {
      category: "session",
      sessionId,
      found: !!session,
      status: session?.status,
      chargerId: session?.chargerId,
    });

    if (!session) {
      return res.status(404).json({ ok: false, error: "Session not found" });
    }

    // Idempotent stop
    if (session.status === SessionStatus.ENDED || session.status === SessionStatus.FAILED) {
      logInfo("session_stop_already_final", {
        category: "session",
        sessionId,
        status: session.status,
      });

      return res.json({ ok: true, sessionId, status: session.status });
    }

    // Get latest reading for this session, fallback to charger latest reading
    const latestReading =
      (await prisma.energyReading.findFirst({
        where: { sessionId },
        orderBy: { createdAt: "desc" },
      })) ??
      (await prisma.energyReading.findFirst({
        where: { chargerId: session.chargerId },
        orderBy: { createdAt: "desc" },
      }));

    const finalKwh = latestReading?.energyKwh ?? 0;
    const packagePaise = session.booking.packagePaise;
    const kwhLimit = session.booking.kwhLimit;
    const ratePerKwh = packagePaise / kwhLimit;

    const usedPaise = Math.ceil(finalKwh * ratePerKwh);
    const refundPaise = Math.max(0, packagePaise - usedPaise);

    logInfo("session_stop_calculated", {
      category: "session",
      sessionId,
      chargerId: session.chargerId,
      finalKwh,
      packagePaise,
      kwhLimit,
      ratePerKwh,
      usedPaise,
      refundPaise,
    });

    await prisma.$transaction(async (tx) => {
      let refundTxnId: string | null = null;

      if (refundPaise > 0) {
        const wallet = await tx.wallet.findUnique({
          where: { userId: session.userId },
        });

        logDebug("session_stop_wallet_lookup", {
          category: "session",
          sessionId,
          userId: session.userId,
          walletId: wallet?.id,
          found: !!wallet,
        });

        if (wallet) {
          const newBalance = wallet.balance + refundPaise;

          await tx.wallet.update({
            where: { userId: session.userId },
            data: { balance: newBalance },
          });

          logInfo("session_refund_wallet_updated", {
            category: "session",
            sessionId,
            walletId: wallet.id,
            oldBalance: wallet.balance,
            refundPaise,
            newBalance,
          });

          const refundTxn = await tx.walletTransaction.create({
            data: {
              walletId: wallet.id,
              type: WalletTxnType.REFUND,
              amountPaise: refundPaise,
              balancePaise: newBalance,
              note: `Refund: used ${finalKwh.toFixed(3)} of ${kwhLimit} kWh`,
              sessionId,
            },
          });

          refundTxnId = refundTxn.id;

          logInfo("session_refund_transaction_created", {
            category: "session",
            sessionId,
            walletTxnId: refundTxn.id,
            refundPaise,
          });
        }
      }

      await tx.session.update({
        where: { id: sessionId },
        data: {
          status: SessionStatus.ENDED,
          endedAt: new Date(),
          finalKwh,
          refundTxnId,
        },
      });

      logInfo("session_status_ended", {
        category: "session",
        sessionId,
        finalKwh,
        refundTxnId,
      });
    });

    // Publish shutdown commands to device
    const topic = session.charger.mqttTopic ?? "pb_device_01";

    logInfo("session_stop_publish_started", {
      category: "session",
      sessionId,
      chargerId: session.chargerId,
      topicBase: topic,
      commands: ["RELAY_OFF", "SOLENOID_UNLOCK", "RESET_ENERGY"],
    });

    mqttPublish(`${topic}/command`, "RELAY_OFF");
    mqttPublish(`${topic}/door`, "SOLENOID_UNLOCK");
    mqttPublish(`${topic}/command`, "RESET_ENERGY");

    logInfo("session_stopped", {
      category: "session",
      sessionId,
      finalKwh,
      usedPaise,
      refundPaise,
    });

    return res.json({
      ok: true,
      sessionId,
      finalKwh,
      usedInr: usedPaise / 100,
      refundInr: refundPaise / 100,
      packageInr: packagePaise / 100,
    });
  } catch (err: any) {
    logError("session_stop_failed", {
      category: "session",
      sessionId: req.body?.sessionId,
      errorMessage: err?.message,
      stack: err?.stack,
    });

    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /sessions/meter/:sessionId
//
// Returns current usage summary for session.
// Works for ACTIVE and ENDED sessions.
// ─────────────────────────────────────────────────────────────────────────────
router.get("/meter/:sessionId", async (req: Request, res: Response) => {
  try {
    const sessionId = Number(req.params.sessionId);

    logDebug("session_meter_requested", {
      category: "session",
      sessionId,
    });

    if (Number.isNaN(sessionId)) {
      return res.status(400).json({ ok: false, error: "Invalid sessionId" });
    }

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { booking: true },
    });

    logDebug("session_meter_lookup", {
      category: "session",
      sessionId,
      found: !!session,
      status: session?.status,
    });

    if (!session) {
      return res.status(404).json({ ok: false, error: "Session not found" });
    }

    if (session.status !== SessionStatus.ACTIVE && session.status !== SessionStatus.ENDED) {
      logInfo("session_meter_non_active_state", {
        category: "session",
        sessionId,
        status: session.status,
      });

      return res.json({
        ok: true,
        sessionId,
        status: session.status,
        usedKwh: 0,
        remainingBalanceInr: 0,
        etaMinutes: 0,
      });
    }

    const latest =
      (await prisma.energyReading.findFirst({
        where: { sessionId },
        orderBy: { createdAt: "desc" },
      })) ??
      (await prisma.energyReading.findFirst({
        where: { chargerId: session.chargerId },
        orderBy: { createdAt: "desc" },
      }));

    const usedKwh = latest?.energyKwh ?? 0;
    const packagePaise = session.booking.packagePaise;
    const kwhLimit = session.booking.kwhLimit;
    const ratePerKwh = packagePaise / kwhLimit;
    const usedPaise = Math.ceil(usedKwh * ratePerKwh);
    const refundPaise = Math.max(0, packagePaise - usedPaise);

    const wallet = await prisma.wallet.findUnique({
      where: { userId: session.userId },
    });

    const walletNow = wallet?.balance ?? 0;

    // ETA based on power reading
    const powerW = latest?.power ?? 1500;
    const remainingKwh = Math.max(0, kwhLimit - usedKwh);
    const etaMinutes =
      powerW > 0 ? Math.ceil((remainingKwh / (powerW / 1000)) * 60) : 0;

    logInfo("session_meter_calculated", {
      category: "session",
      sessionId,
      status: session.status,
      usedKwh,
      remainingKwh,
      powerW,
      etaMinutes,
      usedPaise,
      refundPaise,
      walletBalance: walletNow,
    });

    return res.json({
      ok: true,
      sessionId,
      status: session.status,
      usedKwh: parseFloat(usedKwh.toFixed(3)),
      remainingBalanceInr: (walletNow + refundPaise) / 100,
      etaMinutes: Math.max(0, etaMinutes),
      usedInr: usedPaise / 100,
      refundInr: refundPaise / 100,
    });
  } catch (err: any) {
    logError("session_meter_failed", {
      category: "session",
      sessionId: req.params?.sessionId,
      errorMessage: err?.message,
      stack: err?.stack,
    });

    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /sessions/active/:userId
//
// Used by app launch to restore in-progress session screen.
// ─────────────────────────────────────────────────────────────────────────────
router.get("/active/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    logDebug("session_active_requested", {
      category: "session",
      userId,
    });

    const session = await prisma.session.findFirst({
      where: {
        userId,
        status: {
          in: [
            SessionStatus.CREATED,
            SessionStatus.UNLOCK_SENT,
            SessionStatus.UNLOCKED,
            SessionStatus.PLUG_WAIT,
            SessionStatus.ACTIVE,
          ],
        },
      },
      include: { charger: true, booking: true },
      orderBy: { createdAt: "desc" },
    });

    logDebug("session_active_lookup", {
      category: "session",
      userId,
      found: !!session,
      sessionId: session?.id,
      status: session?.status,
    });

    if (!session) {
      return res.json({ ok: true, active: false });
    }

    logInfo("session_active_found", {
      category: "session",
      userId,
      sessionId: session.id,
      chargerId: session.chargerId,
      status: session.status,
    });

    return res.json({
      ok: true,
      active: true,
      sessionId: session.id,
      status: session.status,
      chargerId: session.chargerId,
      chargerName: session.charger.name,
      chargerLat: session.charger.lat,
      chargerLng: session.charger.lng,
      packageName: session.booking.packageName,
      packagePaise: session.booking.packagePaise,
      kwhLimit: session.booking.kwhLimit,
      startedAt: session.startedAt,
    });
  } catch (err: any) {
    logError("session_active_failed", {
      category: "session",
      userId: req.params?.userId,
      errorMessage: err?.message,
      stack: err?.stack,
    });

    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

export default router;