import app                         from "./app";
import { startBookingExpiryChecker } from "./jobs/bookingExpiry";
import { startSessionTimeout }       from "./jobs/sessionTimeout";
import { startEnergyCleanup }        from "./jobs/energyCleanup";
import { startOfflineChecker }       from "./jobs/offlineCheck";

const PORT = process.env.PORT ? Number(process.env.PORT) : 8080;

app.listen(PORT, () => {
  console.log(`⚡ PlugBox backend running on http://localhost:${PORT}`);

  // Background jobs
  startOfflineChecker();       // marks charger OFFLINE after 30min no heartbeat
  startBookingExpiryChecker(); // expires HOLD bookings + refunds wallet
  startSessionTimeout();       // 3min PLUG_WAIT timeout + auto-stop at kWh limit
  startEnergyCleanup();        // keeps DB lean (1 reading/min)
});