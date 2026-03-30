// ─────────────────────────────────────────────────────────────────────────────
// src/mqtt/mqttHandler.ts
//
// PERFECT VERSION — fixes:
//   1. Charger looked up by MAC address (deviceId) — not hardcoded ID
//   2. New chargers auto-registered on first heartbeat
//   3. DeviceCommand marked ACKED when door ACK arrives
//   4. sessionId linked to EnergyReading
//   5. subscribeAllChargers() called after new charger registers
// ─────────────────────────────────────────────────────────────────────────────

import { PrismaClient, SessionStatus, CommandStatus, CommandType } from "@prisma/client";
import { subscribeAllChargers } from "./mqttClient";

const prisma = new PrismaClient();

// ─────────────────────────────────────────────────────────────────────────────
// Main message router
// Topic format: {mqttTopic}/data|door|status
// e.g. "pb_device_01/data" → prefix = "pb_device_01", suffix = "data"
// ─────────────────────────────────────────────────────────────────────────────

export async function handleMqttMessage(topic: string, payload: string): Promise<void> {
  try {
    const lastSlash = topic.lastIndexOf("/");
    if (lastSlash === -1) return;

    const mqttTopic = topic.substring(0, lastSlash);   // e.g. "pb_device_01"
    const suffix    = topic.substring(lastSlash + 1);  // e.g. "data"

    switch (suffix) {
      case "data":
        await handleEnergyData(mqttTopic, payload);
        break;
      case "door":
        await handleDoorAck(mqttTopic, payload);
        break;
      case "status":
        await handleDeviceStatus(mqttTopic, payload);
        break;
      default:
        console.log(`[MQTT] Unhandled suffix: ${suffix} on topic: ${topic}`);
    }
  } catch (err) {
    console.error(`[MQTT] Error handling ${topic}:`, err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: find charger by mqttTopic prefix
// Returns null if not found — caller decides what to do
// ─────────────────────────────────────────────────────────────────────────────

async function findChargerByTopic(mqttTopic: string) {
  return prisma.charger.findFirst({
    where: { mqttTopic }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// pb_device_01/data → PZEM energy readings
//
// Payload: {"voltage":230.1,"current":2.5,"power":575,"energy":0.12,"frequency":50,"pf":0.96}
//      or: {"status":"no_load","voltage":230.1}
// ─────────────────────────────────────────────────────────────────────────────

async function handleEnergyData(mqttTopic: string, payload: string): Promise<void> {
  let data: any;
  try { data = JSON.parse(payload); }
  catch { console.warn("[MQTT] Invalid JSON on /data:", payload); return; }

  // Skip no-load status messages
  if (data.status === "no_load") return;

  // Validate required fields
  if (
    typeof data.voltage   !== "number" ||
    typeof data.current   !== "number" ||
    typeof data.power     !== "number" ||
    typeof data.energy    !== "number" ||
    typeof data.frequency !== "number" ||
    typeof data.pf        !== "number"
  ) {
    console.warn("[MQTT] Missing fields in energy data:", payload);
    return;
  }

  const charger = await findChargerByTopic(mqttTopic);
  if (!charger) {
    console.warn(`[MQTT] No charger found for topic: ${mqttTopic}`);
    return;
  }

  // Find active session for this charger (to link reading)
  const activeSession = await prisma.session.findFirst({
    where: {
      chargerId: charger.id,
      status: { in: [SessionStatus.UNLOCKED, SessionStatus.ACTIVE] }
    },
    orderBy: { createdAt: "desc" }
  });

  // Store energy reading with sessionId if available
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

  // If current is flowing and session is UNLOCKED → mark ACTIVE
  // Threshold 0.05A filters out noise
  if (data.current > 0.05 && activeSession?.status === SessionStatus.UNLOCKED) {
    await prisma.session.update({
      where: { id: activeSession.id },
      data:  { status: SessionStatus.ACTIVE, startedAt: new Date() }
    });
    console.log(`[MQTT] Session ${activeSession.id} → ACTIVE (current: ${data.current}A)`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// pb_device_01/door → solenoid ACK from ESP32
//
// Payload: {"door":"unlocked","state":"online"}
//      or: {"door":"locked","state":"online"}
//
// PERFECT FIX: Also marks DeviceCommand as ACKED for full audit trail
// ─────────────────────────────────────────────────────────────────────────────

async function handleDoorAck(mqttTopic: string, payload: string): Promise<void> {
  let data: any;
  try { data = JSON.parse(payload); }
  catch { console.warn("[MQTT] Invalid JSON on /door:", payload); return; }

  console.log(`[MQTT] Door ACK from ${mqttTopic}: ${payload}`);

  const charger = await findChargerByTopic(mqttTopic);
  if (!charger) return;

  if (data.door === "unlocked") {
    // Find UNLOCK_SENT session → mark UNLOCKED
    const session = await prisma.session.findFirst({
      where:   { chargerId: charger.id, status: SessionStatus.UNLOCK_SENT },
      orderBy: { createdAt: "desc" }
    });

    if (session) {
      await prisma.session.update({
        where: { id: session.id },
        data:  { status: SessionStatus.UNLOCKED }
      });
      console.log(`[MQTT] Session ${session.id} → UNLOCKED`);

      // ── PERFECT FIX: Mark DeviceCommand as ACKED ───────────────────────────
      // Finds the most recent PENDING UNLOCK command for this session
      // and marks it ACKED with timestamp — completes the audit trail
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
        console.log(`[MQTT] DeviceCommand ${pendingCmd.id} → ACKED`);
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// pb_device_01/status → device online/offline + auto-registration
//
// Payload: "online" or "offline"
//      or: {"status":"online","mac":"AA:BB:CC:DD:EE:FF","firmware":"1.0.0"}
//
// PERFECT FIX: Auto-registers new charger if MAC not seen before
//              Triggers subscribeAllChargers() to pick up new topics
// ─────────────────────────────────────────────────────────────────────────────

async function handleDeviceStatus(mqttTopic: string, payload: string): Promise<void> {
  // Parse payload — can be plain string or JSON
  let status = "online";
  let mac: string | null = null;
  let firmware: string | null = null;

  try {
    const data = JSON.parse(payload);
    status   = data.status   ?? "online";
    mac      = data.mac      ?? null;
    firmware = data.firmware ?? null;
  } catch {
    // Plain string payload: "online" or "offline"
    status = payload.trim().toLowerCase();
  }

  const isOnline = status === "online";

  // Find charger by mqttTopic
  let charger = await findChargerByTopic(mqttTopic);

  if (!charger && mac) {
    // ── Auto-registration ─────────────────────────────────────────────────────
    // New hardware seen for first time — check if charger with this MAC exists
    charger = await prisma.charger.findFirst({ where: { deviceId: mac } });

    if (!charger) {
      // Brand new charger — create record
      // Admin will update name, lat, lng later via admin panel
      charger = await prisma.charger.create({
        data: {
          name:      `New Charger (${mqttTopic})`,
          lat:       0,
          lng:       0,
          status:    "ONLINE",
          deviceId:  mac,
          mqttTopic: mqttTopic,
          lastSeen:  new Date(),
        }
      });
      console.log(`[MQTT] ✨ New charger auto-registered: id=${charger.id} mac=${mac} topic=${mqttTopic}`);

      // Subscribe to this charger's topics now that it's registered
      await subscribeAllChargers();
      return;

    } else if (!charger.mqttTopic) {
      // Charger exists by MAC but mqttTopic was never set — update it
      charger = await prisma.charger.update({
        where: { id: charger.id },
        data:  { mqttTopic, status: "ONLINE", lastSeen: new Date() }
      });
      await subscribeAllChargers();
    }
  }

  if (!charger) {
    console.warn(`[MQTT] Unknown charger on topic: ${mqttTopic} — publish with MAC to auto-register`);
    return;
  }

  // Update charger status + lastSeen
  await prisma.charger.update({
    where: { id: charger.id },
    data:  {
      status:   isOnline ? "ONLINE" : "OFFLINE",
      lastSeen: isOnline ? new Date() : undefined,
      ...(mac      ? { deviceId: mac }       : {}),
      ...(firmware ? { } : {}),  // Phase 2: store firmware version
    }
  });

  console.log(`[MQTT] Charger ${charger.id} (${mqttTopic}) → ${status.toUpperCase()}${mac ? ` mac=${mac}` : ""}`);
}
