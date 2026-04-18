// ─────────────────────────────────────────────────────────────────────────────
// src/mqtt/mqttClient.ts
//
// Circular import removed — message handler registered via setMessageHandler()
// called from app.ts AFTER both modules are loaded.
//
// Fixes in this version:
//   1. Critical safety commands (RELAY_OFF, SOLENOID_LOCK) are published with
//      retain:true so the device receives them even after a reboot or
//      reconnect — HiveMQ holds the last retained message and delivers it
//      the moment the device comes online. No call-site changes needed.
//
//   2. Critical commands drain FIRST from the offline queue on reconnect.
//      Previously if 50 telemetry-era messages queued while offline,
//      RELAY_OFF would drain last — relay stays on until then.
//
//   3. Queue size cap (MAX_QUEUE_SIZE = 100).
//      Critical commands always queue regardless of cap.
//      Non-critical commands are dropped with a warning when cap is hit,
//      preventing unbounded memory growth during long broker outages.
// ─────────────────────────────────────────────────────────────────────────────

import mqtt, { MqttClient } from "mqtt";
import prisma               from "../lib/prismaClient";
import { traceMqtt }        from "../lib/trace";

let client: MqttClient;

// ─────────────────────────────────────────────────────────────────────────────
// Message handler — injected from app.ts to break circular import
// ─────────────────────────────────────────────────────────────────────────────
type MessageHandler = (topic: string, payload: string) => void;
let messageHandler: MessageHandler | null = null;

export function setMessageHandler(handler: MessageHandler): void {
  messageHandler = handler;
}

// ─────────────────────────────────────────────────────────────────────────────
// Offline command queue — filled when broker unreachable, drained on reconnect
//
// critical flag: true  → drain first on reconnect, always queued even if full
//               false → drain after critical, dropped if queue is full
// ─────────────────────────────────────────────────────────────────────────────
interface QueuedCommand {
  topic:    string;
  message:  string;
  critical: boolean; // true = safety command, gets priority drain
}

const commandQueue: QueuedCommand[] = [];

// Max non-critical messages to hold in memory during a broker outage.
// Critical commands (RELAY_OFF, SOLENOID_LOCK) always queue regardless of this.
const MAX_QUEUE_SIZE = 100;

// ─────────────────────────────────────────────────────────────────────────────
// Classify a command as safety-critical or not.
//
// Critical commands use retain:true so the device receives them even after
// a hardware reboot — the broker holds the last retained value per topic
// and delivers it immediately when the device reconnects.
//
// RELAY_OFF   — stops power flow, must reach device even after reboot
// SOLENOID_LOCK — secures the lid, must reach device even after reboot
//
// Non-critical commands (RELAY_ON, SOLENOID_UNLOCK, RESET_ENERGY) intentionally
// do NOT use retain — they are intent-based, not safety-based, and replaying
// them after a reboot could cause unintended behaviour (e.g. re-unlocking
// a solenoid for a session that already ended).
// ─────────────────────────────────────────────────────────────────────────────
function isCritical(message: string): boolean {
  return message === "RELAY_OFF" || message === "SOLENOID_LOCK";
}

const TOPIC_SUFFIXES = ["/data", "/ir", "/status"];

