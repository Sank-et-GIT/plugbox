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
import { traceMqtt } from "../lib/trace";

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
      topics.push(`${c.mqttTopic}/data`);
      topics.push(`${c.mqttTopic}/ir`);
    }
  }

    traceMqtt("subscribe", {
    topicCount: topics.length,
    topics,
    qos: 1,
  });

  client.subscribe(topics, { qos: 1 }, (err) => {
    if (err) {
      traceMqtt("error", {
        action: "subscribe",
        topicCount: topics.length,
        topics,
        errorMessage: err.message,
        stack: err.stack,
      });
    } else {
      traceMqtt("subscribe", {
        status: "success",
        topicCount: topics.length,
        topics,
        qos: 1,
      });
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
    traceMqtt("error", {
      action: "config_check",
      errorMessage: "Missing MQTT_HOST / MQTT_USERNAME / MQTT_PASSWORD in .env",
    });
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
    traceMqtt("connect", {
    action: "connect_attempt",
    host,
    port,
  });

   client.on("connect", async () => {
    traceMqtt("connect", {
      status: "connected",
      queuedCommands: commandQueue.length,
    });

    await subscribeAllChargers();

    if (commandQueue.length > 0) {
      traceMqtt("publish", {
        action: "drain_queue_start",
        queuedCommands: commandQueue.length,
      });

      while (commandQueue.length > 0) {
        const cmd = commandQueue.shift()!;
        publishNow(cmd.topic, cmd.message);
      }
    }
  });

  // FIX: use registered handler, not direct import
  client.on("message", (topic, payload) => {
    const payloadText = payload.toString();

    traceMqtt("message", {
      topic,
      payload: payloadText,
    });

    if (messageHandler) {
      messageHandler(topic, payloadText);
    } else {
      traceMqtt("error", {
        action: "message_no_handler",
        topic,
        payload: payloadText,
        errorMessage: "Message received but no handler registered",
      });
    }
  });

    client.on("error", (err) => {
    traceMqtt("error", {
      action: "client_error",
      errorMessage: err.message,
      stack: err.stack,
    });
  });

  client.on("reconnect", () => {
    traceMqtt("connect", {
      action: "reconnect_attempt",
    });
  });

  client.on("offline", () => {
    traceMqtt("disconnect", {
      action: "offline",
      queuedCommands: commandQueue.length,
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal publish (when connected)
// ─────────────────────────────────────────────────────────────────────────────
function publishNow(topic: string, message: string): void {
  traceMqtt("publish", {
    action: "publish_attempt",
    topic,
    payload: message,
    qos: 1,
  });

  client.publish(topic, message, { qos: 1 }, (err) => {
    if (err) {
      traceMqtt("error", {
        action: "publish_failed",
        topic,
        payload: message,
        errorMessage: err.message,
        stack: err.stack,
      });
    } else {
      traceMqtt("publish", {
        action: "publish_success",
        topic,
        payload: message,
        qos: 1,
      });
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

    traceMqtt("publish", {
      action: "queued_offline",
      topic,
      payload: message,
      queueLength: commandQueue.length,
    });
  }
}