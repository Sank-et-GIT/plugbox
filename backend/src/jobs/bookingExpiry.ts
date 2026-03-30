// ─────────────────────────────────────────────────────────────────────────────
// src/jobs/bookingExpiry.ts
//
// Runs every 60 seconds.
// Finds HOLD bookings past expiresAt → marks EXPIRED → full refund to wallet.
// ─────────────────────────────────────────────────────────────────────────────

import { PrismaClient, BookingStatus, WalletTxnType } from "@prisma/client";

const prisma = new PrismaClient();

export async function runBookingExpiry(): Promise<void> {
  const expiredBookings = await prisma.booking.findMany({
    where: {
      status:    BookingStatus.HOLD,
      expiresAt: { lt: new Date() },
    }
  });

  for (const booking of expiredBookings) {
    try {
      await prisma.$transaction(async (tx) => {
        // Mark expired
        await tx.booking.update({
          where: { id: booking.id },
          data:  { status: BookingStatus.EXPIRED }
        });

        // Full refund to wallet
        const wallet = await tx.wallet.findUnique({
          where: { userId: booking.userId }
        });

        if (wallet && booking.packagePaise > 0) {
          const newBalance = wallet.balance + booking.packagePaise;
          await tx.wallet.update({
            where: { userId: booking.userId },
            data:  { balance: newBalance }
          });
          await tx.walletTransaction.create({
            data: {
              walletId:     wallet.id,
              type:         WalletTxnType.REFUND,
              amountPaise:  booking.packagePaise,
              balancePaise: newBalance,
              note:         `Booking expired — full refund ₹${booking.packagePaise / 100}`,
              bookingId:    booking.id,
            }
          });
        }
      });

      console.log(`[EXPIRY] Booking ${booking.id} expired → refunded ₹${booking.packagePaise / 100}`);
    } catch (err) {
      console.error(`[EXPIRY] Error expiring booking ${booking.id}:`, err);
    }
  }
}

export function startBookingExpiryChecker(): void {
  console.log("[EXPIRY] Booking expiry job started (every 60s)");
  runBookingExpiry();
  setInterval(runBookingExpiry, 60_000);
}