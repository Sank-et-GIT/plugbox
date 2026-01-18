import app from "./app";
import { startOfflineChecker } from "./jobs/offlineCheck";

const PORT = process.env.PORT ? Number(process.env.PORT) : 8080;

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
  startOfflineChecker();
});
