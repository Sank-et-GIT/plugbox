// ─────────────────────────────────────────────────────────────────────────────
// src/routes/sessions.ts — Bug-fixed version
//
// Fix: plugWaitStartedAt set when session moves to PLUG_WAIT
//      Used by sessionTimeout.ts for accurate 3min timer
// ─────────────────────────────────────────────────────────────────────────────

import prisma from "../lib/prismaClient";
import { log } from "../lib/logger";
import { Router, Request, Response } from "express";
import {
  BookingStatus,
  SessionStatus,
  CommandType,
  CommandStatus,
  WalletTxnType,
} from "@prisma/client";
import { mqttPublish } from "../mqtt/mqttClient";

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// POST /sessions/start
// Body: { chargerId, userId }
// ─────────────────────────────────────────────────────────────────────────────

router.post("/start", async (req: Request, res: Response) => {
  try {
    const { chargerId, userId } = req.body as {
      chargerId?: number;
      userId?:    string;
    };

    if (typeof chargerId !== "number")
      return res.status(400).json({ ok: false, error: "chargerId must be a number" });
    if (!userId)
      return res.status(400).json({ ok: false, error: "userId is required" });

    const charger = await prisma.charger.findUnique({ where: { id: chargerId } });
    if (!charger)
      return res.status(404).json({ ok: false, error: "Charger not found" });

    // Must have active HOLD booking for this user + charger
    const activeHold = await prisma.booking.findFirst({
      where: {
        chargerId,
        userId,
        status:    BookingStatus.HOLD,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!activeHold) {
      return res.status(409).json({
        ok:    false,
        error: "No active booking found. Please book first."
      });
    }

    // Create session
    const session = await prisma.session.create({
      data: {
        chargerId,
        userId,
        bookingId:   activeHold.id,
        status:      SessionStatus.CREATED,
        walletTxnId: activeHold.walletTxnId,
      }
    });

    // Audit trail
    const cmd = await prisma.deviceCommand.create({
      data: {
        chargerId,
        sessionId: session.id,
        type:      CommandType.UNLOCK,
        status:    CommandStatus.PENDING,
        payload:   { reason: "SESSION_START" },
      }
    });

    await prisma.session.update({
      where: { id: session.id },
      data:  { status: SessionStatus.UNLOCK_SENT }
    });
    await prisma.booking.update({
      where: { id: activeHold.id },
      data:  { status: BookingStatus.STARTED }
    });

    // Publish SOLENOID_UNLOCK — queued if MQTT offline
    const doorTopic = charger.mqttTopic
      ? `${charger.mqttTopic}/door`
      : "pb_device_01/door";

    mqttPublish(doorTopic, "SOLENOID_UNLOCK");

    // Move session to PLUG_WAIT immediately after unlock
    // Hardware button directly controls relay (no MQTT needed for relay)
    // PZEM current detection will auto-advance session to ACTIVE
    // when user presses button and vehicle starts drawing current
    await prisma.session.update({
      where: { id: session.id },
      data:  {
        status:            SessionStatus.PLUG_WAIT,
        plugWaitStartedAt: new Date(),
      }
    });

    log.session("INFO", 0, "", 0, { msg: "Started: id=${session.id} charger=${chargerId} user=${userId}" });

    return res.status(201).json({
      ok:        true,
      sessionId: session.id,
      commandId: cmd.id,
    });

  } catch (err) {
    console.error("[SESSION] start error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /sessions/stop
// Body: { sessionId }
// ─────────────────────────────────────────────────────────────────────────────

router.post("/stop", async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body as { sessionId?: number };

    if (typeof sessionId !== "number")
      return res.status(400).json({ ok: false, error: "sessionId must be a number" });

    const session = await prisma.session.findUnique({
      where:   { id: sessionId },
      include: { charger: true, booking: true }
    });

    if (!session)
      return res.status(404).json({ ok: false, error: "Session not found" });

    if (session.status === SessionStatus.ENDED || session.status === SessionStatus.FAILED) {
      return res.json({ ok: true, sessionId, status: session.status });
    }

    // Get final kWh
    const latestReading = await prisma.energyReading.findFirst({
      where:   { sessionId },
      orderBy: { createdAt: "desc" },
    }) ?? await prisma.energyReading.findFirst({
      where:   { chargerId: session.chargerId },
      orderBy: { createdAt: "desc" },
    });

    const finalKwh     = latestReading?.energyKwh ?? 0;
    const packagePaise = session.booking.packagePaise;
    const kwhLimit     = session.booking.kwhLimit;
    const ratePerKwh   = packagePaise / kwhLimit;

    const usedPaise   = Math.ceil(finalKwh * ratePerKwh);
    const refundPaise = Math.max(0, packagePaise - usedPaise);

    await prisma.$transaction(async (tx) => {
      let refundTxnId: string | null = null;

      if (refundPaise > 0) {
        const wallet = await tx.wallet.findUnique({
          where: { userId: session.userId }
        });
        if (wallet) {
          const newBalance = wallet.balance + refundPaise;
          await tx.wallet.update({
            where: { userId: session.userId },
            data:  { balance: newBalance }
          });
          const refundTxn = await tx.walletTransaction.create({
            data: {
              walletId:     wallet.id,
              type:         WalletTxnType.REFUND,
              amountPaise:  refundPaise,
              balancePaise: newBalance,
              note:         `Refund: used ${finalKwh.toFixed(3)} of ${kwhLimit} kWh`,
              sessionId,
            }
          });
          refundTxnId = refundTxn.id;
        }
      }

      await tx.session.update({
        where: { id: sessionId },
        data:  {
          status:      SessionStatus.ENDED,
          endedAt:     new Date(),
          finalKwh,
          refundTxnId,
        }
      });
    });

    // Hardware commands
    const topic = session.charger.mqttTopic ?? "pb_device_01";
    mqttPublish(`${topic}/command`, "RELAY_OFF");
    mqttPublish(`${topic}/door`,    "SOLENOID_UNLOCK");
    mqttPublish(`${topic}/command`, "RESET_ENERGY");

    log.session("INFO", 0, "", 0, { msg: "Stopped: id=${sessionId} kWh=${finalKwh} refund=₹${refundPaise / 100}" });

    return res.json({
      ok:         true,
      sessionId,
      finalKwh,
      usedInr:    usedPaise    / 100,
      refundInr:  refundPaise  / 100,
      packageInr: packagePaise / 100,
    });

  } catch (err) {
    console.error("[SESSION] stop error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /sessions/meter/:sessionId
// ─────────────────────────────────────────────────────────────────────────────

router.get("/meter/:sessionId", async (req: Request, res: Response) => {
  try {
    const sessionId = Number(req.params.sessionId);
    if (Number.isNaN(sessionId))
      return res.status(400).json({ ok: false, error: "Invalid sessionId" });

    const session = await prisma.session.findUnique({
      where:   { id: sessionId },
      include: { booking: true }
    });

    if (!session)
      return res.status(404).json({ ok: false, error: "Session not found" });

    if (session.status !== SessionStatus.ACTIVE && session.status !== SessionStatus.ENDED) {
      return res.json({
        ok:                  true,
        sessionId,
        status:              session.status,
        usedKwh:             0,
        remainingBalanceInr: 0,
        etaMinutes:          0,
      });
    }

    const latest = await prisma.energyReading.findFirst({
      where:   { sessionId },
      orderBy: { createdAt: "desc" },
    }) ?? await prisma.energyReading.findFirst({
      where:   { chargerId: session.chargerId },
      orderBy: { createdAt: "desc" },
    });

    const usedKwh      = latest?.energyKwh ?? 0;
    const packagePaise = session.booking.packagePaise;
    const kwhLimit     = session.booking.kwhLimit;
    const ratePerKwh   = packagePaise / kwhLimit;
    const usedPaise    = Math.ceil(usedKwh * ratePerKwh);
    const refundPaise  = Math.max(0, packagePaise - usedPaise);

    const wallet       = await prisma.wallet.findUnique({
      where: { userId: session.userId }
    });
    const walletNow    = wallet?.balance ?? 0;

    // ETA based on current power reading
    const powerW       = latest?.power ?? 1500;
    const remainingKwh = Math.max(0, kwhLimit - usedKwh);
    const etaMinutes   = powerW > 0
      ? Math.ceil((remainingKwh / (powerW / 1000)) * 60)
      : 0;

    return res.json({
      ok:                  true,
      sessionId,
      status:              session.status,
      usedKwh:             parseFloat(usedKwh.toFixed(3)),
      remainingBalanceInr: (walletNow + refundPaise) / 100,
      etaMinutes:          Math.max(0, etaMinutes),
      usedInr:             usedPaise   / 100,
      refundInr:           refundPaise / 100,
    });

  } catch (err) {
    console.error("[SESSION] meter error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /sessions/active/:userId
// Called on app launch to restore SessionScreen if session was in progress
// ─────────────────────────────────────────────────────────────────────────────

router.get("/active/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

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
          ]
        }
      },
      include: { charger: true, booking: true },
      orderBy: { createdAt: "desc" },
    });

    if (!session) {
      return res.json({ ok: true, active: false });
    }

    return res.json({
      ok:           true,
      active:       true,
      sessionId:    session.id,
      status:       session.status,
      chargerId:    session.chargerId,
      chargerName:  session.charger.name,
      chargerLat:   session.charger.lat,
      chargerLng:   session.charger.lng,
      packageName:  session.booking.packageName,
      packagePaise: session.booking.packagePaise,
      kwhLimit:     session.booking.kwhLimit,
      startedAt:    session.startedAt,
    });

  } catch (err) {
    console.error("[SESSION] active error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

export default router;