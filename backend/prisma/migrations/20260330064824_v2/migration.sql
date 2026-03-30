/*
  Warnings:

  - A unique constraint covering the columns `[deviceId]` on the table `Charger` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `kwhLimit` to the `Booking` table without a default value. This is not possible if the table is not empty.
  - Added the required column `packageName` to the `Booking` table without a default value. This is not possible if the table is not empty.
  - Added the required column `packagePaise` to the `Booking` table without a default value. This is not possible if the table is not empty.
  - Added the required column `bookingId` to the `Session` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "WalletTxnType" AS ENUM ('TOPUP', 'PACKAGE_DEBIT', 'REFUND', 'DEPOSIT_COLLECT', 'DEPOSIT_REFUND');

-- AlterEnum
ALTER TYPE "CommandStatus" ADD VALUE 'FAILED';

-- AlterEnum
ALTER TYPE "SessionStatus" ADD VALUE 'PLUG_WAIT';

-- DropIndex
DROP INDEX "Session_chargerId_idx";

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "kwhLimit" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "packageName" TEXT NOT NULL,
ADD COLUMN     "packagePaise" INTEGER NOT NULL,
ADD COLUMN     "walletTxnId" TEXT;

-- AlterTable
ALTER TABLE "Charger" ADD COLUMN     "deviceId" TEXT,
ADD COLUMN     "displayName" TEXT NOT NULL DEFAULT 'PlugBox #1',
ADD COLUMN     "locationId" INTEGER,
ADD COLUMN     "mqttTopic" TEXT,
ADD COLUMN     "slotNumber" INTEGER NOT NULL DEFAULT 1,
ALTER COLUMN "status" SET DEFAULT 'OFFLINE';

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "bookingId" INTEGER NOT NULL,
ADD COLUMN     "buttonAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "finalKwh" DOUBLE PRECISION,
ADD COLUMN     "refundTxnId" TEXT,
ADD COLUMN     "walletTxnId" TEXT;

-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "deposit" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletTransaction" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "type" "WalletTxnType" NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "balancePaise" INTEGER NOT NULL,
    "note" TEXT,
    "sessionId" INTEGER,
    "bookingId" INTEGER,
    "razorpayId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Location" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnergyReading" (
    "id" SERIAL NOT NULL,
    "chargerId" INTEGER NOT NULL,
    "sessionId" INTEGER,
    "voltage" DOUBLE PRECISION NOT NULL,
    "current" DOUBLE PRECISION NOT NULL,
    "power" DOUBLE PRECISION NOT NULL,
    "energyKwh" DOUBLE PRECISION NOT NULL,
    "frequency" DOUBLE PRECISION NOT NULL,
    "powerFactor" DOUBLE PRECISION NOT NULL,
    "kept" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnergyReading_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_userId_key" ON "Wallet"("userId");

-- CreateIndex
CREATE INDEX "Wallet_userId_idx" ON "Wallet"("userId");

-- CreateIndex
CREATE INDEX "WalletTransaction_walletId_createdAt_idx" ON "WalletTransaction"("walletId", "createdAt");

-- CreateIndex
CREATE INDEX "WalletTransaction_sessionId_idx" ON "WalletTransaction"("sessionId");

-- CreateIndex
CREATE INDEX "WalletTransaction_bookingId_idx" ON "WalletTransaction"("bookingId");

-- CreateIndex
CREATE INDEX "EnergyReading_chargerId_createdAt_idx" ON "EnergyReading"("chargerId", "createdAt");

-- CreateIndex
CREATE INDEX "EnergyReading_sessionId_createdAt_idx" ON "EnergyReading"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "EnergyReading_kept_createdAt_idx" ON "EnergyReading"("kept", "createdAt");

-- CreateIndex
CREATE INDEX "Booking_status_expiresAt_idx" ON "Booking"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Charger_deviceId_key" ON "Charger"("deviceId");

-- CreateIndex
CREATE INDEX "Charger_deviceId_idx" ON "Charger"("deviceId");

-- CreateIndex
CREATE INDEX "Charger_locationId_idx" ON "Charger"("locationId");

-- CreateIndex
CREATE INDEX "Charger_status_idx" ON "Charger"("status");

-- CreateIndex
CREATE INDEX "DeviceCommand_sessionId_idx" ON "DeviceCommand"("sessionId");

-- CreateIndex
CREATE INDEX "Session_chargerId_status_idx" ON "Session"("chargerId", "status");

-- CreateIndex
CREATE INDEX "Session_bookingId_idx" ON "Session"("bookingId");

-- CreateIndex
CREATE INDEX "Session_status_updatedAt_idx" ON "Session"("status", "updatedAt");

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Charger" ADD CONSTRAINT "Charger_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnergyReading" ADD CONSTRAINT "EnergyReading_chargerId_fkey" FOREIGN KEY ("chargerId") REFERENCES "Charger"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnergyReading" ADD CONSTRAINT "EnergyReading_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE SET NULL ON UPDATE CASCADE;
