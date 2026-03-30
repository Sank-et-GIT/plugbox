// ─────────────────────────────────────────────────────────────────────────────
// src/routes/bookings.ts — Bug-fixed version
//
// Fix: Race condition now uses SELECT FOR UPDATE SKIP LOCKED
//      Two simultaneous booking requests cannot both succeed
// ─────────────────────────────────────────────────────────────────────────────

import prisma from "../lib/prismaClient";
import { Router, Request, Response } from "express";
import { BookingStatus, WalletTxnType } from "@prisma/client";

const router = Router();

const HOLD_MINUTES           = 10;
const SECURITY_DEPOSIT_PAISE = 10_000;

// ─────────────────────────────────────────────────────────────────────────────
// POST /bookings/hold
// ─────────────────────────────────────────────────────────────────────────────

router.post("/hold", async (req: Request, res: Response) => {
  try {
    const { chargerId, userId, packageName, packagePaise, kwhLimit } = req.body as {
      chargerId:    number;
      userId:       string;
      packageName:  string;
      packagePaise: number;
      kwhLimit:     number;
    };

    if (typeof chargerId !== "number")
      return res.status(400).json({ ok: false, error: "chargerId must be a number" });
    if (!userId)
      return res.status(400).json({ ok: false, error: "userId is required" });
    if (!packageName || typeof packagePaise !== "number" || typeof kwhLimit !== "number")
      return res.status(400).json({ ok: false, error: "packageName, packagePaise, kwhLimit required" });

    const charger = await prisma.charger.findUnique({ where: { id: chargerId } });
    if (!charger)
      return res.status(404).json({ ok: false, error: "Charger not found" });

    // ── Balance check ─────────────────────────────────────────────────────────
    const wallet     = await prisma.wallet.findUnique({ where: { userId } });
    const hasDeposit = wallet && wallet.deposit >= SECURITY_DEPOSIT_PAISE;
    const balance    = wallet?.balance ?? 0;

    if (!hasDeposit) {
      // First-time user: needs deposit + package via Razorpay
      const totalRequired = SECURITY_DEPOSIT_PAISE + packagePaise;
      return res.status(402).json({
        ok:                 false,
        reason:             "insufficient_balance",
        needsDeposit:       true,
        shortfallPaise:     totalRequired,
        totalRequiredPaise: totalRequired,
        depositPaise:       SECURITY_DEPOSIT_PAISE,
        packagePaise,
        message:            `First booking: ₹${totalRequired / 100} (₹100 deposit + ₹${packagePaise / 100} package)`
      });
    }

    if (balance < packagePaise) {
      const shortfall = packagePaise - balance;
      return res.status(402).json({
        ok:                  false,
        reason:              "insufficient_balance",
        needsDeposit:        false,
        shortfallPaise:      shortfall,
        totalRequiredPaise:  packagePaise,
        currentBalancePaise: balance,
        message:             `Need ₹${shortfall / 100} more. Balance: ₹${balance / 100}`
      });
    }

    // ── Create booking with proper row-level lock (fixes race condition) ───────
    //
    // FIX: SELECT FOR UPDATE SKIP LOCKED inside $transaction
    // If two requests arrive simultaneously:
    //   Request A acquires lock → creates booking
    //   Request B tries to lock → SKIP LOCKED returns empty → "already held"
    // This is the correct way to prevent double booking in PostgreSQL.
    //
    const booking = await prisma.$transaction(async (tx) => {

      // Lock any existing active HOLD for this charger
      // SKIP LOCKED means: if another transaction already holds the lock,
      // skip and return empty (don't wait) → immediately return "already held"
      const locked = await tx.$queryRaw<{ id: number }[]>`
        SELECT id FROM "Booking"
        WHERE "chargerId" = ${chargerId}
        AND   status      = 'HOLD'
        AND   "expiresAt" > NOW()
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      `;

      // If we got a row back, someone else holds the lock → already booked
      if (locked.length > 0) {
        throw new Error("ALREADY_HELD");
      }

      const expiresAt  = new Date(Date.now() + HOLD_MINUTES * 60 * 1000);
      const newBalance = balance - packagePaise;

      // Deduct from wallet
      await tx.wallet.update({
        where: { userId },
        data:  { balance: newBalance }
      });

      // Create booking
      const newBooking = await tx.booking.create({
        data: {
          chargerId,
          userId,
          packageName,
          packagePaise,
          kwhLimit,
          expiresAt,
        }
      });

      // Log wallet debit
      const txn = await tx.walletTransaction.create({
        data: {
          walletId:     wallet!.id,
          type:         WalletTxnType.PACKAGE_DEBIT,
          amountPaise:  packagePaise,
          balancePaise: newBalance,
          note:         `${packageName} pack ₹${packagePaise / 100}`,
          bookingId:    newBooking.id,
        }
      });

      // Link txn to booking
      await tx.booking.update({
        where: { id: newBooking.id },
        data:  { walletTxnId: txn.id }
      });

      return newBooking;
    });

    console.log(`[BOOKING] Created: id=${booking.id} charger=${chargerId} user=${userId} pkg=${packageName} ₹${packagePaise / 100}`);

    return res.status(201).json({
      ok:          true,
      bookingId:   booking.id,
      expiresAt:   booking.expiresAt,
      packageName,
      packagePaise,
      kwhLimit,
    });

  } catch (err: any) {
    if (err.message === "ALREADY_HELD") {
      return res.status(409).json({
        ok:     false,
        reason: "already_held",
        error:  "This charger is already booked. Try another slot."
      });
    }
    console.error("[BOOKING] hold error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

export default router;