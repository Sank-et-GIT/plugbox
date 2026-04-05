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
import { requestIdMiddleware } from "./middleware/requestId";
import { requestLogger } from "./middleware/requestLogger";
import { errorHandler } from "./middleware/errorHandler";
import { logError } from "./lib/logger";

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


// Request logger
app.use(cors());
app.use(express.json());

app.use(requestIdMiddleware);
app.use(requestLogger);

// Health
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.get("/test-error", () => {
  throw new Error("test route error");
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

app.use(errorHandler);

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

process.on("uncaughtException", (err) => {
  logError("uncaught_exception", {
    category: "error",
    errorMessage: err.message,
    stack: err.stack,
  });
});

process.on("unhandledRejection", (reason: any) => {
  logError("unhandled_rejection", {
    category: "error",
    errorMessage: reason?.message || String(reason),
    stack: reason?.stack,
  });
});

export default app;