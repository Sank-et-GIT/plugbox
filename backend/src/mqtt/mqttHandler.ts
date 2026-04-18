// ─────────────────────────────────────────────────────────────────────────────
// src/mqtt/mqttHandler.ts
//
// Does NOT import from mqttClient (circular import removed).
// mqttPublish and subscribeAllChargers are injected via initMqttHandler()
// called from app.ts after both modules are loaded.
//
// Fixes in this version:
//   1. Race condition: door_closed + current detection both advancing
//      PLUG_WAIT → ACTIVE — now uses updateMany() with status guard so
//      only the first call wins; second call is a safe no-op.
//   2. Race condition: door_open_timeout + emergency_stop arriving together
//      causing double refund — session is atomically claimed inside $transaction
//      before any refund is issued.
//   3. kwhAtStart stored when session → ACTIVE (billing baseline).
//   4. Device reboot detection: if device comes online with an ACTIVE session,
//      the session is failed and user is refunded (relay state unknown).
//   5. BookingStatus → FAILED when session fails.
// ─────────────────────────────────────────────────────────────────────────────

import {
  SessionStatus,
  BookingStatus,
  CommandStatus,
  CommandType,
  WalletTxnType,
} from "@prisma/client";
import prisma          from "../lib/prismaClient";
import { traceMqtt }  from "../lib/trace";

// Injected from app.ts to break circular import
let _mqttPublish:          (topic: string, message: string) => void;
let _subscribeAllChargers: () => Promise<void>;

// Throttle charger online status DB writes — max once per 30s per device
// (PZEM sends /data every ~500ms — without throttle that's ~60 DB writes/min)
const _lastOnlineUpdate = new Map<string, number>();

