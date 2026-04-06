// ─────────────────────────────────────────────────────────────────────────────
// src/mqtt/mqttHandler.ts
//
// FIX: Does NOT import from mqttClient (circular import removed).
import { log } from "../lib/logger";
//   mqttPublish and subscribeAllChargers are passed in via initMqttHandler()
//   called from app.ts after both modules are loaded.
// ─────────────────────────────────────────────────────────────────────────────

import { SessionStatus, CommandStatus, CommandType } from "@prisma/client";
import prisma from "../lib/prismaClient";

// These are injected from app.ts to avoid circular import
let _mqttPublish:           (topic: string, message: string) => void;
let _subscribeAllChargers:  () => Promise<void>;

// Throttle online status updates — max once per 30s per charger
const _lastOnlineUpdate = new Map<string, number>();

export function initMqttHandler(
  publishFn:           (topic: string, message: string) => void,
  subscribeAllFn:      () => Promise<void>
): void {
  _mqttPublish          = publishFn;
  _subscribeAllChargers = subscribeAllFn;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main message router
// ─────────────────────────────────────────────────────────────────────────────
export async function handleMqttMessage(topic: string, payload: string): Promise<void> {
  try {
    const lastSlash = topic.lastIndexOf("/");
    if (lastSlash === -1) return;

    const mqttTopic = topic.substring(0, lastSlash);
    const suffix    = topic.substring(lastSlash + 1);

    switch (suffix) {
      case "data":   await handleEnergyData(mqttTopic, payload);   break;
      case "ir":     await handleIrEvent(mqttTopic, payload);      break;
      case "status": await handleDeviceStatus(mqttTopic, payload); break;
      default:
        log.mqtt("INFO", "", "Unhandled: ${topic}");
    }
  } catch (err) {
    console.error(`[MQTT] Error handling ${topic}:`, err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: find charger by mqttTopic
// ─────────────────────────────────────────────────────────────────────────────
async function findCharger(mqttTopic: string) {
  return prisma.charger.findFirst({ where: { mqttTopic } });
}

// ─────────────────────────────────────────────────────────────────────────────
// /data → PZEM energy readings
// ─────────────────────────────────────────────────────────────────────────────
async function handleEnergyData(mqttTopic: string, payload: string): Promise<void> {
  let data: any;
  try { data = JSON.parse(payload); }
  catch { console.warn("[MQTT] Invalid JSON on /data:", payload); return; }

  // Device is sending data → it's online. Update status + lastSeen.
  // Throttled to once per 30s to avoid DB spam (data comes every 500ms)
  const now = Date.now();
  const lastUpdate = _lastOnlineUpdate.get(mqttTopic) ?? 0;
  if (now - lastUpdate > 5_000) {
    _lastOnlineUpdate.set(mqttTopic, now);
    const chargerFromData = await findCharger(mqttTopic);
    if (chargerFromData) {
      await prisma.charger.update({
        where: { id: chargerFromData.id },
        data:  { status: "ONLINE", lastSeen: new Date() }
      });
      if (chargerFromData.status !== "ONLINE") {
        log.mqtt("INFO", mqttTopic, "Charger marked ONLINE from /data heartbeat");
      }
    }
  }

  // Check current even on no_load — relay may be ON but firmware still sends no_load
  // If current is detected → session was charging, move to ACTIVE
  if (data.status === "no_load") {
    // Still check for current detection on PLUG_WAIT sessions
    if (typeof data.current === "number" && data.current >= 0.05) {
      const charger = await findCharger(mqttTopic);
      if (!charger) return;
      const plugWaitSession = await prisma.session.findFirst({
        where: { chargerId: charger.id, status: SessionStatus.PLUG_WAIT },
        orderBy: { createdAt: "desc" }
      });
      if (plugWaitSession) {
        await prisma.session.update({
          where: { id: plugWaitSession.id },
          data:  { status: SessionStatus.ACTIVE, startedAt: new Date() }
        });
        log.mqtt("INFO", mqttTopic, `Session ${plugWaitSession.id} → ACTIVE from no_load current detect`);
      }
    }
    return;
  }

  if (
    typeof data.voltage   !== "number" ||
    typeof data.current   !== "number" ||
    typeof data.power     !== "number" ||
    typeof data.energy    !== "number" ||
    typeof data.frequency !== "number" ||
    typeof data.pf        !== "number"
  ) {
    console.warn("[MQTT] Missing fields in /data:", payload);
    return;
  }

  const charger = await findCharger(mqttTopic);
  if (!charger) return;

  // Find active session to link reading
  const activeSession = await prisma.session.findFirst({
    where: {
      chargerId: charger.id,
      status:    { in: [SessionStatus.PLUG_WAIT, SessionStatus.ACTIVE] }
    },
    orderBy: { createdAt: "desc" }
  });

  // Store reading
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
    }
  });

  // Current detected → move PLUG_WAIT → ACTIVE
  if (data.current >= 0.05 && activeSession?.status === SessionStatus.PLUG_WAIT) {
    await prisma.session.update({
      where: { id: activeSession.id },
      data:  { status: SessionStatus.ACTIVE, startedAt: new Date() }
    });
    log.mqtt("INFO", "", "Session ${activeSession.id} → ACTIVE (${data.current}A)");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// /ir → IR sensor door events
// ─────────────────────────────────────────────────────────────────────────────
async function handleIrEvent(mqttTopic: string, payload: string): Promise<void> {
  let data: any;
  try { data = JSON.parse(payload); }
  catch { console.warn("[MQTT] Invalid JSON on /ir:", payload); return; }

  log.mqtt("INFO", "", "IR: ${payload}");

  const charger = await findCharger(mqttTopic);
  if (!charger) return;

  if (data.event === "door_closed") {
    await handleDoorClosed(charger.id, mqttTopic, data.button_pressed === true);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Door closed with button state
// ─────────────────────────────────────────────────────────────────────────────
async function handleDoorClosed(
  chargerId:     number,
  mqttTopic:     string,
  buttonPressed: boolean
): Promise<void> {

  if (!buttonPressed) {
    // Door closed without button press
    // If session is ENDED → user finished and closed lid → lock idle charger
    const endedSession = await prisma.session.findFirst({
      where:   { chargerId, status: SessionStatus.ENDED },
      orderBy: { createdAt: "desc" }
    });

    if (endedSession) {
      _mqttPublish(`${mqttTopic}/door`, "SOLENOID_LOCK");
      log.mqtt("INFO", "", "Session ENDED — door closed → SOLENOID_LOCK (charger secured)");
    } else {
      log.mqtt("INFO", "", "Door closed without button — no action");
    }
    return;
  }

  // Button was pressed inside lid
  const session = await prisma.session.findFirst({
    where: {
      chargerId,
      status: { in: [SessionStatus.UNLOCKED, SessionStatus.PLUG_WAIT] }
    },
    orderBy: { createdAt: "desc" }
  });

  if (!session) {
    console.warn(`[MQTT] No UNLOCKED session for charger ${chargerId}`);
    return;
  }

  // Session → PLUG_WAIT with timestamp
  await prisma.session.update({
    where: { id: session.id },
    data:  {
      status:            SessionStatus.PLUG_WAIT,
      plugWaitStartedAt: new Date(),
    }
  });

  // Mark UNLOCK command as ACKED
  const pendingCmd = await prisma.deviceCommand.findFirst({
    where: {
      sessionId: session.id,
      type:      CommandType.UNLOCK,
      status:    CommandStatus.PENDING,
    },
    orderBy: { createdAt: "desc" }
  });

  if (pendingCmd) {
    await prisma.deviceCommand.update({
      where: { id: pendingCmd.id },
      data:  { status: CommandStatus.ACKED, ackedAt: new Date() }
    });
    log.mqtt("INFO", "", "DeviceCommand ${pendingCmd.id} → ACKED");
  }

  log.mqtt("INFO", "", "Session ${session.id} → PLUG_WAIT (button pressed)");

  // Auto-lock solenoid 10 seconds after button press
  // User has had time to close the lid
  // sessionTimeout job handles notification if door still open after 3min
  setTimeout(() => {
    _mqttPublish(`${mqttTopic}/door`, "SOLENOID_LOCK");
    log.mqtt("INFO", "", "Session ${session.id} → SOLENOID_LOCK (10s after button press)");
  }, 10_000);
}

// ─────────────────────────────────────────────────────────────────────────────
// /status → device online/offline + auto-registration
// ─────────────────────────────────────────────────────────────────────────────
async function handleDeviceStatus(mqttTopic: string, payload: string): Promise<void> {
  let status = "online";
  let mac:    string | null = null;

  try {
    const data = JSON.parse(payload);
    status = data.status ?? "online";
    mac    = data.mac    ?? null;
  } catch {
    status = payload.trim().toLowerCase();
  }

  const isOnline = status === "online";
  let charger    = await findCharger(mqttTopic);

  if (!charger && mac) {
    charger = await prisma.charger.findFirst({ where: { deviceId: mac } });

    if (!charger) {
      // Auto-register new charger
      charger = await prisma.charger.create({
        data: {
          name:        `New Charger (${mqttTopic})`,
          displayName: "PlugBox #1",
          lat:         0,
          lng:         0,
          status:      "ONLINE",
          deviceId:    mac,
          mqttTopic:   mqttTopic,
          lastSeen:    new Date(),
        }
      });
      log.mqtt("INFO", "", "✨ Auto-registered: id=${charger.id} mac=${mac} topic=${mqttTopic}");
      await _subscribeAllChargers();
      return;

    } else if (!charger.mqttTopic) {
      charger = await prisma.charger.update({
        where: { id: charger.id },
        data:  { mqttTopic, status: "ONLINE", lastSeen: new Date() }
      });
      await _subscribeAllChargers();
    }
  }

  if (!charger) {
    console.warn(`[MQTT] Unknown charger: ${mqttTopic} — needs MAC to auto-register`);
    return;
  }

  await prisma.charger.update({
    where: { id: charger.id },
    data:  {
      status:   isOnline ? "ONLINE" : "OFFLINE",
      lastSeen: isOnline ? new Date() : undefined,
      ...(mac ? { deviceId: mac } : {}),
    }
  });

  log.mqtt("INFO", "", "Charger ${charger.id} (${mqttTopic}) → ${status.toUpperCase()}");
}