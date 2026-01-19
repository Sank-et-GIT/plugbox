import { PrismaClient, BookingStatus } from "@prisma/client";

const prisma = new PrismaClient();

export function startBookingExpiryChecker() {
  setInterval(async () => {
    const now = new Date();

    try {
      await prisma.booking.updateMany({
        where: {
          status: BookingStatus.HOLD,
          expiresAt: { lt: now },
        },
        data: {
          status: BookingStatus.EXPIRED,
        },
      });
    } catch (err) {
      console.error("Booking expiry check error:", err);
    }
  }, 30 * 1000); // every 30 seconds
}
