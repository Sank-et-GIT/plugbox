import express from "express";
import cors from "cors";

import deviceRoutes from "./routes/device";
import chargersRoutes from "./routes/chargers";
import adminRoutes from "./routes/admin";
import bookingsRoutes from "./routes/bookings";
import deviceCommandsRoutes from "./routes/deviceCommands";
import sessionsRoutes from "./routes/sessions";
import deviceStatusRoutes from "./routes/deviceStatus";
import authRoutes from "./routes/auth";          // ← NEW: auth routes

const app = express();

app.set("trust proxy", true);
app.use(cors());
app.use(express.json());

// Request logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const ms = Date.now() - start;
    const ip = req.ip || req.socket.remoteAddress || "unknown-ip";
    console.log(`[HTTP] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${ms}ms) ip=${ip}`);
  });
  next();
});

// Health
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/auth", authRoutes);                    // ← NEW: phone OTP auth
app.use("/bookings", bookingsRoutes);
app.use("/device", deviceCommandsRoutes);
app.use("/sessions", sessionsRoutes);
app.use("/device", deviceStatusRoutes);
app.use("/device", deviceRoutes);
app.use("/chargers", chargersRoutes);
app.use("/admin", adminRoutes);

// 404
app.use((_req, res) => {
  res.status(404).json({ error: "Not Found" });
});

export default app;