export function initMqttHandler(
  publishFn:      (topic: string, message: string) => void,
  subscribeAllFn: () => Promise<void>
): void {
  _mqttPublish          = publishFn;
  _subscribeAllChargers = subscribeAllFn;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main MQTT message router
// Parses topic suffix and dispatches to the right handler.
// Topic format: {deviceTopic}/{suffix}  e.g. pb_device_01/data
// ─────────────────────────────────────────────────────────────────────────────
export async function handleMqttMessage(topic: string, payload: string): Promise<void> {
  try {
    const lastSlash = topic.lastIndexOf("/");
    if (lastSlash === -1) return;

    const mqttTopic = topic.substring(0, lastSlash); // e.g. "pb_device_01"
    const suffix    = topic.substring(lastSlash + 1); // e.g. "data"

    switch (suffix) {
      case "data":   await handleEnergyData(mqttTopic, payload);   break;
      case "ir":     await handleIrEvent(mqttTopic, payload);      break;
      case "status": await handleDeviceStatus(mqttTopic, payload); break;
      default:
        traceMqtt("info", { topic: mqttTopic, message: `Unhandled suffix '${suffix}' on topic ${topic}` });
    }
  } catch (err) {
    console.error(`[MQTT] Unhandled error on topic ${topic}:`, err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: find charger row by its MQTT topic string
// ─────────────────────────────────────────────────────────────────────────────
async function findCharger(mqttTopic: string) {
  return prisma.charger.findFirst({ where: { mqttTopic } });
}

// ─────────────────────────────────────────────────────────────────────────────
// /data handler — PZEM-004T energy telemetry
//
// Responsibilities:
//   • Throttled charger heartbeat (ONLINE + lastSeen), max 1 DB write per 30s
//   • Store EnergyReading linked to active session
//   • Fallback ACTIVE transition: if door_closed event was missed but current
//     is detected, advance PLUG_WAIT → ACTIVE (uses updateMany race guard)
// ─────────────────────────────────────────────────────────────────────────────
async function handleEnergyData(mqttTopic: string, payload: string): Promise<void> {
  let data: any;
  try { data = JSON.parse(payload); }
  catch { console.warn("[MQTT] Invalid JSON on /data:", payload); return; }

  // ── Heartbeat: mark charger ONLINE (throttled to once per 30s) ─────────────
  const now        = Date.now();
  const lastUpdate = _lastOnlineUpdate.get(mqttTopic) ?? 0;
  if (now - lastUpdate > 30_000) {
    _lastOnlineUpdate.set(mqttTopic, now);
    const hbCharger = await findCharger(mqttTopic);
    if (hbCharger) {
      await prisma.charger.update({
        where: { id: hbCharger.id },
        data:  { status: "ONLINE", lastSeen: new Date() },
      });
      if (hbCharger.status !== "ONLINE") {
        traceMqtt("info", { topic: mqttTopic, message: "Charger back ONLINE (detected via /data heartbeat)" });
      }
    }
  }

  // ── no_load status: relay is OFF, only current might still be residual ──────
  // Still check for current on PLUG_WAIT sessions as a fallback path
  if (data.status === "no_load") {
    if (typeof data.current === "number" && data.current >= 0.05) {
      const charger = await findCharger(mqttTopic);
      if (!charger) return;

      const plugWaitSession = await prisma.session.findFirst({
        where:   { chargerId: charger.id, status: SessionStatus.PLUG_WAIT },
        orderBy: { createdAt: "desc" },
      });

      if (plugWaitSession) {
        // RACE FIX: updateMany with status guard — if door_closed already
        // advanced this session, count will be 0 and we skip silently.
        const kwhAtStart = typeof data.energy === "number" ? data.energy : 0;
        const claimed = await prisma.session.updateMany({
          where: { id: plugWaitSession.id, status: SessionStatus.PLUG_WAIT },
          data:  { status: SessionStatus.ACTIVE, startedAt: new Date(), kwhAtStart },
        });
        if (claimed.count > 0) {
          traceMqtt("info", { topic: mqttTopic, message: `Session ${plugWaitSession.id} → ACTIVE (no_load current fallback, kwhAtStart=${kwhAtStart})` });
        }
      }
    }
    return;
  }

  // ── Validate all required PZEM fields are present ──────────────────────────
  if (
    typeof data.voltage   !== "number" ||
    typeof data.current   !== "number" ||
    typeof data.power     !== "number" ||
    typeof data.energy    !== "number" ||
    typeof data.frequency !== "number" ||
    typeof data.pf        !== "number"
  ) {
    console.warn("[MQTT] Missing numeric fields in /data payload:", payload);
    return;
  }

  const charger = await findCharger(mqttTopic);
  if (!charger) return;

  // ── Find session to link this reading to ───────────────────────────────────
  const activeSession = await prisma.session.findFirst({
    where: {
      chargerId: charger.id,
      status:    { in: [SessionStatus.PLUG_WAIT, SessionStatus.ACTIVE] },
    },
    orderBy: { createdAt: "desc" },
  });

  // ── Store EnergyReading ────────────────────────────────────────────────────
  await prisma.energyReading.create({
    data: {
      chargerId:   charger.id,
      sessionId:   activeSession?.id ?? null,
      voltage:     data.voltage,
      current:     data.current,
      power:       data.power,
      energyKwh:   data.energy,
      frequency:   data.frequency,
      powerFactor: data.pf,
    },
  });

  // ── Fallback: current detected → PLUG_WAIT → ACTIVE ───────────────────────
  // Primary path is door_closed IR event. This fires if that event was missed.
  // RACE FIX: updateMany with status guard so door_closed and this fallback
  // cannot both set startedAt — only whichever runs first wins.
  if (data.current >= 0.05 && activeSession?.status === SessionStatus.PLUG_WAIT) {
    const claimed = await prisma.session.updateMany({
      where: { id: activeSession.id, status: SessionStatus.PLUG_WAIT },
      data:  { status: SessionStatus.ACTIVE, startedAt: new Date(), kwhAtStart: data.energy },
    });
    if (claimed.count > 0) {
      traceMqtt("info", { topic: mqttTopic, message: `Session ${activeSession.id} → ACTIVE (current fallback: ${data.current}A, kwhAtStart=${data.energy})` });
    }
    // If count === 0, door_closed already won the race — that's fine, no action needed
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// /ir handler — IR sensor + button events from hardware
//
// Events:
//   button_pressed    → publish RELAY_ON  to {topic}/command
//   door_closed       → publish SOLENOID_LOCK, session PLUG_WAIT → ACTIVE
//   door_open_timeout → publish RELAY_OFF, session → FAILED, full refund
//   emergency_stop    → publish RELAY_OFF, session → FAILED, full refund
//   ir_clear          → ignore (informational only)
// ─────────────────────────────────────────────────────────────────────────────
async function handleIrEvent(mqttTopic: string, payload: string): Promise<void> {
  let data: any;
  try { data = JSON.parse(payload); }
  catch { console.warn("[MQTT] Invalid JSON on /ir:", payload); return; }

  traceMqtt("info", { topic: mqttTopic, message: `IR event received: ${payload}` });

  // Null check — charger must exist in DB before we can do anything
  const charger = await findCharger(mqttTopic);
  if (!charger) {
    console.warn(`[MQTT] handleIrEvent: no charger found for topic '${mqttTopic}' — register device first`);
    return;
  }

  switch (data.event) {
    case "button_pressed":
      // User pressed physical button inside lid → turn relay ON to start power flow.
      // Session stays PLUG_WAIT until door_closed confirms lid is shut.
      _mqttPublish(`${mqttTopic}/command`, "RELAY_ON");
      traceMqtt("info", { topic: mqttTopic, message: "button_pressed → RELAY_ON published" });
      break;

    case "door_closed":
      // Lid physically closed with plug inserted → lock solenoid + advance session to ACTIVE.
      await handleDoorClosed(charger.id, mqttTopic);
      break;

    case "door_open_timeout":
      // Lid stayed open longer than the hardware timeout → abort, full refund.
      await handleSessionFail(charger.id, mqttTopic, "door_open_timeout");
      break;

    case "emergency_stop":
      // Physical emergency button pressed → abort immediately, full refund.
      await handleSessionFail(charger.id, mqttTopic, "emergency_stop");
      break;

    case "ir_clear":
      // IR beam unblocked — informational only, no backend action needed.
      traceMqtt("info", { topic: mqttTopic, message: "ir_clear received — informational, no action" });
      break;

    default:
      traceMqtt("info", { topic: mqttTopic, message: `Unrecognised IR event: '${data.event}'` });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// door_closed handler
//
// Called when hardware confirms lid is physically closed.
// 1. Locks solenoid
// 2. Advances session PLUG_WAIT → ACTIVE and records kwhAtStart
//
// RACE FIX: uses updateMany() with status: PLUG_WAIT so that if the current-
// detection fallback in handleEnergyData already moved the session to ACTIVE,
// this becomes a safe no-op (count === 0).
// ─────────────────────────────────────────────────────────────────────────────
async function handleDoorClosed(chargerId: number, mqttTopic: string): Promise<void> {
  // Find the session waiting for door confirmation
  const session = await prisma.session.findFirst({
    where:   { chargerId, status: SessionStatus.PLUG_WAIT },
    orderBy: { createdAt: "desc" },
  });

  if (!session) {
    // No PLUG_WAIT session — check if user just closed lid after a completed session
    // In that case we re-lock the solenoid to secure the charger for the next user
    const endedSession = await prisma.session.findFirst({
      where:   { chargerId, status: SessionStatus.ENDED },
      orderBy: { createdAt: "desc" },
    });
    if (endedSession) {
      _mqttPublish(`${mqttTopic}/door`, "SOLENOID_LOCK");
      traceMqtt("info", { topic: mqttTopic, message: "door_closed after ENDED session → SOLENOID_LOCK (charger secured)" });
    } else {
      traceMqtt("info", { topic: mqttTopic, message: "door_closed — no PLUG_WAIT session found, ignored" });
    }
    return;
  }

  // Get latest PZEM reading to use as billing baseline (kwhAtStart).
  // Stored now so billing delta = finalKwh - kwhAtStart at session end.
  const latestReading = await prisma.energyReading.findFirst({
    where:   { chargerId },
    orderBy: { createdAt: "desc" },
  });
  const kwhAtStart = latestReading?.energyKwh ?? 0;

  // Lock solenoid — lid is closed, cable is secured inside
  _mqttPublish(`${mqttTopic}/door`, "SOLENOID_LOCK");

  // RACE FIX: updateMany with status guard.
  // If current-detection fallback already moved session to ACTIVE, count === 0
  // and we skip — no duplicate startedAt, no billing baseline overwrite.
  const claimed = await prisma.session.updateMany({
    where: { id: session.id, status: SessionStatus.PLUG_WAIT },
    data:  { status: SessionStatus.ACTIVE, startedAt: new Date(), kwhAtStart },
  });

  if (claimed.count > 0) {
    traceMqtt("info", { topic: mqttTopic, message: `door_closed → SOLENOID_LOCK + Session ${session.id} → ACTIVE (kwhAtStart=${kwhAtStart})` });
  } else {
    // Current detection won the race — ACTIVE was already set. Solenoid is still locked above. ✓
    traceMqtt("info", { topic: mqttTopic, message: `door_closed → SOLENOID_LOCK (session ${session.id} already ACTIVE from current fallback)` });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// handleSessionFail — shared by door_open_timeout, emergency_stop, device_reboot
//
// Safety order:
//   1. RELAY_OFF published immediately (before any DB work)
//   2. Session atomically claimed inside $transaction (prevents double-refund
//      if two events arrive simultaneously, e.g. timeout + emergency_stop)
//   3. Full packagePaise refund issued
//   4. Booking marked FAILED
//
// RACE FIX: the first step inside $transaction is updateMany with status filter.
// Only the call that actually changes a row (count > 0) proceeds with the refund.
// The second concurrent call sees count === 0 and exits cleanly — no double refund.
// ─────────────────────────────────────────────────────────────────────────────
async function handleSessionFail(
  chargerId: number,
  mqttTopic: string,
  reason:    string
): Promise<void> {
  // Always send RELAY_OFF first — hardware safety takes priority over DB consistency
  _mqttPublish(`${mqttTopic}/command`, "RELAY_OFF");

  // Find the session to fail (PLUG_WAIT or ACTIVE)
  const session = await prisma.session.findFirst({
    where: {
      chargerId,
      status: { in: [SessionStatus.PLUG_WAIT, SessionStatus.ACTIVE] },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!session) {
    traceMqtt("warn", { topic: mqttTopic, message: `${reason} — RELAY_OFF sent but no active session found` });
    return;
  }

  const booking = await prisma.booking.findUnique({ where: { id: session.bookingId } });

  // Track whether this call was the one that actually claimed the session
  let alreadyHandled = false;

  await prisma.$transaction(async (tx) => {
    // RACE FIX: atomically mark session FAILED.
    // If two events (e.g. door_open_timeout + emergency_stop) arrive at the same
    // time, only the first transaction that runs this update will see count > 0.
    const claimed = await tx.session.updateMany({
      where: {
        id:     session.id,
        status: { in: [SessionStatus.PLUG_WAIT, SessionStatus.ACTIVE] },
      },
      data: { status: SessionStatus.FAILED, endedAt: new Date() },
    });

    if (claimed.count === 0) {
      // Another concurrent event already failed this session — nothing to do
      alreadyHandled = true;
      return; // commits empty transaction (no harm done)
    }

    // ── Issue full refund ────────────────────────────────────────────────────
    let refundTxnId: string | null = null;

    if (booking && booking.packagePaise > 0) {
      const wallet = await tx.wallet.findUnique({ where: { userId: session.userId } });
      if (wallet) {
        const newBalance = wallet.balance + booking.packagePaise;

        await tx.wallet.update({
          where: { userId: session.userId },
          data:  { balance: newBalance },
        });

        const refundTxn = await tx.walletTransaction.create({
          data: {
            walletId:     wallet.id,
            type:         WalletTxnType.REFUND,
            amountPaise:  booking.packagePaise,
            balancePaise: newBalance,
            note:         `Full refund — session failed: ${reason}`,
            sessionId:    session.id,
          },
        });
        refundTxnId = refundTxn.id;

        traceMqtt("info", { topic: mqttTopic, message: `Refund ₹${booking.packagePaise / 100} → user ${session.userId}` });
      }
    }

    // Update session with refund txn ID
    if (refundTxnId) {
      await tx.session.update({
        where: { id: session.id },
        data:  { refundTxnId },
      });
    }

    // ── Mark booking FAILED ──────────────────────────────────────────────────
    // Booking can no longer be used — session ended abnormally
    await tx.booking.update({
      where: { id: session.bookingId },
      data:  { status: BookingStatus.FAILED },
    });
  });

  if (alreadyHandled) {
    traceMqtt("warn", { topic: mqttTopic, message: `${reason} — session ${session.id} already failed by concurrent event, skipped` });
    return;
  }

  traceMqtt("info", { topic: mqttTopic, message: `${reason} → RELAY_OFF + Session ${session.id} → FAILED + booking FAILED + full refund` });
}

// ─────────────────────────────────────────────────────────────────────────────
// /status handler — device online/offline heartbeat + auto-registration
//
// Also handles device reboot detection:
// If a device comes back online while a session is ACTIVE, it means the device
// rebooted mid-session. Relay state is unknown (usually OFF after reboot).
// We fail the session and refund the user to avoid billing for no-power time.
// ─────────────────────────────────────────────────────────────────────────────
async function handleDeviceStatus(mqttTopic: string, payload: string): Promise<void> {
  let status = "online";
  let mac:    string | null = null;

  try {
    const data = JSON.parse(payload);
    status = data.status ?? "online";
    mac    = data.mac    ?? null;
  } catch {
    // Plain text payload e.g. "online" / "offline"
    status = payload.trim().toLowerCase();
  }

  const isOnline = status === "online";
  let charger    = await findCharger(mqttTopic);

  // ── Auto-registration: new device, not yet in DB ───────────────────────────
  if (!charger && mac) {
    charger = await prisma.charger.findFirst({ where: { deviceId: mac } });

    if (!charger) {
      // First time this device has connected — create a charger record
      charger = await prisma.charger.create({
        data: {
          name:        `New Charger (${mqttTopic})`,
          displayName: "PlugBox #1",
          lat:         0,
          lng:         0,
          status:      "ONLINE",
          deviceId:    mac,
          mqttTopic,
          lastSeen:    new Date(),
        },
      });
      traceMqtt("info", { topic: mqttTopic, message: `✨ Auto-registered charger id=${charger.id} mac=${mac}` });
      await _subscribeAllChargers();
      return;

    } else if (!charger.mqttTopic) {
      // Device known by MAC but mqttTopic was unset — update it now
      charger = await prisma.charger.update({
        where: { id: charger.id },
        data:  { mqttTopic, status: "ONLINE", lastSeen: new Date() },
      });
      await _subscribeAllChargers();
    }
  }

  if (!charger) {
    console.warn(`[MQTT] Unknown charger '${mqttTopic}' — needs MAC to auto-register`);
    return;
  }

  // ── Update charger online/offline status ───────────────────────────────────
  await prisma.charger.update({
    where: { id: charger.id },
    data:  {
      status:   isOnline ? "ONLINE" : "OFFLINE",
      lastSeen: isOnline ? new Date() : undefined,
      ...(mac ? { deviceId: mac } : {}),
    },
  });

  traceMqtt("info", { topic: mqttTopic, message: `Charger ${charger.id} → ${status.toUpperCase()}` });

  // ── Device reboot detection ────────────────────────────────────────────────
  // If the device just came online AND there's an ACTIVE session in the DB,
  // the device must have rebooted during charging. After a reboot, relay state
  // is unknown (firmware typically turns relay OFF on boot). We fail the session
  // and refund the user so they are not billed for time without power.
  if (isOnline) {
    const interruptedSession = await prisma.session.findFirst({
      where:   { chargerId: charger.id, status: SessionStatus.ACTIVE },
      orderBy: { createdAt: "desc" },
    });

    if (interruptedSession) {
      traceMqtt("warn", { topic: mqttTopic, message: `Device rebooted with ACTIVE session ${interruptedSession.id} — failing session and refunding user` });
      // handleSessionFail will: send RELAY_OFF (harmless if already off),
      // mark session FAILED, issue full refund, mark booking FAILED
      await handleSessionFail(charger.id, mqttTopic, "device_reboot");
    }
  }
}