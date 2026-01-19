import app from "./app";
import { startOfflineChecker } from "./jobs/offlineCheck";
import { startBookingExpiryChecker } from "./jobs/bookingExpiry";


const PORT = process.env.PORT ? Number(process.env.PORT) : 8080;

app.listen(PORT, () => {
  console.log(`Sanket Your Backend Is running on http://localhost:${PORT}`);
  startOfflineChecker();
  startBookingExpiryChecker();
});
