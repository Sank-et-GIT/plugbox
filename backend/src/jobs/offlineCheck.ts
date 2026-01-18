import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const OFFLINE_THRESHOLD_MS = 15 * 1000; // 15 seconds

export function startOfflineChecker() {
  setInterval(async () => {
    const now = new Date();
    const cutoff = new Date(now.getTime() - OFFLINE_THRESHOLD_MS);

    try {
      await prisma.charger.updateMany({
        where: {
          lastSeen: { lt: cutoff },
          status: { not: "OFFLINE" },
        },
        data: { status: "OFFLINE" },
      });
    } catch (err) {
      console.error("Offline check error:", err);
    }
  }, 30 * 1000); // run every 30 sec
}
