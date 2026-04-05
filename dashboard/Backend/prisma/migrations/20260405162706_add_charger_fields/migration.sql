/*
  Warnings:

  - You are about to drop the `AndroidUser` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "Charger" ADD COLUMN "chargerType" TEXT DEFAULT 'AC';
ALTER TABLE "Charger" ADD COLUMN "connectorType" TEXT DEFAULT 'Type2';
ALTER TABLE "Charger" ADD COLUMN "pricePerUnit" REAL DEFAULT 10.0;
ALTER TABLE "Charger" ADD COLUMN "serialNumber" TEXT;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "AndroidUser";
PRAGMA foreign_keys=on;
