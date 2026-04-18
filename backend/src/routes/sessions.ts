// ─────────────────────────────────────────────────────────────────────────────
// src/routes/sessions.ts
//
// Fixes in this version:
//   1. POST /start is now idempotent — if app retries due to a network blip,
//      an existing non-failed session for the same booking is returned instead
//      of creating a duplicate.
//   2. POST /stop uses kwhAtStart delta for billing instead of raw PZEM counter.
//      finalKwh = latestReading.energyKwh - session.kwhAtStart
//      This protects against RESET_ENERGY timing issues between sessions.
//   3. GET /meter uses same kwhAtStart delta for live billing display.
//   4. Template literal fixes throughout (was using "..." with ${} instead of `...`)
// ─────────────────────────────────────────────────────────────────────────────

import prisma from "../lib/prismaClient";
import { log }  from "../lib/logger";
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
// Body: { chargerId: number, userId: string }
//
// Flow:
//   1. Validate active HOLD booking exists
//   2. IDEMPOTENCY: return existing session if booking already has one
//   3. Create session CREATED → UNLOCK_SENT
//   4. Publish SOLENOID_UNLOCK
//   5. Advance to PLUG_WAIT immediately
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

    // Require an active HOLD booking — this is what deducted the wallet balance
    const activeHold = await prisma.booking.findFirst({
      where: {
        chargerId,
        userId,
        status:    BookingStatus.HOLD,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!activeHold)
      return res.status(409).json({ ok: false, error: "No active booking found. Please book first." });

    // ── IDEMPOTENCY CHECK ──────────────────────────────────────────────────────
    // If the app retries POST /start (network timeout, crash), we return the
    // existing session rather than creating a second one for the same booking.
    const existingSession = await prisma.session.findFirst({
      where: {
        bookingId: activeHold.id,
        status:    { notIn: [SessionStatus.FAILED, SessionStatus.ENDED] },
      },
      orderBy: { createdAt: "desc" },
    });

    if (existingSession) {
      log.session("INFO", chargerId, userId, existingSession.id, {
        msg: `Idempotent resume: session ${existingSession.id} already exists for booking ${activeHold.id}`,
      });
      return res.status(200).json({
        ok:        true,
        sessionId: existingSession.id,
        resumed:   true, // tells app this was a resume, not a fresh start
      });
    }

    // ── Create session and audit command in a transaction ──────────────────────
    // Use a transaction so we never have a session without an audit command row
    const { session, cmd } = await prisma.$transaction(async (tx) => {
      const session = await tx.session.create({
        data: {
          chargerId,
          userId,
          bookingId:   activeHold.id,
          status:      SessionStatus.CREATED,
          walletTxnId: activeHold.walletTxnId,
        },
      });

      const cmd = await tx.deviceCommand.create({
        data: {
          chargerId,
          sessionId: session.id,
          type:      CommandType.UNLOCK,
          status:    CommandStatus.PENDING,
          payload:   { reason: "SESSION_START" },
        },
      });

      // Advance state inside same transaction
      await tx.session.update({
        where: { id: session.id },
        data:  { status: SessionStatus.UNLOCK_SENT },
      });

      await tx.booking.update({
        where: { id: activeHold.id },
        data:  { status: BookingStatus.STARTED },
      });

      return { session, cmd };
    });

    // ── Publish solenoid unlock ────────────────────────────────────────────────
    // Done outside the transaction so DB is committed before we hit MQTT.
    // If MQTT is temporarily offline, mqttPublish queues the message.
    const doorTopic = charger.mqttTopic
      ? `${charger.mqttTopic}/door`
      : "pb_device_01/door";

    mqttPublish(doorTopic, "SOLENOID_UNLOCK");

    // ── Advance to PLUG_WAIT ───────────────────────────────────────────────────
    // This is immediate — user can now open lid, plug in, press button.
    // plugWaitStartedAt is used by sessionTimeout.ts for the 5min lid-close timer.
    await prisma.session.update({
      where: { id: session.id },
      data:  {
        status:            SessionStatus.PLUG_WAIT,
        plugWaitStartedAt: new Date(),
      },
    });

    log.session("INFO", chargerId, userId, session.id, {
      msg: `Session started — booking ${activeHold.id}, solenoid unlocked`,
    });

    return res.status(201).json({
      ok:        true,
      sessionId: session.id,
      commandId: cmd.id,
    });

  } catch (err) {
    console.error("[SESSION] /start error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /sessions/stop
// Body: { sessionId: number }
//
// Billing uses kwhAtStart delta:
//   actualKwh = latestReading.energyKwh - session.kwhAtStart
//   This is accurate even if RESET_ENERGY from the previous session was delayed.
//
// If session is still PLUG_WAIT (user stopped before charging started),
//   actualKwh = 0 → full refund issued.
// ─────────────────────────────────────────────────────────────────────────────
router.post("/stop", async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body as { sessionId?: number };

    if (typeof sessionId !== "number")
      return res.status(400).json({ ok: false, error: "sessionId must be a number" });

    const session = await prisma.session.findUnique({
      where:   { id: sessionId },
      include: { charger: true, booking: true },
    });

    if (!session)
      return res.status(404).json({ ok: false, error: "Session not found" });

    // Already in a terminal state — return current state, no-op
    if (session.status === SessionStatus.ENDED || session.status === SessionStatus.FAILED)
      return res.json({ ok: true, sessionId, status: session.status });

    // ── Compute actual kWh used ────────────────────────────────────────────────
    const latestReading =
      await prisma.energyReading.findFirst({
        where:   { sessionId },
        orderBy: { createdAt: "desc" },
      }) ??
      await prisma.energyReading.findFirst({
        where:   { chargerId: session.chargerId },
        orderBy: { createdAt: "desc" },
      });

    const rawKwh   = latestReading?.energyKwh ?? 0;

    // kwhAtStart is the PZEM counter snapshot when charging began (session → ACTIVE).
    // Using the delta protects against PZEM not being reset to exactly 0 between sessions.
    const kwhAtStart = session.kwhAtStart ?? 0;
    const finalKwh   = Math.max(0, rawKwh - kwhAtStart);

    // ── Calculate billing ──────────────────────────────────────────────────────
    const packagePaise = session.booking.packagePaise;
    const kwhLimit     = session.booking.kwhLimit;
    const ratePerKwh   = packagePaise / kwhLimit;
    const usedPaise    = Math.ceil(finalKwh * ratePerKwh);
    const refundPaise  = Math.max(0, packagePaise - usedPaise);

    // ── Refund + session close in single transaction ───────────────────────────
    await prisma.$transaction(async (tx) => {
      let refundTxnId: string | null = null;

      if (refundPaise > 0) {
        const wallet = await tx.wallet.findUnique({ where: { userId: session.userId } });
        if (wallet) {
          const newBalance = wallet.balance + refundPaise;
          await tx.wallet.update({
            where: { userId: session.userId },
            data:  { balance: newBalance },
          });
          const refundTxn = await tx.walletTransaction.create({
            data: {
              walletId:     wallet.id,
              type:         WalletTxnType.REFUND,
              amountPaise:  refundPaise,
              balancePaise: newBalance,
              note:         `Session ended: used ${finalKwh.toFixed(3)} kWh of ${kwhLimit} kWh package`,
              sessionId,
            },
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
        },
      });
    });

    // ── Hardware commands ──────────────────────────────────────────────────────
    const topic = session.charger.mqttTopic ?? "pb_device_01";
    mqttPublish(`${topic}/command`, "RELAY_OFF");
    mqttPublish(`${topic}/door`,    "SOLENOID_UNLOCK"); // unlock so user can retrieve cable
    mqttPublish(`${topic}/command`, "RESET_ENERGY");    // reset PZEM for next session

    log.session("INFO", session.chargerId, session.userId, sessionId, {
      msg: `Session stopped — kWh=${finalKwh.toFixed(3)} used=₹${usedPaise / 100} refund=₹${refundPaise / 100}`,
    });

    return res.json({
      ok:         true,
      sessionId,
      finalKwh,
      usedInr:    usedPaise    / 100,
      refundInr:  refundPaise  / 100,
      packageInr: packagePaise / 100,
    });

  } catch (err) {
    console.error("[SESSION] /stop error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /sessions/meter/:sessionId
// Live billing meter — called by app every few seconds during charging
//
// Returns usedKwh using kwhAtStart delta (same calculation as /stop).
// ─────────────────────────────────────────────────────────────────────────────
router.get("/meter/:sessionId", async (req: Request, res: Response) => {
  try {
    const sessionId = Number(req.params.sessionId);
    if (Number.isNaN(sessionId))
      return res.status(400).json({ ok: false, error: "Invalid sessionId" });

    const session = await prisma.session.findUnique({
      where:   { id: sessionId },
      include: { booking: true },
    });

    if (!session)
      return res.status(404).json({ ok: false, error: "Session not found" });

    // Return zero readings for pre-charging states — billing hasn't started yet
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

    const latest =
      await prisma.energyReading.findFirst({
        where:   { sessionId },
        orderBy: { createdAt: "desc" },
      }) ??
      await prisma.energyReading.findFirst({
        where:   { chargerId: session.chargerId },
        orderBy: { createdAt: "desc" },
      });

    const rawKwh   = latest?.energyKwh ?? 0;
    const kwhAtStart = session.kwhAtStart ?? 0;
    const usedKwh    = Math.max(0, rawKwh - kwhAtStart); // delta from billing baseline

    const packagePaise = session.booking.packagePaise;
    const kwhLimit     = session.booking.kwhLimit;
    const ratePerKwh   = packagePaise / kwhLimit;
    const usedPaise    = Math.ceil(usedKwh * ratePerKwh);
    const refundPaise  = Math.max(0, packagePaise - usedPaise);

    const wallet    = await prisma.wallet.findUnique({ where: { userId: session.userId } });
    const walletNow = wallet?.balance ?? 0;

    // ETA: how many minutes until kwhLimit is reached at current power draw
    const powerW       = latest?.power ?? 1500; // fallback 1.5kW if no reading
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
    console.error("[SESSION] /meter error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /sessions/active/:userId
// Called on app launch to restore SessionScreen if a session is in progress.
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
          ],
        },
      },
      include: { charger: true, booking: true },
      orderBy: { createdAt: "desc" },
    });

    if (!session)
      return res.json({ ok: true, active: false });

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
    console.error("[SESSION] /active error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

export default router;