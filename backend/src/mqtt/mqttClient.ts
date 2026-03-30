// ─────────────────────────────────────────────────────────────────────────────
// src/mqtt/mqttClient.ts
//
// FIX: Circular import removed.
//   mqttClient NO LONGER imports from mqttHandler.
//   Instead, message handler is registered via setMessageHandler()
//   called from app.ts AFTER both modules are loaded.
// ─────────────────────────────────────────────────────────────────────────────

import mqtt, { MqttClient } from "mqtt";
import prisma               from "../lib/prismaClient";

let client: MqttClient;

// Message handler — set after both modules loaded (breaks circular import)
type MessageHandler = (topic: string, payload: string) => void;
let messageHandler: MessageHandler | null = null;

export function setMessageHandler(handler: MessageHandler): void {
  messageHandler = handler;
}

// Command queue — filled when MQTT offline, drained on reconnect
interface QueuedCommand { topic: string; message: string; }
const commandQueue: QueuedCommand[] = [];

const TOPIC_SUFFIXES = ["/data", "/ir", "/status"];

// ─────────────────────────────────────────────────────────────────────────────
// Subscribe to all registered charger topics from DB
// ─────────────────────────────────────────────────────────────────────────────
export async function subscribeAllChargers(): Promise<void> {
  const chargers = await prisma.charger.findMany({
    where:  { mqttTopic: { not: null } },
    select: { mqttTopic: true }
  });

  const topics: string[] = ["+/status"]; // wildcard for auto-registration

  for (const c of chargers) {
    if (c.mqttTopic) {
      for (const suffix of TOPIC_SUFFIXES) {
        topics.push(`${c.mqttTopic}${suffix}`);
      }
    }
  }

  client.subscribe(topics, { qos: 1 }, (err) => {
    if (err) {
      console.error("[MQTT] Subscribe error:", err);
    } else {
      console.log(`[MQTT] Subscribed to ${topics.length} topics`);
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Connect to HiveMQ
// ─────────────────────────────────────────────────────────────────────────────
export function connectMqtt(): void {
  const host     = process.env.MQTT_HOST     ?? "";
  const port     = Number(process.env.MQTT_PORT ?? 8883);
  const username = process.env.MQTT_USERNAME ?? "";
  const password = process.env.MQTT_PASSWORD ?? "";

  if (!host || !username || !password) {
    console.error("[MQTT] Missing MQTT_HOST / MQTT_USERNAME / MQTT_PASSWORD in .env");
    process.exit(1);
  }

  client = mqtt.connect(`mqtts://${host}:${port}`, {
    username,
    password,
    clientId:           `pb_backend_${Date.now()}`,
    rejectUnauthorized: true,
    reconnectPeriod:    5_000,
    keepalive:          60,
  });

  client.on("connect", async () => {
    console.log("[MQTT] Connected to HiveMQ ✓");
    await subscribeAllChargers();

    // Drain queued commands
    if (commandQueue.length > 0) {
      console.log(`[MQTT] Draining ${commandQueue.length} queued command(s)`);
      while (commandQueue.length > 0) {
        const cmd = commandQueue.shift()!;
        publishNow(cmd.topic, cmd.message);
      }
    }
  });

  // FIX: use registered handler, not direct import
  client.on("message", (topic, payload) => {
    if (messageHandler) {
      messageHandler(topic, payload.toString());
    } else {
      console.warn("[MQTT] Message received but no handler registered:", topic);
    }
  });

  client.on("error",     (err) => console.error("[MQTT] Error:", err.message));
  client.on("reconnect", ()    => console.log("[MQTT] Reconnecting..."));
  client.on("offline",   ()    => console.warn("[MQTT] Offline — commands will queue"));
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal publish (when connected)
// ─────────────────────────────────────────────────────────────────────────────
function publishNow(topic: string, message: string): void {
  client.publish(topic, message, { qos: 1 }, (err) => {
    if (err) {
      console.error(`[MQTT] Publish error ${topic}:`, err.message);
    } else {
      console.log(`[MQTT] → ${topic}: ${message}`);
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Public publish — queues if offline, sends when reconnects
// ─────────────────────────────────────────────────────────────────────────────
export function mqttPublish(topic: string, message: string): void {
  if (client?.connected) {
    publishNow(topic, message);
  } else {
    commandQueue.push({ topic, message });
    console.warn(`[MQTT] Queued (offline): ${topic}: ${message}`);
  }
}