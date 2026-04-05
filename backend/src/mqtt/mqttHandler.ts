import { SessionStatus, CommandStatus, CommandType } from "@prisma/client";
import prisma from "../lib/prismaClient";
import { logDebug, logError, logInfo, logWarn } from "../lib/logger";

// These are injected from app.ts to avoid circular import
let _mqttPublish: (topic: string, message: string) => void;
let _subscribeAllChargers: () => Promise<void>;

export function initMqttHandler(
  publishFn: (topic: string, message: string) => void,
  subscribeAllFn: () => Promise<void>
): void {
  _mqttPublish = publishFn;
  _subscribeAllChargers = subscribeAllFn;
}

// Main message router
export async function handleMqttMessage(topic: string, payload: string): Promise<void> {
  try {
    logDebug("mqtt_handler_received", {
      category: "mqtt",
      topic,
      payload,
    });

    const lastSlash = topic.lastIndexOf("/");
    if (lastSlash === -1) {
      logWarn("mqtt_handler_invalid_topic", {
        category: "mqtt",
        topic,
        payload,
      });
      return;
    }

    const mqttTopic = topic.substring(0, lastSlash);
    const suffix = topic.substring(lastSlash + 1);

    logDebug("mqtt_handler_routing", {
      category: "mqtt",
      topic,
      mqttTopic,
      suffix,
    });

    switch (suffix) {
      case "data":
        await handleEnergyData(mqttTopic, payload);
        break;
      case "ir":
        await handleIrEvent(mqttTopic, payload);
        break;
      case "status":
        await handleDeviceStatus(mqttTopic, payload);
        break;
      default:
        logWarn("mqtt_handler_unhandled_topic", {
          category: "mqtt",
          topic,
          mqttTopic,
          suffix,
          payload,
        });
    }
  } catch (err: any) {
    logError("mqtt_handler_failed", {
      category: "mqtt",
      topic,
      payload,
      errorMessage: err?.message,
      stack: err?.stack,
    });
  }
}

// Helper: find charger by mqttTopic
async function findCharger(mqttTopic: string) {
  const charger = await prisma.charger.findFirst({ where: { mqttTopic } });

  logDebug("mqtt_find_charger", {
    category: "mqtt",
    mqttTopic,
    chargerId: charger?.id,
    found: !!charger,
  });

  return charger;
}

// /data → PZEM energy readings
async function handleEnergyData(mqttTopic: string, payload: string): Promise<void> {
  let data: any;

  try {
    data = JSON.parse(payload);
  } catch {
    logWarn("mqtt_data_invalid_json", {
      category: "mqtt",
      mqttTopic,
      payload,
    });
    return;
  }

  logDebug("mqtt_data_parsed", {
    category: "mqtt",
    mqttTopic,
    payload: data,
  });

  if (data.status === "no_load") {
    logDebug("mqtt_data_no_load", {
      category: "mqtt",
      mqttTopic,
    });
    return;
  }

  if (
    typeof data.voltage !== "number" ||
    typeof data.current !== "number" ||
    typeof data.power !== "number" ||
    typeof data.energy !== "number" ||
    typeof data.frequency !== "number" ||
    typeof data.pf !== "number"
  ) {
    logWarn("mqtt_data_missing_fields", {
      category: "mqtt",
      mqttTopic,
      payload: data,
    });
    return;
  }

  const charger = await findCharger(mqttTopic);
  if (!charger) {
    logWarn("mqtt_data_charger_not_found", {
      category: "mqtt",
      mqttTopic,
    });
    return;
  }

  const activeSession = await prisma.session.findFirst({
    where: {
      chargerId: charger.id,
      status: { in: [SessionStatus.PLUG_WAIT, SessionStatus.ACTIVE] },
    },
    orderBy: { createdAt: "desc" },
  });

  logDebug("mqtt_data_active_session_lookup", {
    category: "mqtt",
    mqttTopic,
    chargerId: charger.id,
    sessionId: activeSession?.id,
    sessionStatus: activeSession?.status,
  });

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
    },
  });

  logInfo("mqtt_data_energy_saved", {
    category: "mqtt",
    mqttTopic,
    chargerId: charger.id,
    sessionId: activeSession?.id ?? null,
    voltage: data.voltage,
    current: data.current,
    power: data.power,
    energyKwh: data.energy,
    frequency: data.frequency,
    powerFactor: data.pf,
  });

  if (data.current >= 0.05 && activeSession?.status === SessionStatus.PLUG_WAIT) {
    await prisma.session.update({
      where: { id: activeSession.id },
      data: { status: SessionStatus.ACTIVE, startedAt: new Date() },
    });

    logInfo("mqtt_session_activated", {
      category: "session",
      mqttTopic,
      chargerId: charger.id,
      sessionId: activeSession.id,
      current: data.current,
    });
  }
}

// /ir → IR sensor door events
async function handleIrEvent(mqttTopic: string, payload: string): Promise<void> {
  let data: any;

  try {
    data = JSON.parse(payload);
  } catch {
    logWarn("mqtt_ir_invalid_json", {
      category: "mqtt",
      mqttTopic,
      payload,
    });
    return;
  }

  logInfo("mqtt_ir_event", {
    category: "mqtt",
    mqttTopic,
    payload: data,
  });

  const charger = await findCharger(mqttTopic);
  if (!charger) {
    logWarn("mqtt_ir_charger_not_found", {
      category: "mqtt",
      mqttTopic,
    });
    return;
  }

  if (data.event === "door_closed") {
    await handleDoorClosed(charger.id, mqttTopic, data.button_pressed === true);
    return;
  }

  logDebug("mqtt_ir_unhandled_event", {
    category: "mqtt",
    mqttTopic,
    event: data.event,
    payload: data,
  });
}

