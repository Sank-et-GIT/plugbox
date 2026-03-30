import express from "express";
import cors    from "cors";

import deviceRoutes          from "./routes/device";
import chargersRoutes        from "./routes/chargers";
import adminRoutes           from "./routes/admin";
import bookingsRoutes        from "./routes/bookings";
import deviceCommandsRoutes  from "./routes/deviceCommands";
import sessionsRoutes        from "./routes/sessions";
import deviceStatusRoutes    from "./routes/deviceStatus";
import authRoutes            from "./routes/auth";
import walletRoutes          from "./routes/wallet";

import {
  connectMqtt,
  mqttPublish,
  subscribeAllChargers,
  setMessageHandler,
} from "./mqtt/mqttClient";

import {
  handleMqttMessage,
  initMqttHandler,
} from "./mqtt/mqttHandler";

const app = express();

app.set("trust proxy", true);

// Raw body for Razorpay webhook HMAC — must be before express.json()
app.use("/wallet/razorpay-webhook", express.raw({ type: "application/json" }));

app.use(cors());
app.use(express.json());

// Request logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const ms = Date.now() - start;
    console.log(`[HTTP] ${req.method} ${req.originalUrl} → ${res.statusCode} (${ms}ms)`);
  });
  next();
});

// Health
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

// Routes
app.use("/auth",     authRoutes);
app.use("/wallet",   walletRoutes);
app.use("/bookings", bookingsRoutes);
app.use("/device",   deviceCommandsRoutes);
app.use("/sessions", sessionsRoutes);
app.use("/device",   deviceStatusRoutes);
app.use("/device",   deviceRoutes);
app.use("/chargers", chargersRoutes);
app.use("/admin",    adminRoutes);

// 404
app.use((_req, res) => {
  res.status(404).json({ error: "Not Found" });
});

// ── Wire MQTT (breaks circular import) ───────────────────────────────────────
//
// Both modules are now fully loaded. Wire them together:
//   1. Give mqttHandler the publish + subscribe functions it needs
//   2. Give mqttClient the message handler function
//   3. Connect to HiveMQ
//
initMqttHandler(mqttPublish, subscribeAllChargers); // handler gets publish fn
setMessageHandler(handleMqttMessage);               // client gets handler fn
connectMqtt();                                      // connect to HiveMQ

export default app;