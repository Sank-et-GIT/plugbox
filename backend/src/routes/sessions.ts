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

    console.log(`[SESSION] Session ${session.id} started — booking ${activeHold.id}, solenoid unlocked`);

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

    const rawKwh    = latestReading?.energyKwh ?? 0;
    const kwhAtStart = session.kwhAtStart ?? 0;
    let   finalKwh   = Math.max(0, rawKwh - kwhAtStart);

    // ── Power integration fallback ─────────────────────────────────────────────
    // PZEM energy counter resolution is 0.01 kWh — it only ticks every ~5 min
    // at 115W. For short demo sessions (< 5 min), energy stays 0.000 even though
    // real power is flowing. In this case, integrate power × time from all
    // EnergyReadings stored during this session (each ~500ms apart).
    // This gives accurate billing regardless of PZEM resolution limits.
    if (finalKwh === 0 && session.startedAt) {
      const readings = await prisma.energyReading.findMany({
        where:   { sessionId },
        orderBy: { createdAt: "asc" },
        select:  { createdAt: true, power: true },
      });

      if (readings.length >= 2) {
        let integratedKwh = 0;
        for (let i = 1; i < readings.length; i++) {
          const dtSeconds =
            (readings[i].createdAt.getTime() - readings[i - 1].createdAt.getTime()) / 1000;
          // Guard against large gaps (> 5s) which indicate missing readings, not real time
          const clampedDt = Math.min(dtSeconds, 5);
          integratedKwh += (readings[i].power / 1000) * (clampedDt / 3600); // kWh
        }
        finalKwh = parseFloat(integratedKwh.toFixed(5));
        console.log(`[SESSION] Power integration used: ${finalKwh} kWh (${readings.length} readings)`);
      } else if (session.startedAt) {
        // Fewer than 2 readings — use duration × last known power as rough estimate
        const durationHours =
          (Date.now() - new Date(session.startedAt).getTime()) / 3_600_000;
        const powerKw = (latestReading?.power ?? 0) / 1000;
        finalKwh = parseFloat((powerKw * durationHours).toFixed(5));
        console.log(`[SESSION] Duration fallback: ${finalKwh} kWh`);
      }
    }

    // ── Calculate billing ──────────────────────────────────────────────────────
    const packagePaise = session.booking.packagePaise;
    const kwhLimit     = session.booking.kwhLimit;
    const ratePerKwh   = packagePaise / kwhLimit;

    // If finalKwh >= 90% of kwhLimit, treat as fully consumed — charge full package.
    // This handles power integration timing imprecision: the app's progress bar hits
    // 100% and calls /stop, but the integration at that exact moment gives 0.0038
    // instead of 0.005 kWh, causing partial refunds on fully-consumed packages.
    // Only give a partial refund for genuine early stops (< 90% consumed).
    const billedKwh   = finalKwh >= kwhLimit * 0.9 ? kwhLimit : finalKwh;
    const usedPaise   = billedKwh >= kwhLimit ? packagePaise : Math.ceil(billedKwh * ratePerKwh);
    const refundPaise = Math.max(0, packagePaise - usedPaise);

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
              note:         `Session ended: used ${billedKwh.toFixed(3)} kWh of ${kwhLimit} kWh package`,
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
          finalKwh:    billedKwh,
          refundTxnId,
        },
      });
    });

    // ── Hardware commands ──────────────────────────────────────────────────────
    const topic = session.charger.mqttTopic ?? "pb_device_01";
    mqttPublish(`${topic}/command`, "RELAY_OFF");
    // SOLENOID_UNLOCK is NOT sent here — user taps "Unlock to retrieve cable"
    // on the complete screen which calls POST /sessions/unlock-cable.
    // This gives user control over when the lid opens.
    mqttPublish(`${topic}/command`, "RESET_ENERGY");

    console.log(`[SESSION] Session ${sessionId} stopped — kWh=${billedKwh.toFixed(5)} used=₹${usedPaise / 100} refund=₹${refundPaise / 100}`);

    return res.json({
      ok:         true,
      sessionId,
      finalKwh:   billedKwh,
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

    // noLoad: true when PZEM hasn't sent a reading in the last 3 seconds.
    // During charging, readings arrive every 500ms. If the last reading is
    // older than 3 seconds, the firmware has gone no_load (plug removed).
    // The app uses this for instant plug-removal detection instead of waiting
    // 60 seconds for the kWh counter to stop advancing.
    const secondsSinceReading = latest
      ? (Date.now() - new Date(latest.createdAt).getTime()) / 1000
      : 999;
    const noLoad = secondsSinceReading > 3;

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
      noLoad,              // true = plug removed, app should freeze billing instantly
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

// ─────────────────────────────────────────────────────────────────────────────
// GET /sessions/history/:userId
// Returns all ENDED sessions for a user — used by StatusScreen history list.
// Each session includes charger name, duration, kWh used, amount charged,
// and refund amount so the app can display a complete charging history.
// ─────────────────────────────────────────────────────────────────────────────
router.get("/history/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const sessions = await prisma.session.findMany({
      where: {
        userId,
        status: SessionStatus.ENDED,
      },
      include: {
        charger: true,
        booking: true,
      },
      orderBy: { endedAt: "desc" },
      take: 50, // cap at 50 most recent sessions
    });

    const result = sessions.map((s) => {
      // Duration in minutes from startedAt → endedAt
      const durationMin =
        s.startedAt && s.endedAt
          ? Math.round(
              (new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()) /
              60_000
            )
          : 0;

      const kwhLimit   = s.booking.kwhLimit;
      const pkgPaise   = s.booking.packagePaise;
      const ratePerKwh = pkgPaise / kwhLimit;
      const finalKwh   = s.finalKwh ?? 0;
      const usedPaise  = Math.ceil(finalKwh * ratePerKwh);
      const refundPaise = Math.max(0, pkgPaise - usedPaise);

      return {
        id:          s.id,
        chargerName: s.charger.name,
        packageName: s.booking.packageName,
        startedAt:   s.startedAt?.toISOString() ?? null,
        endedAt:     s.endedAt?.toISOString()   ?? null,
        durationMin,
        usedKwh:     parseFloat(finalKwh.toFixed(3)),
        usedInr:     usedPaise   / 100,
        refundInr:   refundPaise / 100,
      };
    });

    return res.json({ ok: true, sessions: result });

  } catch (err) {
    console.error("[SESSION] /history error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /sessions/reopen-lid
// Body: { sessionId: number }
//
// Resends SOLENOID_UNLOCK for an existing PLUG_WAIT session.
// Used when user didn't open the lid in time and solenoid auto-locked.
// No booking check needed — session already exists and is valid.
// ─────────────────────────────────────────────────────────────────────────────
router.post("/reopen-lid", async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body as { sessionId?: number };

    if (typeof sessionId !== "number")
      return res.status(400).json({ ok: false, error: "sessionId must be a number" });

    const session = await prisma.session.findUnique({
      where:   { id: sessionId },
      include: { charger: true },
    });

    if (!session)
      return res.status(404).json({ ok: false, error: "Session not found" });

    if (session.status !== SessionStatus.PLUG_WAIT)
      return res.status(409).json({ ok: false, error: "Session is not in PLUG_WAIT" });

    const topic = session.charger.mqttTopic ?? "pb_device_01";
    mqttPublish(`${topic}/door`, "SOLENOID_UNLOCK");

    console.log(`[SESSION] reopen-lid → SOLENOID_UNLOCK for session ${sessionId}`);

    return res.json({ ok: true, sessionId });

  } catch (err) {
    console.error("[SESSION] /reopen-lid error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /sessions/unlock-cable
// Body: { sessionId: number, userId: string }
//
// Called from the complete screen when user taps "Unlock to retrieve cable".
// Only works on ENDED sessions — session must belong to the requesting user.
// Sends SOLENOID_UNLOCK to hardware. Idempotent — safe to call multiple times.
// ─────────────────────────────────────────────────────────────────────────────
router.post("/unlock-cable", async (req: Request, res: Response) => {
  try {
    const { sessionId, userId } = req.body as {
      sessionId?: number;
      userId?:    string;
    };

    if (typeof sessionId !== "number")
      return res.status(400).json({ ok: false, error: "sessionId must be a number" });
    if (!userId)
      return res.status(400).json({ ok: false, error: "userId is required" });

    const session = await prisma.session.findUnique({
      where:   { id: sessionId },
      include: { charger: true },
    });

    if (!session)
      return res.status(404).json({ ok: false, error: "Session not found" });

    // Security: only the session owner can unlock
    if (session.userId !== userId)
      return res.status(403).json({ ok: false, error: "Not your session" });

    // Only unlock for ended sessions — not for active or failed
    if (session.status !== SessionStatus.ENDED)
      return res.status(409).json({ ok: false, error: "Session is not ended" });

    const topic = session.charger.mqttTopic ?? "pb_device_01";
    mqttPublish(`${topic}/door`, "SOLENOID_UNLOCK");

    console.log(`[SESSION] unlock-cable → SOLENOID_UNLOCK for session ${sessionId}`);

    return res.json({ ok: true, sessionId });

  } catch (err) {
    console.error("[SESSION] /unlock-cable error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

export default router;