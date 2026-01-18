import express from "express";
import cors from "cors";

import deviceRoutes from "./routes/device";
import chargersRoutes from "./routes/chargers";
import adminRoutes from "./routes/admin";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

// Day 3 routes
app.use("/device", deviceRoutes);
app.use("/chargers", chargersRoutes);
app.use("/admin", adminRoutes);

export default app;
