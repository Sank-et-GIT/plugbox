// ─────────────────────────────────────────────────────────────────────────────
// src/jobs/sessionTimeout.ts
//
// Background job — runs every 10 seconds via setInterval.
//
// Responsibilities:
//   1. PLUG_WAIT timeout (5 min) — user opened lid but never closed it.
//      Session → FAILED, full refund, RELAY_OFF + SOLENOID_LOCK sent.
//
//   2. UNLOCK_SENT timeout (2 min) — session stuck in UNLOCK_SENT state,
//      which means the server may have crashed between UNLOCK_SENT and PLUG_WAIT
//      DB updates. Fail and refund so user is not left in limbo.
//
//   3. Auto-stop when kWh limit reached — checks ACTIVE sessions against their
//      kwhLimit using kwhAtStart delta. Session → ENDED, RELAY_OFF sent.
//
//   4. Charger offline cron — marks chargers OFFLINE if lastSeen > 2 minutes.
//      Relies on /data heartbeat (throttled 30s) and /status to keep lastSeen fresh.
//
// Fixes in this version:
//   • UNLOCK_SENT timeout added (new)
//   • Charger offline cron added (new)
//   • BookingStatus → FAILED on session timeout failure
//   • Auto-stop uses kwhAtStart delta for accurate kWh limit comparison
// ─────────────────────────────────────────────────────────────────────────────

import prisma from "../lib/prismaClient";
import { SessionStatus, BookingStatus, WalletTxnType } from "@prisma/client";
import { mqttPublish } from "../mqtt/mqttClient";

// How long a session can stay in PLUG_WAIT before we give up and refund.
// Hardware sends door_open_timeout after ~2min — this is a backend safety net.
const PLUG_WAIT_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

// How long before we assume an UNLOCK_SENT session got stuck (server crash
// between UNLOCK_SENT and PLUG_WAIT DB update). Should be very short.
const UNLOCK_SENT_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes

// How long since lastSeen before we mark a charger OFFLINE.
// /data heartbeat updates lastSeen every 30s → 2min = 4 missed heartbeats.
const CHARGER_OFFLINE_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes

// ─────────────────────────────────────────────────────────────────────────────
// Main job function — called every 10 seconds
// ─────────────────────────────────────────────────────────────────────────────
export async function runSessionTimeout(): Promise<void> {
  const now = new Date();

  await runPlugWaitTimeout(now);
  await runUnlockSentTimeout(now);
  await runAutoStop(now);
  await runChargerOfflineCron(now);
}

