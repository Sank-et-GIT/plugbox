// ─────────────────────────────────────────────────────────────────────────────
// src/jobs/sessionTimeout.ts — Bug-fixed version
//
// Fix: Uses plugWaitStartedAt for 3min timeout — not fragile updatedAt
//      plugWaitStartedAt is set by mqttHandler when button pressed + door closed
//      It never changes after that → reliable 3min timeout
// ─────────────────────────────────────────────────────────────────────────────

import prisma from "../lib/prismaClient";
import { SessionStatus, WalletTxnType } from "@prisma/client";
import { mqttPublish } from "../mqtt/mqttClient";



const PLUG_WAIT_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes

export async function runSessionTimeout(): Promise<void> {
  const now = new Date();

  // ── Case 1: PLUG_WAIT timeout (3 minutes) ────────────────────────────────
  // FIX: uses plugWaitStartedAt — set once when session enters PLUG_WAIT
  //      NOT updatedAt which resets on every change
  const timedOutSessions = await prisma.session.findMany({
    where: {
      status:           SessionStatus.PLUG_WAIT,
      plugWaitStartedAt: {
        not: null,
        lt:  new Date(now.getTime() - PLUG_WAIT_TIMEOUT_MS)
      }
    },
    include: { charger: true, booking: true }
  });

  for (const session of timedOutSessions) {
    try {
      await prisma.$transaction(async (tx) => {
        const wallet = await tx.wallet.findUnique({
          where: { userId: session.userId }
        });

        let refundTxnId: string | null = null;

        if (wallet && session.booking.packagePaise > 0) {
          const newBalance = wallet.balance + session.booking.packagePaise;
          await tx.wallet.update({
            where: { userId: session.userId },
            data:  { balance: newBalance }
          });
          const refundTxn = await tx.walletTransaction.create({
            data: {
              walletId:     wallet.id,
              type:         WalletTxnType.REFUND,
              amountPaise:  session.booking.packagePaise,
              balancePaise: newBalance,
              note:         "Session timeout: lid not closed in 3 minutes — full refund",
              sessionId:    session.id,
            }
          });
          refundTxnId = refundTxn.id;
        }

        await tx.session.update({
          where: { id: session.id },
          data:  {
            status:      SessionStatus.FAILED,
            endedAt:     now,
            finalKwh:    0,
            refundTxnId,
          }
        });
      });

      const topic = session.charger.mqttTopic ?? "pb_device_01";
      mqttPublish(`${topic}/command`, "RELAY_OFF");
      mqttPublish(`${topic}/door`,    "SOLENOID_LOCK");
      mqttPublish(`${topic}/command`, "RESET_ENERGY");

      console.log(`[TIMEOUT] Session ${session.id} → FAILED (3min lid timeout) refund=₹${session.booking.packagePaise / 100}`);

    } catch (err) {
      console.error(`[TIMEOUT] Error in session ${session.id}:`, err);
    }
  }

  // ── Case 2: Auto-stop when kWh limit reached ─────────────────────────────
  const activeSessions = await prisma.session.findMany({
    where:   { status: SessionStatus.ACTIVE },
    include: { charger: true, booking: true }
  });

  for (const session of activeSessions) {
    try {
      const latest = await prisma.energyReading.findFirst({
        where:   { sessionId: session.id },
        orderBy: { createdAt: "desc" },
      });

      if (!latest) continue;

      if (latest.energyKwh < session.booking.kwhLimit) continue;

      // Package fully used — auto-stop, no refund
      await prisma.session.update({
        where: { id: session.id },
        data:  {
          status:   SessionStatus.ENDED,
          endedAt:  now,
          finalKwh: latest.energyKwh,
        }
      });

      const topic = session.charger.mqttTopic ?? "pb_device_01";
      mqttPublish(`${topic}/command`, "RELAY_OFF");
      mqttPublish(`${topic}/door`,    "SOLENOID_UNLOCK");
      mqttPublish(`${topic}/command`, "RESET_ENERGY");

      console.log(`[TIMEOUT] Session ${session.id} auto-stopped: ${latest.energyKwh} kWh ≥ ${session.booking.kwhLimit} kWh`);

    } catch (err) {
      console.error(`[TIMEOUT] Auto-stop error session ${session.id}:`, err);
    }
  }
}

export function startSessionTimeout(): void {
  console.log("[TIMEOUT] Session timeout job started (every 10s)");
  setInterval(runSessionTimeout, 10_000);
}