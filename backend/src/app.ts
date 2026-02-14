import express from "express";
import cors from "cors";

import deviceRoutes from "./routes/device";
import chargersRoutes from "./routes/chargers";
import adminRoutes from "./routes/admin";
import bookingsRoutes from "./routes/bookings";
import deviceCommandsRoutes from "./routes/deviceCommands";
import sessionsRoutes from "./routes/sessions";
import deviceStatusRoutes from "./routes/deviceStatus";

const app = express();

/**
 * If you later put this behind a reverse proxy (Caddy/Nginx),
 * this ensures req.ip is accurate.
 * Safe to keep even now.
 */
app.set("trust proxy", true);

// CORS + JSON
app.use(cors());
app.use(express.json());

/**
 * ✅ Request Logger (shows in pm2 logs)
 * Logs: method, url, status, duration, ip
 */
app.use((req, res, next) => {
  const start = Date.now();

  res.on("finish", () => {
    const ms = Date.now() - start;
    const ip = req.ip || req.socket.remoteAddress || "unknown-ip";
    console.log(`[HTTP] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${ms}ms) ip=${ip}`);
  });

  next();
});

// Health (keep simple)
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

/**
 * Routes
 * (Kept exactly as your design)
 */
app.use("/bookings", bookingsRoutes);
app.use("/device", deviceCommandsRoutes);
app.use("/sessions", sessionsRoutes);
app.use("/device", deviceStatusRoutes);

// Day 3 routes
app.use("/device", deviceRoutes);
app.use("/chargers", chargersRoutes);
app.use("/admin", adminRoutes);

/**
 * Optional: basic 404 handler (nice for debugging)
 */
app.use((_req, res) => {
  res.status(404).json({ error: "Not Found" });
});

export default app;
