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

app.use(cors());
app.use(express.json());
app.use("/bookings", bookingsRoutes);
app.use("/device", deviceCommandsRoutes);
app.use("/sessions", sessionsRoutes);
app.use("/device", deviceStatusRoutes);


app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

// Day 3 routes
app.use("/device", deviceRoutes);
app.use("/chargers", chargersRoutes);
app.use("/admin", adminRoutes);

export default app;
