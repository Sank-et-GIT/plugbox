// ─────────────────────────────────────────────────────────────────────────────
// src/routes/wallet.ts
//
// Purpose:
//   Handles wallet reads, Razorpay order creation, webhook processing,
//   and payment verification.
//
// Main responsibilities:
//   1. Return wallet balance + recent transactions
//   2. Create Razorpay orders for top-up / first booking / shortfall
//   3. Process Razorpay webhook safely and idempotently
//   4. Verify Razorpay payment signature from app callback
//
// Notes:
//   - Razorpay webhook route uses express.raw() in app.ts
//   - Webhook processing is idempotent using razorpayId
//   - For first_booking:
//       amount = deposit + package
//       deposit is locked in wallet.deposit
//       package is recorded as PACKAGE_DEBIT
// ─────────────────────────────────────────────────────────────────────────────

import prisma from "../lib/prismaClient";
import { Router, Request, Response } from "express";
import { WalletTxnType } from "@prisma/client";
import { logDebug, logError, logInfo, logWarn } from "../lib/logger";
import * as crypto from "crypto";

const router = Router();

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID ?? "";
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET ?? "";
const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET ?? "";

const SECURITY_DEPOSIT_PAISE = 10_000; // ₹100

// ─────────────────────────────────────────────────────────────────────────────
// GET /wallet/:userId
//
// Returns wallet balance, deposit, and latest transactions.
// If wallet does not exist yet, returns zeroed values.
// ─────────────────────────────────────────────────────────────────────────────
router.get("/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    logDebug("wallet_fetch_requested", {
      category: "wallet",
      userId,
    });

    const wallet = await prisma.wallet.findUnique({
      where: { userId },
      include: {
        transactions: {
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
    });

    logDebug("wallet_fetch_result", {
      category: "wallet",
      userId,
      walletId: wallet?.id,
      found: !!wallet,
      balance: wallet?.balance ?? 0,
      deposit: wallet?.deposit ?? 0,
      transactionCount: wallet?.transactions?.length ?? 0,
    });

    if (!wallet) {
      return res.json({
        ok: true,
        balance: 0,
        balanceInr: 0,
        deposit: 0,
        depositInr: 0,
        transactions: [],
      });
    }

    return res.json({
      ok: true,
      balance: wallet.balance,
      balanceInr: wallet.balance / 100,
      deposit: wallet.deposit,
      depositInr: wallet.deposit / 100,
      transactions: wallet.transactions.map((t) => ({
        id: t.id,
        type: t.type,
        amountInr: t.amountPaise / 100,
        balanceInr: t.balancePaise / 100,
        note: t.note,
        createdAt: t.createdAt,
      })),
    });
  } catch (err: any) {
    logError("wallet_fetch_failed", {
      category: "wallet",
      userId: req.params?.userId,
      errorMessage: err?.message,
      stack: err?.stack,
    });

    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /wallet/create-order
//
// Creates a Razorpay order.
//
// Body:
// {
//   userId: string,
//   amountPaise: number,
//   purpose: "topup" | "first_booking" | "shortfall",
//   bookingMeta?: {
//     chargerId: number,
//     packageName: string,
//     packagePaise: number,
//     kwhLimit: number
//   }
// }
// ─────────────────────────────────────────────────────────────────────────────
router.post("/create-order", async (req: Request, res: Response) => {
  try {
    const { userId, amountPaise, purpose, bookingMeta } = req.body as {
      userId: string;
      amountPaise: number;
      purpose: "topup" | "first_booking" | "shortfall";
      bookingMeta?: {
        chargerId: number;
        packageName: string;
        packagePaise: number;
        kwhLimit: number;
      };
    };

    logDebug("wallet_create_order_requested", {
      category: "wallet",
      userId,
      amountPaise,
      purpose,
      bookingMeta,
    });

    if (!userId || !amountPaise || !purpose) {
      return res.status(400).json({ ok: false, error: "Missing required fields" });
    }

    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      logError("wallet_razorpay_not_configured", {
        category: "wallet",
        userId,
        purpose,
      });

      return res.status(500).json({ ok: false, error: "Razorpay not configured" });
    }

    const auth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString("base64");

    logInfo("wallet_create_order_razorpay_request_started", {
      category: "wallet",
      userId,
      amountPaise,
      purpose,
    });

    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: "INR",
        notes: {
          userId,
          purpose,
          bookingMeta: bookingMeta ? JSON.stringify(bookingMeta) : "",
        },
      }),
    });

    if (!response.ok) {
      const errBody = await response.json();

      logError("wallet_create_order_razorpay_failed", {
        category: "wallet",
        userId,
        amountPaise,
        purpose,
        razorpayResponse: errBody,
      });

      return res.status(502).json({
        ok: false,
        error: "Could not create payment order. Try again.",
      });
    }

    const order = (await response.json()) as {
      id: string;
      amount: number;
      currency: string;
    };

    logInfo("wallet_order_created", {
      category: "wallet",
      userId,
      orderId: order.id,
      amountPaise: order.amount,
      currency: order.currency,
      purpose,
    });

    return res.json({
      ok: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: RAZORPAY_KEY_ID,
    });
  } catch (err: any) {
    logError("wallet_create_order_failed", {
      category: "wallet",
      userId: req.body?.userId,
      amountPaise: req.body?.amountPaise,
      purpose: req.body?.purpose,
      errorMessage: err?.message,
      stack: err?.stack,
    });

    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /wallet/razorpay-webhook
//
// Important:
//   - app.ts uses express.raw() for this route
//   - req.body is Buffer, so use toString("utf8") for HMAC verification
//   - only processes payment.captured
//   - idempotent using walletTransaction.razorpayId
// ─────────────────────────────────────────────────────────────────────────────
router.post("/razorpay-webhook", async (req: Request, res: Response) => {
  try {
    const signature = req.headers["x-razorpay-signature"] as string;

    const rawBody =
      req.body instanceof Buffer ? req.body.toString("utf8") : JSON.stringify(req.body);

    logDebug("wallet_webhook_received", {
      category: "wallet",
      hasSignature: !!signature,
      rawBodyLength: rawBody.length,
    });

    // Verify webhook signature if secret is configured
    if (WEBHOOK_SECRET) {
      const expected = crypto
        .createHmac("sha256", WEBHOOK_SECRET)
        .update(rawBody)
        .digest("hex");

      if (signature !== expected) {
        logWarn("wallet_webhook_signature_mismatch", {
          category: "wallet",
        });

        return res.status(400).json({ ok: false, error: "Invalid signature" });
      }
    }

    const event = JSON.parse(rawBody) as {
      event: string;
      payload: {
        payment: {
          entity: {
            id: string;
            order_id: string;
            amount: number;
            notes: {
              userId: string;
              purpose: string;
              bookingMeta: string;
            };
          };
        };
      };
    };

    logInfo("wallet_webhook_event_parsed", {
      category: "wallet",
      eventType: event.event,
    });

    // Ignore non-captured events
    if (event.event !== "payment.captured") {
      logDebug("wallet_webhook_ignored_event", {
        category: "wallet",
        eventType: event.event,
      });

      return res.json({ ok: true });
    }

    const payment = event.payload.payment.entity;
    const paymentId = payment.id;
    const amountPaise = payment.amount;
    const { userId, purpose, bookingMeta: bookingMetaStr } = payment.notes;

    logInfo("wallet_webhook_payment_captured", {
      category: "wallet",
      userId,
      paymentId,
      orderId: payment.order_id,
      amountPaise,
      purpose,
    });

    // Idempotency check
    const alreadyProcessed = await prisma.walletTransaction.findFirst({
      where: { razorpayId: paymentId },
    });

    if (alreadyProcessed) {
      logWarn("wallet_webhook_duplicate_payment_skipped", {
        category: "wallet",
        userId,
        paymentId,
        walletTxnId: alreadyProcessed.id,
      });

      return res.json({ ok: true });
    }

    // Ensure wallet exists
    let wallet = await prisma.wallet.findUnique({ where: { userId } });

    if (!wallet) {
      wallet = await prisma.wallet.create({
        data: { userId, balance: 0, deposit: 0 },
      });

      logInfo("wallet_created_for_user", {
        category: "wallet",
        userId,
        walletId: wallet.id,
      });
    }

    // ── Top-up flow ──────────────────────────────────────────────────────────
    if (purpose === "topup") {
      const newBalance = wallet.balance + amountPaise;

      logInfo("wallet_topup_transaction_started", {
        category: "wallet",
        userId,
        walletId: wallet.id,
        paymentId,
        oldBalance: wallet.balance,
        amountPaise,
        newBalance,
      });

      await prisma.$transaction(async (tx) => {
        await tx.wallet.update({
          where: { userId },
          data: { balance: newBalance },
        });

        await tx.walletTransaction.create({
          data: {
            walletId: wallet!.id,
            type: WalletTxnType.TOPUP,
            amountPaise,
            balancePaise: newBalance,
            note: `Wallet top-up ₹${amountPaise / 100}`,
            razorpayId: paymentId,
          },
        });
      });

      logInfo("wallet_topup_completed", {
        category: "wallet",
        userId,
        walletId: wallet.id,
        paymentId,
        amountPaise,
        newBalance,
      });
    }

    // ── First booking / shortfall flow ───────────────────────────────────────
    else if (purpose === "first_booking" || purpose === "shortfall") {
      const isFirst = purpose === "first_booking";
      const depositPaise = isFirst ? SECURITY_DEPOSIT_PAISE : 0;
      const packagePaise = amountPaise - depositPaise;

      let bookingMeta: {
        chargerId: number;
        packageName: string;
        packagePaise: number;
        kwhLimit: number;
      } | null = null;

      try {
        bookingMeta = JSON.parse(bookingMetaStr);
      } catch {
        logError("wallet_webhook_booking_meta_invalid", {
          category: "wallet",
          userId,
          paymentId,
          bookingMeta: bookingMetaStr,
        });

        return res.status(400).json({ ok: false, error: "Invalid booking metadata" });
      }

      logInfo("wallet_booking_payment_transaction_started", {
        category: "wallet",
        userId,
        walletId: wallet.id,
        paymentId,
        purpose,
        depositPaise,
        packagePaise,
        bookingMeta,
      });

      await prisma.$transaction(async (tx) => {
        const newDeposit = wallet!.deposit + depositPaise;
        const newBalance = wallet!.balance; // package paid directly, wallet balance unchanged

        await tx.wallet.update({
          where: { userId },
          data: { deposit: newDeposit },
        });

        logDebug("wallet_deposit_updated", {
          category: "wallet",
          userId,
          walletId: wallet!.id,
          oldDeposit: wallet!.deposit,
          addedDepositPaise: depositPaise,
          newDeposit,
        });

        // Deposit transaction only for first booking
        if (isFirst && depositPaise > 0) {
          await tx.walletTransaction.create({
            data: {
              walletId: wallet!.id,
              type: WalletTxnType.DEPOSIT_COLLECT,
              amountPaise: depositPaise,
              balancePaise: newBalance,
              note: "Security deposit ₹100 (locked permanently)",
              razorpayId: paymentId,
            },
          });

          logInfo("wallet_deposit_transaction_created", {
            category: "wallet",
            userId,
            walletId: wallet!.id,
            paymentId,
            depositPaise,
          });
        }

        if (bookingMeta) {
          const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

          const booking = await tx.booking.create({
            data: {
              chargerId: bookingMeta.chargerId,
              userId,
              packageName: bookingMeta.packageName,
              packagePaise: bookingMeta.packagePaise,
              kwhLimit: bookingMeta.kwhLimit,
              expiresAt,
            },
          });

          logInfo("wallet_booking_created_via_webhook", {
            category: "wallet",
            bookingId: booking.id,
            userId,
            chargerId: bookingMeta.chargerId,
            packageName: bookingMeta.packageName,
            packagePaise,
            expiresAt,
          });

          const txn = await tx.walletTransaction.create({
            data: {
              walletId: wallet!.id,
              type: WalletTxnType.PACKAGE_DEBIT,
              amountPaise: packagePaise,
              balancePaise: newBalance,
              note: `${bookingMeta.packageName} pack ₹${packagePaise / 100}`,
              bookingId: booking.id,
              razorpayId: paymentId,
            },
          });

          logInfo("wallet_package_transaction_created", {
            category: "wallet",
            walletTxnId: txn.id,
            walletId: wallet!.id,
            bookingId: booking.id,
            userId,
            packagePaise,
            paymentId,
          });

          await tx.booking.update({
            where: { id: booking.id },
            data: { walletTxnId: txn.id },
          });

          logDebug("wallet_booking_transaction_linked", {
            category: "wallet",
            bookingId: booking.id,
            walletTxnId: txn.id,
          });
        }
      });

      logInfo("wallet_booking_payment_completed", {
        category: "wallet",
        userId,
        walletId: wallet.id,
        paymentId,
        purpose,
        depositPaise,
        packagePaise,
      });
    }

    return res.json({ ok: true });
  } catch (err: any) {
    logError("wallet_webhook_failed", {
      category: "wallet",
      errorMessage: err?.message,
      stack: err?.stack,
    });

    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /wallet/verify-payment
//
// Called by app after Razorpay SDK success callback.
// Verifies payment signature.
// Then checks whether webhook already processed the payment.
// ─────────────────────────────────────────────────────────────────────────────
router.post("/verify-payment", async (req: Request, res: Response) => {
  try {
    const { razorpayPaymentId, razorpayOrderId, razorpaySignature, userId } = req.body as {
      razorpayPaymentId: string;
      razorpayOrderId: string;
      razorpaySignature: string;
      userId: string;
    };

    logDebug("wallet_verify_payment_requested", {
      category: "wallet",
      userId,
      razorpayPaymentId,
      razorpayOrderId,
    });

    if (!razorpayPaymentId || !razorpayOrderId || !razorpaySignature) {
      return res.status(400).json({ ok: false, error: "Missing payment fields" });
    }

    const expectedSig = crypto
      .createHmac("sha256", RAZORPAY_KEY_SECRET)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest("hex");

    if (expectedSig !== razorpaySignature) {
      logWarn("wallet_verify_payment_signature_invalid", {
        category: "wallet",
        userId,
        razorpayPaymentId,
        razorpayOrderId,
      });

      return res.status(400).json({ ok: false, error: "Invalid payment signature" });
    }

    const txn = await prisma.walletTransaction.findFirst({
      where: { razorpayId: razorpayPaymentId },
    });

    // Payment already processed by webhook
    if (txn) {
      const booking = await prisma.booking.findFirst({
        where: { userId, walletTxnId: txn.id },
        orderBy: { createdAt: "desc" },
      });

      logInfo("wallet_verify_payment_processed", {
        category: "wallet",
        userId,
        razorpayPaymentId,
        walletTxnId: txn.id,
        bookingId: booking?.id ?? null,
      });

      return res.json({
        ok: true,
        processed: true,
        bookingId: booking?.id ?? null,
      });
    }

    // Signature valid, but webhook has not processed it yet
    logInfo("wallet_verify_payment_pending_webhook", {
      category: "wallet",
      userId,
      razorpayPaymentId,
      razorpayOrderId,
    });

    return res.json({
      ok: true,
      processed: false,
      message: "Payment verified. Processing in progress.",
    });
  } catch (err: any) {
    logError("wallet_verify_payment_failed", {
      category: "wallet",
      userId: req.body?.userId,
      razorpayPaymentId: req.body?.razorpayPaymentId,
      razorpayOrderId: req.body?.razorpayOrderId,
      errorMessage: err?.message,
      stack: err?.stack,
    });

    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

export default router;