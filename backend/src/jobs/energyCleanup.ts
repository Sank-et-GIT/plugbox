// ─────────────────────────────────────────────────────────────────────────────
// src/jobs/energyCleanup.ts
//
// PURPOSE:
//   ESP32 publishes energy readings every 500ms = 172,800 rows/day/charger.
//   This job runs every hour and keeps only 1 reading per minute per charger.
//   All other readings are deleted.
//
//   Strategy:
//     1. Find all readings older than 1 hour (recent readings kept as-is)
//     2. Group by charger + minute bucket
//     3. Mark the FIRST reading of each minute as "kept"
//     4. Delete all unmarked readings in that time range
//
//   Result: 60 readings/hour/charger instead of 7,200
//   Space saving: 99.2%
//
// SCHEDULE: Runs every 60 minutes
// ─────────────────────────────────────────────────────────────────────────────

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function runEnergyCleanup(): Promise<void> {
  const now      = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  console.log("[CLEANUP] Starting energy reading cleanup...");

  try {
    // Get all charger IDs that have readings
    const chargers = await prisma.energyReading.findMany({
      where:   { createdAt: { lt: oneHourAgo }, kept: false },
      select:  { chargerId: true },
      distinct: ["chargerId"],
    });

    let totalDeleted = 0;
    let totalKept    = 0;

    for (const { chargerId } of chargers) {
      // Get all old unprocessed readings for this charger
      const readings = await prisma.energyReading.findMany({
        where:   { chargerId, createdAt: { lt: oneHourAgo }, kept: false },
        orderBy: { createdAt: "asc" },
        select:  { id: true, createdAt: true },
      });

      if (readings.length === 0) continue;

      // Group by minute bucket — keep first reading of each minute
      const keepIds   = new Set<number>();
      const seenMinutes = new Set<string>();

      for (const r of readings) {
        // Minute bucket key: "chargerId-YYYY-MM-DD-HH-MM"
        const d   = r.createdAt;
        const key = `${chargerId}-${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}-${d.getMinutes()}`;

        if (!seenMinutes.has(key)) {
          seenMinutes.add(key);
          keepIds.add(r.id);  // Keep first reading of each minute
        }
      }

      // Mark readings to keep
      if (keepIds.size > 0) {
        await prisma.energyReading.updateMany({
          where: { id: { in: Array.from(keepIds) } },
          data:  { kept: true },
        });
        totalKept += keepIds.size;
      }

      // Delete all readings that are NOT kept
      const deleteIds = readings
        .map(r => r.id)
        .filter(id => !keepIds.has(id));

      if (deleteIds.length > 0) {
        await prisma.energyReading.deleteMany({
          where: { id: { in: deleteIds } },
        });
        totalDeleted += deleteIds.length;
      }
    }

    console.log(
      `[CLEANUP] Done — kept: ${totalKept} readings, deleted: ${totalDeleted} readings`
    );

  } catch (err) {
    console.error("[CLEANUP] Error during energy cleanup:", err);
  }
}

export function startEnergyCleanup(): void {
  const INTERVAL_MS = 60 * 60 * 1000; // Every 60 minutes

  console.log("[CLEANUP] Energy cleanup job scheduled (every 60 min)");

  // Run immediately on startup to clean any backlog
  runEnergyCleanup();

  // Then run every hour
  setInterval(runEnergyCleanup, INTERVAL_MS);
}