// ─────────────────────────────────────────────────────────────────────────────
// Case 1: PLUG_WAIT timeout
// Session has been waiting for lid to close for > 5 minutes.
// User likely left without charging — fail and refund.
// ─────────────────────────────────────────────────────────────────────────────
async function runPlugWaitTimeout(now: Date): Promise<void> {
  const cutoff = new Date(now.getTime() - PLUG_WAIT_TIMEOUT_MS);

  const timedOutSessions = await prisma.session.findMany({
    where: {
      status:            SessionStatus.PLUG_WAIT,
      plugWaitStartedAt: { not: null, lt: cutoff },
    },
    include: { charger: true, booking: true },
  });

  for (const session of timedOutSessions) {
    try {
      let alreadyHandled = false;

      await prisma.$transaction(async (tx) => {
        // Atomic claim — prevents race with concurrent door_closed or emergency_stop events
        const claimed = await tx.session.updateMany({
          where: { id: session.id, status: SessionStatus.PLUG_WAIT },
          data:  { status: SessionStatus.FAILED, endedAt: now, finalKwh: 0 },
        });

        if (claimed.count === 0) {
          alreadyHandled = true;
          return; // another event already handled this session
        }

        // Full refund — user never charged anything
        let refundTxnId: string | null = null;
        if (session.booking.packagePaise > 0) {
          const wallet = await tx.wallet.findUnique({ where: { userId: session.userId } });
          if (wallet) {
            const newBalance = wallet.balance + session.booking.packagePaise;
            await tx.wallet.update({
              where: { userId: session.userId },
              data:  { balance: newBalance },
            });
            const refundTxn = await tx.walletTransaction.create({
              data: {
                walletId:     wallet.id,
                type:         WalletTxnType.REFUND,
                amountPaise:  session.booking.packagePaise,
                balancePaise: newBalance,
                note:         "Full refund — lid not closed within 5 minutes",
                sessionId:    session.id,
              },
            });
            refundTxnId = refundTxn.id;
          }
        }

        if (refundTxnId) {
          await tx.session.update({
            where: { id: session.id },
            data:  { refundTxnId },
          });
        }

        // Mark booking FAILED so it cannot be accidentally reused
        await tx.booking.update({
          where: { id: session.bookingId },
          data:  { status: BookingStatus.FAILED },
        });
      });

      if (alreadyHandled) {
        console.log(`[TIMEOUT] PLUG_WAIT session ${session.id} already handled by concurrent event — skipped`);
        continue;
      }

      // Send hardware commands after DB is committed
      const topic = session.charger.mqttTopic ?? "pb_device_01";
      mqttPublish(`${topic}/command`, "RELAY_OFF");
      mqttPublish(`${topic}/door`,    "SOLENOID_LOCK"); // lock lid — session is over
      mqttPublish(`${topic}/command`, "RESET_ENERGY");

      console.log(
        `[TIMEOUT] Session ${session.id} → FAILED (5min lid timeout) ` +
        `refund=₹${session.booking.packagePaise / 100}`
      );

    } catch (err) {
      console.error(`[TIMEOUT] Error handling PLUG_WAIT timeout for session ${session.id}:`, err);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Case 2: UNLOCK_SENT timeout
// Session stuck in UNLOCK_SENT for > 2 minutes.
// This should never happen under normal operation because /sessions/start
// immediately advances to PLUG_WAIT after UNLOCK_SENT. If we see this, it
// means the server crashed between those two DB writes. Fail and refund.
// ─────────────────────────────────────────────────────────────────────────────
async function runUnlockSentTimeout(now: Date): Promise<void> {
  const cutoff = new Date(now.getTime() - UNLOCK_SENT_TIMEOUT_MS);

  const stuckSessions = await prisma.session.findMany({
    where: {
      status:    SessionStatus.UNLOCK_SENT,
      createdAt: { lt: cutoff }, // createdAt ≈ time it entered UNLOCK_SENT
    },
    include: { charger: true, booking: true },
  });

  for (const session of stuckSessions) {
    try {
      let alreadyHandled = false;

      await prisma.$transaction(async (tx) => {
        // Atomic claim
        const claimed = await tx.session.updateMany({
          where: { id: session.id, status: SessionStatus.UNLOCK_SENT },
          data:  { status: SessionStatus.FAILED, endedAt: now, finalKwh: 0 },
        });

        if (claimed.count === 0) {
          alreadyHandled = true;
          return;
        }

        // Full refund — session never progressed
        let refundTxnId: string | null = null;
        if (session.booking.packagePaise > 0) {
          const wallet = await tx.wallet.findUnique({ where: { userId: session.userId } });
          if (wallet) {
            const newBalance = wallet.balance + session.booking.packagePaise;
            await tx.wallet.update({
              where: { userId: session.userId },
              data:  { balance: newBalance },
            });
            const refundTxn = await tx.walletTransaction.create({
              data: {
                walletId:     wallet.id,
                type:         WalletTxnType.REFUND,
                amountPaise:  session.booking.packagePaise,
                balancePaise: newBalance,
                note:         "Full refund — session stuck in UNLOCK_SENT (server recovery)",
                sessionId:    session.id,
              },
            });
            refundTxnId = refundTxn.id;
          }
        }

        if (refundTxnId) {
          await tx.session.update({
            where: { id: session.id },
            data:  { refundTxnId },
          });
        }

        await tx.booking.update({
          where: { id: session.bookingId },
          data:  { status: BookingStatus.FAILED },
        });
      });

      if (alreadyHandled) continue;

      // Attempt RELAY_OFF + SOLENOID_LOCK — may be a no-op if hardware never received unlock
      const topic = session.charger.mqttTopic ?? "pb_device_01";
      mqttPublish(`${topic}/command`, "RELAY_OFF");
      mqttPublish(`${topic}/door`,    "SOLENOID_LOCK");

      console.log(
        `[TIMEOUT] Session ${session.id} → FAILED (UNLOCK_SENT stuck > 2min, server recovery) ` +
        `refund=₹${session.booking.packagePaise / 100}`
      );

    } catch (err) {
      console.error(`[TIMEOUT] Error handling UNLOCK_SENT timeout for session ${session.id}:`, err);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Case 3: Auto-stop when kWh package limit is reached
// Checks all ACTIVE sessions — if the kWh used (delta from kwhAtStart)
// has reached the booked limit, stop the session automatically.
// ─────────────────────────────────────────────────────────────────────────────
async function runAutoStop(now: Date): Promise<void> {
  const activeSessions = await prisma.session.findMany({
    where:   { status: SessionStatus.ACTIVE },
    include: { charger: true, booking: true },
  });

  for (const session of activeSessions) {
    try {
      const latest = await prisma.energyReading.findFirst({
        where:   { sessionId: session.id },
        orderBy: { createdAt: "desc" },
      });

      if (!latest) continue;

      // Use kwhAtStart delta for accurate comparison — same as /stop and /meter
      const kwhAtStart = session.kwhAtStart ?? 0;
      const usedKwh    = Math.max(0, latest.energyKwh - kwhAtStart);

      if (usedKwh < session.booking.kwhLimit) continue;

      // Package fully consumed — stop session, no refund (full package used)
      await prisma.session.update({
        where: { id: session.id },
        data:  {
          status:   SessionStatus.ENDED,
          endedAt:  now,
          finalKwh: usedKwh,
        },
      });

      const topic = session.charger.mqttTopic ?? "pb_device_01";
      mqttPublish(`${topic}/command`, "RELAY_OFF");
      // SOLENOID_UNLOCK not sent here — user taps "Unlock to retrieve cable"
      // on the complete screen (POST /sessions/unlock-cable).
      mqttPublish(`${topic}/command`, "RESET_ENERGY");

      console.log(
        `[TIMEOUT] Session ${session.id} auto-stopped — ` +
        `used=${usedKwh.toFixed(3)} kWh ≥ limit=${session.booking.kwhLimit} kWh`
      );

    } catch (err) {
      console.error(`[TIMEOUT] Auto-stop error for session ${session.id}:`, err);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Case 4: Charger offline cron
// If a charger's lastSeen is older than 2 minutes and it is still marked ONLINE,
// mark it OFFLINE. This catches silent hardware crashes and network drops that
// don't trigger the MQTT LWT (last-will-testament) offline message.
// ─────────────────────────────────────────────────────────────────────────────
async function runChargerOfflineCron(now: Date): Promise<void> {
  const cutoff = new Date(now.getTime() - CHARGER_OFFLINE_THRESHOLD_MS);

  const result = await prisma.charger.updateMany({
    where: {
      status:   "ONLINE",
      lastSeen: { lt: cutoff }, // hasn't sent /data or /status for > 2min
    },
    data: { status: "OFFLINE" },
  });

  if (result.count > 0) {
    console.log(`[TIMEOUT] Marked ${result.count} charger(s) OFFLINE (lastSeen > 2min)`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Start the job — called once from app.ts on server startup
// ─────────────────────────────────────────────────────────────────────────────
export function startSessionTimeout(): void {
  console.log("[TIMEOUT] Session timeout job started (runs every 10s)");
  // Run once immediately on startup to catch any sessions left over from
  // a previous server crash, then continue every 10 seconds
  runSessionTimeout().catch(console.error);
  setInterval(runSessionTimeout, 10_000);
}