// ─────────────────────────────────────────────────────────────────────────────
// src/jobs/energyCleanup.ts
//
// Runs every 60 minutes.
// ESP32 publishes every 500ms = 172,800 rows/day/charger.
// Keeps 1 reading per minute per charger. Deletes the rest.
// Space saving: ~99%
// ─────────────────────────────────────────────────────────────────────────────

import prisma from "../lib/prismaClient";
import prisma from "../lib/prismaClient";



export async function runEnergyCleanup(): Promise<void> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  console.log("[CLEANUP] Starting energy reading cleanup...");

  try {
    const chargers = await prisma.energyReading.findMany({
      where:   { createdAt: { lt: oneHourAgo }, kept: false },
      select:  { chargerId: true },
      distinct: ["chargerId"],
    });

    let totalDeleted = 0;
    let totalKept    = 0;

    for (const { chargerId } of chargers) {
      const readings = await prisma.energyReading.findMany({
        where:   { chargerId, createdAt: { lt: oneHourAgo }, kept: false },
        orderBy: { createdAt: "asc" },
        select:  { id: true, createdAt: true },
      });

      if (readings.length === 0) continue;

      const keepIds     = new Set<number>();
      const seenMinutes = new Set<string>();

      for (const r of readings) {
        const d   = r.createdAt;
        const key = `${chargerId}-${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}-${d.getMinutes()}`;
        if (!seenMinutes.has(key)) {
          seenMinutes.add(key);
          keepIds.add(r.id);
        }
      }

      if (keepIds.size > 0) {
        await prisma.energyReading.updateMany({
          where: { id: { in: Array.from(keepIds) } },
          data:  { kept: true },
        });
        totalKept += keepIds.size;
      }

      const deleteIds = readings.map(r => r.id).filter(id => !keepIds.has(id));
      if (deleteIds.length > 0) {
        await prisma.energyReading.deleteMany({
          where: { id: { in: deleteIds } },
        });
        totalDeleted += deleteIds.length;
      }
    }

    console.log(`[CLEANUP] Done — kept: ${totalKept}, deleted: ${totalDeleted}`);

  } catch (err) {
    console.error("[CLEANUP] Error:", err);
  }
}

export function startEnergyCleanup(): void {
  console.log("[CLEANUP] Energy cleanup job started (every 60min)");
  runEnergyCleanup(); // Run once on startup to clear any backlog
  setInterval(runEnergyCleanup, 60 * 60 * 1000);
}