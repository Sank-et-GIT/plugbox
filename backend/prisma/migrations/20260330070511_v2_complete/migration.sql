-- DropIndex
DROP INDEX "Session_status_updatedAt_idx";

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "plugWaitStartedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Session_status_plugWaitStartedAt_idx" ON "Session"("status", "plugWaitStartedAt");

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
