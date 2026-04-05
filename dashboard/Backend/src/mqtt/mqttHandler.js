const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// These are injected from app.js to avoid circular import
let _mqttPublish;
let _subscribeAllChargers;
let _broadcastEnergyReading;

function initMqttHandler(publishFn, subscribeAllFn, broadcastFn) {
  _mqttPublish = publishFn;
  _subscribeAllChargers = subscribeAllFn;
  _broadcastEnergyReading = broadcastFn;
}

// Main message router
async function handleMqttMessage(topic, payload) {
  try {
    const lastSlash = topic.lastIndexOf("/");
    if (lastSlash === -1) return;

    const mqttTopic = topic.substring(0, lastSlash);
    const suffix = topic.substring(lastSlash + 1);

    switch (suffix) {
      case "data": await handleEnergyData(mqttTopic, payload); break;
      case "ir": await handleIrEvent(mqttTopic, payload); break;
      case "status": await handleDeviceStatus(mqttTopic, payload); break;
      default:
        console.log(`[MQTT] Unhandled: ${topic}`);
    }
  } catch (err) {
    console.error(`[MQTT] Error handling ${topic}:`, err);
  }
}

// Helper: find charger by mqttTopic
async function findCharger(mqttTopic) {
  return prisma.charger.findFirst({ where: { mqttTopic } });
}

// /data → PZEM energy readings
async function handleEnergyData(mqttTopic, payload) {
  let data;
  try { data = JSON.parse(payload); }
  catch { console.warn("[MQTT] Invalid JSON on /data:", payload); return; }

  if (data.status === "no_load") return;

  if (
    typeof data.voltage !== "number" ||
    typeof data.current !== "number" ||
    typeof data.power !== "number" ||
    typeof data.energy !== "number" ||
    typeof data.frequency !== "number" ||
    typeof data.pf !== "number"
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
      status: { in: ['PLUG_WAIT', 'ACTIVE'] }
    },
    orderBy: { createdAt: "desc" }
  });

  // Store reading
  await prisma.energyReading.create({
    data: {
      chargerId: charger.id,
      sessionId: activeSession?.id ?? null,
      voltage: data.voltage,
      current: data.current,
      power: data.power,
      energyKwh: data.energy,
      frequency: data.frequency,
      powerFactor: data.pf,
    }
  });

  // Current detected → move PLUG_WAIT → ACTIVE
  if (data.current >= 0.05 && activeSession?.status === 'PLUG_WAIT') {
    await prisma.session.update({
      where: { id: activeSession.id },
      data: { status: 'ACTIVE', startedAt: new Date() }
    });
    console.log(`[MQTT] Session ${activeSession.id} → ACTIVE (${data.current}A)`);
  }

  // Broadcast energy reading to WebSocket clients
  if (_broadcastEnergyReading) {
    _broadcastEnergyReading(charger.id, {
      voltage: data.voltage,
      current: data.current,
      power: data.power,
      energy: data.energy,
      frequency: data.frequency,
      powerFactor: data.pf
    });
    console.log(`[MQTT] 📡 Broadcasted energy reading for charger ${charger.id}`);
  }
}

// /ir → IR sensor door events
async function handleIrEvent(mqttTopic, payload) {
  let data;
  try { data = JSON.parse(payload); }
  catch { console.warn("[MQTT] Invalid JSON on /ir:", payload); return; }

  console.log(`[MQTT] IR: ${payload}`);

  const charger = await findCharger(mqttTopic);
  if (!charger) return;

  if (data.event === "door_closed") {
    await handleDoorClosed(charger.id, mqttTopic, data.button_pressed === true);
  }
}

// Door closed with button state
async function handleDoorClosed(chargerId, mqttTopic, buttonPressed) {
  if (!buttonPressed) {
    console.log(`[MQTT] Door closed without button — no action`);
    return;
  }

  const session = await prisma.session.findFirst({
    where: {
      chargerId,
      status: { in: ['UNLOCKED', 'PLUG_WAIT'] }
    },
    orderBy: { createdAt: "desc" }
  });

  if (!session) {
    console.warn(`[MQTT] No UNLOCKED session for charger ${chargerId}`);
    return;
  }

  // Session → PLUG_WAIT with timestamp for 3min timeout
  await prisma.session.update({
    where: { id: session.id },
    data: {
      status: 'PLUG_WAIT',
      plugWaitStartedAt: new Date(),
    }
  });

  // Lock solenoid
  _mqttPublish(`${mqttTopic}/door`, "SOLENOID_LOCK");

  // Mark UNLOCK command as ACKED
  const pendingCmd = await prisma.deviceCommand.findFirst({
    where: {
      sessionId: session.id,
      type: 'UNLOCK',
      status: 'PENDING',
    },
    orderBy: { createdAt: "desc" }
  });

  if (pendingCmd) {
    await prisma.deviceCommand.update({
      where: { id: pendingCmd.id },
      data: { status: 'ACKED', ackedAt: new Date() }
    });
    console.log(`[MQTT] DeviceCommand ${pendingCmd.id} → ACKED`);
  }

  console.log(`[MQTT] Session ${session.id} → PLUG_WAIT | SOLENOID_LOCK sent`);
}

// /status → device online/offline + auto-registration
async function handleDeviceStatus(mqttTopic, payload) {
  let status = "online";
  let mac = null;

  try {
    const data = JSON.parse(payload);
    status = data.status ?? "online";
    mac = data.mac ?? null;
  } catch {
    status = payload.trim().toLowerCase();
  }

  const isOnline = status === "online";
  let charger = await findCharger(mqttTopic);

  if (!charger && mac) {
    charger = await prisma.charger.findFirst({ where: { deviceId: mac } });

    if (!charger) {
      // Auto-register new charger
      charger = await prisma.charger.create({
        data: {
          name: `New Charger (${mqttTopic})`,
          displayName: "PlugBox #1",
          lat: 0,
          lng: 0,
          status: "ONLINE",
          deviceId: mac,
          mqttTopic: mqttTopic,
          lastSeen: new Date(),
        }
      });
      console.log(`[MQTT] ✨ Auto-registered: id=${charger.id} mac=${mac} topic=${mqttTopic}`);
      await _subscribeAllChargers();
      return;

    } else if (!charger.mqttTopic) {
      charger = await prisma.charger.update({
        where: { id: charger.id },
        data: { mqttTopic, status: "ONLINE", lastSeen: new Date() }
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
    data: {
      status: isOnline ? "ONLINE" : "OFFLINE",
      lastSeen: isOnline ? new Date() : undefined,
      ...(mac ? { deviceId: mac } : {}),
    }
  });

  console.log(`[MQTT] Charger ${charger.id} (${mqttTopic}) → ${status.toUpperCase()}`);
}

module.exports = {
  initMqttHandler,
  handleMqttMessage
};