// Door closed with button state
async function handleDoorClosed(
  chargerId: number,
  mqttTopic: string,
  buttonPressed: boolean
): Promise<void> {
  logInfo("mqtt_door_closed_received", {
    category: "mqtt",
    chargerId,
    mqttTopic,
    buttonPressed,
  });

  if (!buttonPressed) {
    const endedSession = await prisma.session.findFirst({
      where: { chargerId, status: SessionStatus.ENDED },
      orderBy: { createdAt: "desc" },
    });

    if (endedSession) {
      _mqttPublish(`${mqttTopic}/door`, "SOLENOID_LOCK");

      logInfo("mqtt_door_lock_after_ended_session", {
        category: "session",
        chargerId,
        mqttTopic,
        sessionId: endedSession.id,
      });
    } else {
      logDebug("mqtt_door_closed_no_action", {
        category: "mqtt",
        chargerId,
        mqttTopic,
        reason: "button_not_pressed_and_no_ended_session",
      });
    }

    return;
  }

  const session = await prisma.session.findFirst({
    where: {
      chargerId,
      status: { in: [SessionStatus.UNLOCKED, SessionStatus.PLUG_WAIT] },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!session) {
    logWarn("mqtt_door_no_matching_session", {
      category: "session",
      chargerId,
    });
    return;
  }

  await prisma.session.update({
    where: { id: session.id },
    data: {
      status: SessionStatus.PLUG_WAIT,
      plugWaitStartedAt: new Date(),
    },
  });

  logInfo("mqtt_session_plug_wait", {
    category: "session",
    chargerId,
    mqttTopic,
    sessionId: session.id,
  });

  const pendingCmd = await prisma.deviceCommand.findFirst({
    where: {
      sessionId: session.id,
      type: CommandType.UNLOCK,
      status: CommandStatus.PENDING,
    },
    orderBy: { createdAt: "desc" },
  });

  if (pendingCmd) {
    await prisma.deviceCommand.update({
      where: { id: pendingCmd.id },
      data: { status: CommandStatus.ACKED, ackedAt: new Date() },
    });

    logInfo("mqtt_unlock_command_acked", {
      category: "mqtt",
      chargerId,
      mqttTopic,
      sessionId: session.id,
      deviceCommandId: pendingCmd.id,
    });
  }

  setTimeout(() => {
    _mqttPublish(`${mqttTopic}/door`, "SOLENOID_LOCK");

    logInfo("mqtt_scheduled_door_lock_sent", {
      category: "mqtt",
      chargerId,
      mqttTopic,
      sessionId: session.id,
      delayMs: 10000,
    });
  }, 10_000);
}

// /status → device online/offline + auto-registration
async function handleDeviceStatus(mqttTopic: string, payload: string): Promise<void> {
  let status = "online";
  let mac: string | null = null;

  try {
    const data = JSON.parse(payload);
    status = data.status ?? "online";
    mac = data.mac ?? null;
  } catch {
    status = payload.trim().toLowerCase();
  }

  logInfo("mqtt_status_received", {
    category: "mqtt",
    mqttTopic,
    status,
    mac,
    rawPayload: payload,
  });

  const isOnline = status === "online";
  let charger = await findCharger(mqttTopic);

  if (!charger && mac) {
    charger = await prisma.charger.findFirst({ where: { deviceId: mac } });

    logDebug("mqtt_status_lookup_by_mac", {
      category: "mqtt",
      mqttTopic,
      mac,
      chargerId: charger?.id,
      found: !!charger,
    });

    if (!charger) {
      charger = await prisma.charger.create({
        data: {
          name: `New Charger (${mqttTopic})`,
          displayName: "PlugBox #1",
          lat: 0,
          lng: 0,
          status: "ONLINE",
          deviceId: mac,
          mqttTopic,
          lastSeen: new Date(),
        },
      });

      logInfo("mqtt_charger_auto_registered", {
        category: "mqtt",
        chargerId: charger.id,
        mqttTopic,
        mac,
      });

      await _subscribeAllChargers();
      return;
    } else if (!charger.mqttTopic) {
      charger = await prisma.charger.update({
        where: { id: charger.id },
        data: { mqttTopic, status: "ONLINE", lastSeen: new Date() },
      });

      logInfo("mqtt_charger_topic_attached", {
        category: "mqtt",
        chargerId: charger.id,
        mqttTopic,
        mac,
      });

      await _subscribeAllChargers();
    }
  }

  if (!charger) {
    logWarn("mqtt_status_unknown_charger", {
      category: "mqtt",
      mqttTopic,
      mac,
    });
    return;
  }

  await prisma.charger.update({
    where: { id: charger.id },
    data: {
      status: isOnline ? "ONLINE" : "OFFLINE",
      lastSeen: isOnline ? new Date() : undefined,
      ...(mac ? { deviceId: mac } : {}),
    },
  });

  logInfo("mqtt_charger_status_updated", {
    category: "mqtt",
    chargerId: charger.id,
    mqttTopic,
    status: status.toUpperCase(),
    mac,
  });
}