// ─────────────────────────────────────────────────────────────────────────────
// Subscribe to all registered charger topics from DB
// ─────────────────────────────────────────────────────────────────────────────
export async function subscribeAllChargers(): Promise<void> {
  const chargers = await prisma.charger.findMany({
    where:  { mqttTopic: { not: null } },
    select: { mqttTopic: true },
  });

  const topics: string[] = ["+/status"]; // wildcard catches new devices auto-registering

  for (const c of chargers) {
    if (c.mqttTopic) {
      topics.push(`${c.mqttTopic}/data`);
      topics.push(`${c.mqttTopic}/ir`);
    }
  }

  traceMqtt("subscribe", { topicCount: topics.length, topics, qos: 1 });

  client.subscribe(topics, { qos: 1 }, (err) => {
    if (err) {
      traceMqtt("error", {
        action:       "subscribe",
        topicCount:   topics.length,
        topics,
        errorMessage: err.message,
        stack:        err.stack,
      });
    } else {
      traceMqtt("subscribe", { status: "success", topicCount: topics.length, topics, qos: 1 });
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Connect to HiveMQ Cloud
// ─────────────────────────────────────────────────────────────────────────────
export function connectMqtt(): void {
  const host     = process.env.MQTT_HOST     ?? "";
  const port     = Number(process.env.MQTT_PORT ?? 8883);
  const username = process.env.MQTT_USERNAME ?? "";
  const password = process.env.MQTT_PASSWORD ?? "";

  if (!host || !username || !password) {
    traceMqtt("error", {
      action:       "config_check",
      errorMessage: "Missing MQTT_HOST / MQTT_USERNAME / MQTT_PASSWORD in .env",
    });
    process.exit(1);
  }

  client = mqtt.connect(`mqtts://${host}:${port}`, {
    username,
    password,
    clientId:           `pb_backend_${Date.now()}`,
    rejectUnauthorized: true,
    reconnectPeriod:    5_000, // retry broker connection every 5s
    keepalive:          15,
  });

  traceMqtt("connect", { action: "connect_attempt", host, port });

  // ── On (re)connect: subscribe + drain queued commands ──────────────────────
  client.on("connect", async () => {
    traceMqtt("connect", { status: "connected", queuedCommands: commandQueue.length });

    await subscribeAllChargers();

    if (commandQueue.length > 0) {
      traceMqtt("publish", {
        action:         "drain_queue_start",
        queuedCommands: commandQueue.length,
      });

      // PRIORITY DRAIN: critical commands first, then normal commands.
      // This ensures RELAY_OFF reaches the device before any lower-priority
      // messages (e.g. RESET_ENERGY) that were queued at the same time.
      const criticals = commandQueue.filter(cmd => cmd.critical);
      const normals   = commandQueue.filter(cmd => !cmd.critical);
      commandQueue.length = 0; // clear queue before publishing to avoid re-entry

      for (const cmd of [...criticals, ...normals]) {
        publishNow(cmd.topic, cmd.message, cmd.critical);
      }

      traceMqtt("publish", {
        action:          "drain_queue_complete",
        criticalDrained: criticals.length,
        normalDrained:   normals.length,
      });
    }
  });

  // ── Incoming messages → registered handler ─────────────────────────────────
  client.on("message", (topic, payload) => {
    const payloadText = payload.toString();
    traceMqtt("message", { topic, payload: payloadText });

    if (messageHandler) {
      messageHandler(topic, payloadText);
    } else {
      traceMqtt("error", {
        action:       "message_no_handler",
        topic,
        payload:      payloadText,
        errorMessage: "Message received but no handler registered",
      });
    }
  });

  client.on("error", (err) => {
    traceMqtt("error", { action: "client_error", errorMessage: err.message, stack: err.stack });
  });

  client.on("reconnect", () => {
    traceMqtt("connect", { action: "reconnect_attempt" });
  });

  client.on("offline", () => {
    traceMqtt("disconnect", { action: "offline", queuedCommands: commandQueue.length });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal publish — only called when client is connected
//
// retain: true  → broker holds message, device receives it on next connect
// retain: false → fire-and-forget (with QoS 1 delivery guarantee while connected)
// ─────────────────────────────────────────────────────────────────────────────
function publishNow(topic: string, message: string, retain: boolean): void {
  traceMqtt("publish", {
    action:  "publish_attempt",
    topic,
    payload: message,
    qos:     1,
    retain,
  });

  client.publish(topic, message, { qos: 1, retain }, (err) => {
    if (err) {
      traceMqtt("error", {
        action:       "publish_failed",
        topic,
        payload:      message,
        errorMessage: err.message,
        stack:        err.stack,
      });
    } else {
      traceMqtt("publish", {
        action:  "publish_success",
        topic,
        payload: message,
        qos:     1,
        retain,
      });
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Public publish — called by mqttHandler.ts, sessions.ts, sessionTimeout.ts
//
// If connected: publishes immediately.
//   Critical commands (RELAY_OFF, SOLENOID_LOCK) use retain:true.
//   Non-critical commands use retain:false.
//
// If offline: queues the command for drain on reconnect.
//   Critical commands always queue.
//   Non-critical commands are dropped (with a warning) if queue is full,
//   to prevent unbounded memory growth during long broker outages.
//
// Call signature is unchanged — no updates needed in any other file.
// ─────────────────────────────────────────────────────────────────────────────
export function mqttPublish(topic: string, message: string): void {
  const critical = isCritical(message);

  if (client?.connected) {
    publishNow(topic, message, critical);
    return;
  }

  // Broker is offline — decide whether to queue
  if (!critical && commandQueue.length >= MAX_QUEUE_SIZE) {
    // Non-critical command dropped — queue is full
    // Critical commands always get through regardless of queue size
    traceMqtt("publish", {
      action:      "queue_full_dropped",
      topic,
      payload:     message,
      queueLength: commandQueue.length,
    });
    console.warn(`[MQTT] Queue full (${MAX_QUEUE_SIZE}) — dropped non-critical command: ${topic} → ${message}`);
    return;
  }

  commandQueue.push({ topic, message, critical });

  traceMqtt("publish", {
    action:      critical ? "queued_critical_offline" : "queued_offline",
    topic,
    payload:     message,
    critical,
    queueLength: commandQueue.length,
  });

  if (critical) {
    // Warn loudly — a safety command is sitting in memory, not yet delivered
    console.warn(`[MQTT] ⚠️  Critical command queued (broker offline): ${topic} → ${message} [queue: ${commandQueue.length}]`);
  }
}