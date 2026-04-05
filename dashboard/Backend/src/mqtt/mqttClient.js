const mqtt = require('mqtt');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

let client;

// Message handler — set after both modules loaded (breaks circular import)
let messageHandler = null;

function setMessageHandler(handler) {
  messageHandler = handler;
}

// Command queue — filled when MQTT offline, drained on reconnect
const commandQueue = [];

const TOPIC_SUFFIXES = ["/data", "/ir", "/status"];

// Subscribe to all registered charger topics from DB
async function subscribeAllChargers() {
  const chargers = await prisma.charger.findMany({
    where: { mqttTopic: { not: null } },
    select: { mqttTopic: true }
  });

  const topics = ["+/status"]; // wildcard for auto-registration

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

// Connect to Mosquitto
function connectMqtt() {
  const host = process.env.MQTT_HOST || "localhost";
  const port = Number(process.env.MQTT_PORT || 1883);
  const username = process.env.MQTT_USERNAME || "";
  const password = process.env.MQTT_PASSWORD || "";

  // For local Mosquitto without authentication
  const useAuth = username && password;

  const options = {
    clientId: `pb_dashboard_${Date.now()}`,
    reconnectPeriod: 5000,
    keepalive: 60,
  };

  if (useAuth) {
    options.username = username;
    options.password = password;
  }

  // Use mqtt:// for local, mqtts:// for remote with SSL
  const protocol = useAuth && port === 8883 ? "mqtts" : "mqtt";
  
  client = mqtt.connect(`${protocol}://${host}:${port}`, options);

  client.on("connect", async () => {
    console.log("[MQTT] Connected to Mosquitto ✓");
    await subscribeAllChargers();

    // Drain queued commands
    if (commandQueue.length > 0) {
      console.log(`[MQTT] Draining ${commandQueue.length} queued command(s)`);
      while (commandQueue.length > 0) {
        const cmd = commandQueue.shift();
        publishNow(cmd.topic, cmd.message);
      }
    }
  });

  // Use registered handler, not direct import
  client.on("message", (topic, payload) => {
    if (messageHandler) {
      messageHandler(topic, payload.toString());
    } else {
      console.warn("[MQTT] Message received but no handler registered:", topic);
    }
  });

  client.on("error", (err) => console.error("[MQTT] Error:", err.message));
  client.on("reconnect", () => console.log("[MQTT] Reconnecting..."));
  client.on("offline", () => console.warn("[MQTT] Offline — commands will queue"));
}

// Internal publish (when connected)
function publishNow(topic, message) {
  client.publish(topic, message, { qos: 1 }, (err) => {
    if (err) {
      console.error(`[MQTT] Publish error ${topic}:`, err.message);
    } else {
      console.log(`[MQTT] → ${topic}: ${message}`);
    }
  });
}

// Public publish — queues if offline, sends when reconnects
function mqttPublish(topic, message) {
  if (client?.connected) {
    publishNow(topic, message);
  } else {
    commandQueue.push({ topic, message });
    console.warn(`[MQTT] Queued (offline): ${topic}: ${message}`);
  }
}

module.exports = {
  connectMqtt,
  mqttPublish,
  subscribeAllChargers,
  setMessageHandler
};
