-- AlterEnum
ALTER TYPE "BookingStatus" ADD VALUE 'FAILED';

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "kwhAtStart" DOUBLE PRECISION;
