// ─────────────────────────────────────────────────────────────────────────────
// src/routes/bookings.ts
//
// Purpose:
//   Creates a temporary HOLD booking for a charger.
//
// What this route does:
//   1. Validates request body
//   2. Checks charger exists
//   3. Checks wallet deposit + balance
//   4. Prevents double-booking using row lock
//   5. Debits package amount from wallet
//   6. Creates booking
//   7. Creates wallet transaction
//   8. Links wallet transaction to booking
//
// Important:
//   Uses SELECT ... FOR UPDATE SKIP LOCKED inside transaction.
//   This prevents two users from holding the same charger at the same time.
// ─────────────────────────────────────────────────────────────────────────────

import prisma from "../lib/prismaClient";
import { Router, Request, Response } from "express";
import { WalletTxnType } from "@prisma/client";
import { logDebug, logError, logInfo, logWarn } from "../lib/logger";

const router = Router();

const HOLD_MINUTES = 10;
const SECURITY_DEPOSIT_PAISE = 10_000;

// ─────────────────────────────────────────────────────────────────────────────
// POST /bookings/hold
//
// Body:
// {
//   chargerId: number,
//   userId: string,
//   packageName: string,
//   packagePaise: number,
//   kwhLimit: number
// }
// ─────────────────────────────────────────────────────────────────────────────
router.post("/hold", async (req: Request, res: Response) => {
  try {
    const { chargerId, userId, packageName, packagePaise, kwhLimit } = req.body as {
      chargerId: number;
      userId: string;
      packageName: string;
      packagePaise: number;
      kwhLimit: number;
    };

    // Trace incoming request payload
    logDebug("booking_hold_requested", {
      category: "booking",
      chargerId,
      userId,
      packageName,
      packagePaise,
      kwhLimit,
    });

    // ── Validate input ───────────────────────────────────────────────────────
    if (typeof chargerId !== "number") {
      return res.status(400).json({ ok: false, error: "chargerId must be a number" });
    }

    if (!userId) {
      return res.status(400).json({ ok: false, error: "userId is required" });
    }

    if (!packageName || typeof packagePaise !== "number" || typeof kwhLimit !== "number") {
      return res.status(400).json({
        ok: false,
        error: "packageName, packagePaise, kwhLimit required",
      });
    }

    // ── Charger lookup ───────────────────────────────────────────────────────
    const charger = await prisma.charger.findUnique({
      where: { id: chargerId },
    });

    logDebug("booking_hold_charger_lookup", {
      category: "booking",
      chargerId,
      found: !!charger,
    });

    if (!charger) {
      return res.status(404).json({ ok: false, error: "Charger not found" });
    }

    // ── Wallet / deposit checks ──────────────────────────────────────────────
    const wallet = await prisma.wallet.findUnique({
      where: { userId },
    });

    const hasDeposit = !!wallet && wallet.deposit >= SECURITY_DEPOSIT_PAISE;
    const balance = wallet?.balance ?? 0;

    logDebug("booking_hold_wallet_state", {
      category: "booking",
      userId,
      walletId: wallet?.id,
      balance,
      deposit: wallet?.deposit ?? 0,
      hasDeposit,
      requiredPackagePaise: packagePaise,
    });

    // First booking: deposit required
    if (!hasDeposit) {
      const totalRequired = SECURITY_DEPOSIT_PAISE + packagePaise;

      logWarn("booking_hold_insufficient_balance", {
        category: "booking",
        userId,
        chargerId,
        reason: "missing_deposit",
        balance,
        deposit: wallet?.deposit ?? 0,
        packagePaise,
        totalRequiredPaise: totalRequired,
      });

      return res.status(402).json({
        ok: false,
        reason: "insufficient_balance",
        needsDeposit: true,
        shortfallPaise: totalRequired,
        totalRequiredPaise: totalRequired,
        depositPaise: SECURITY_DEPOSIT_PAISE,
        packagePaise,
        message: `First booking: ₹${totalRequired / 100} (₹100 deposit + ₹${packagePaise / 100} package)`,
      });
    }

    // Returning user: enough wallet balance required
    if (balance < packagePaise) {
      const shortfall = packagePaise - balance;

      logWarn("booking_hold_insufficient_balance", {
        category: "booking",
        userId,
        chargerId,
        reason: "low_wallet_balance",
        balance,
        packagePaise,
        shortfallPaise: shortfall,
      });

      return res.status(402).json({
        ok: false,
        reason: "insufficient_balance",
        needsDeposit: false,
        shortfallPaise: shortfall,
        totalRequiredPaise: packagePaise,
        currentBalancePaise: balance,
        message: `Need ₹${shortfall / 100} more. Balance: ₹${balance / 100}`,
      });
    }

    // ── Create HOLD booking safely inside transaction ────────────────────────
    const booking = await prisma.$transaction(async (tx) => {
      // Row lock check:
      // If another active HOLD exists for this charger, prevent double booking.
      const locked = await tx.$queryRaw<{ id: number }[]>`
        SELECT id
        FROM "Booking"
        WHERE "chargerId" = ${chargerId}
          AND status = 'HOLD'
          AND "expiresAt" > NOW()
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      `;

      logDebug("booking_hold_lock_check", {
        category: "booking",
        chargerId,
        userId,
        lockedCount: locked.length,
      });

      if (locked.length > 0) {
        throw new Error("ALREADY_HELD");
      }

      const expiresAt = new Date(Date.now() + HOLD_MINUTES * 60 * 1000);
      const newBalance = balance - packagePaise;

      // Wallet debit
      logInfo("booking_wallet_debit_started", {
        category: "booking",
        userId,
        walletId: wallet!.id,
        oldBalance: balance,
        debitPaise: packagePaise,
        newBalance,
      });

      await tx.wallet.update({
        where: { userId },
        data: { balance: newBalance },
      });

      // Booking create
      const newBooking = await tx.booking.create({
        data: {
          chargerId,
          userId,
          packageName,
          packagePaise,
          kwhLimit,
          expiresAt,
        },
      });

      logInfo("booking_record_created", {
        category: "booking",
        bookingId: newBooking.id,
        chargerId,
        userId,
        packageName,
        packagePaise,
        kwhLimit,
        expiresAt: newBooking.expiresAt,
      });

      // Wallet transaction create
      const txn = await tx.walletTransaction.create({
        data: {
          walletId: wallet!.id,
          type: WalletTxnType.PACKAGE_DEBIT,
          amountPaise: packagePaise,
          balancePaise: newBalance,
          note: `${packageName} pack ₹${packagePaise / 100}`,
          bookingId: newBooking.id,
        },
      });

      logInfo("booking_wallet_transaction_created", {
        category: "booking",
        bookingId: newBooking.id,
        walletTxnId: txn.id,
        walletId: wallet!.id,
        amountPaise: packagePaise,
        balancePaise: newBalance,
        type: WalletTxnType.PACKAGE_DEBIT,
      });

      // Link wallet transaction to booking
      await tx.booking.update({
        where: { id: newBooking.id },
        data: { walletTxnId: txn.id },
      });

      logDebug("booking_wallet_transaction_linked", {
        category: "booking",
        bookingId: newBooking.id,
        walletTxnId: txn.id,
      });

      return newBooking;
    });

    // Final success log
    logInfo("booking_hold_created", {
      category: "booking",
      bookingId: booking.id,
      chargerId,
      userId,
      packageName,
      packagePaise,
      kwhLimit,
      expiresAt: booking.expiresAt,
    });

    return res.status(201).json({
      ok: true,
      bookingId: booking.id,
      expiresAt: booking.expiresAt,
      packageName,
      packagePaise,
      kwhLimit,
    });
  } catch (err: any) {
    // Expected business error: charger already held
    if (err.message === "ALREADY_HELD") {
      logWarn("booking_hold_conflict", {
        category: "booking",
        chargerId: req.body?.chargerId,
        userId: req.body?.userId,
        errorMessage: err.message,
      });

      return res.status(409).json({
        ok: false,
        reason: "already_held",
        error: "This charger is already booked. Try another slot.",
      });
    }

    // Unexpected server error
    logError("booking_hold_failed", {
      category: "booking",
      chargerId: req.body?.chargerId,
      userId: req.body?.userId,
      packageName: req.body?.packageName,
      packagePaise: req.body?.packagePaise,
      kwhLimit: req.body?.kwhLimit,
      errorMessage: err?.message,
      stack: err?.stack,
    });

    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

export default router;