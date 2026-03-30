// ─────────────────────────────────────────────────────────────────────────────
// src/routes/wallet.ts — Bug-fixed version
//
// Fixes:
//   1. Webhook body: Buffer.toString() instead of JSON.stringify(Buffer)
//   2. Razorpay HTTP error response handled properly
//   3. fetch() — requires Node 18+. Run `node --version` to verify.
// ─────────────────────────────────────────────────────────────────────────────

import { Router, Request, Response } from "express";
import { PrismaClient, WalletTxnType } from "@prisma/client";
import * as crypto from "crypto";

const router = Router();
const prisma  = new PrismaClient();

const RAZORPAY_KEY_ID     = process.env.RAZORPAY_KEY_ID     ?? "";
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET ?? "";
const WEBHOOK_SECRET      = process.env.RAZORPAY_WEBHOOK_SECRET ?? "";

const SECURITY_DEPOSIT_PAISE = 10_000; // ₹100

// ─────────────────────────────────────────────────────────────────────────────
// GET /wallet/:userId
// ─────────────────────────────────────────────────────────────────────────────

router.get("/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const wallet = await prisma.wallet.findUnique({
      where:   { userId },
      include: {
        transactions: {
          orderBy: { createdAt: "desc" },
          take:    20,
        }
      }
    });

    if (!wallet) {
      return res.json({
        ok:           true,
        balance:      0,
        balanceInr:   0,
        deposit:      0,
        depositInr:   0,
        transactions: []
      });
    }

    return res.json({
      ok:          true,
      balance:     wallet.balance,
      balanceInr:  wallet.balance / 100,
      deposit:     wallet.deposit,
      depositInr:  wallet.deposit / 100,
      transactions: wallet.transactions.map(t => ({
        id:         t.id,
        type:       t.type,
        amountInr:  t.amountPaise  / 100,
        balanceInr: t.balancePaise / 100,
        note:       t.note,
        createdAt:  t.createdAt,
      }))
    });

  } catch (err) {
    console.error("[WALLET] get error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /wallet/create-order
// Creates a Razorpay order. App opens Razorpay SDK with orderId + keyId.
//
// Body: {
//   userId:       string
//   amountPaise:  number
//   purpose:      "topup" | "first_booking" | "shortfall"
//   bookingMeta?: { chargerId, packageName, packagePaise, kwhLimit }
// }
// ─────────────────────────────────────────────────────────────────────────────

router.post("/create-order", async (req: Request, res: Response) => {
  try {
    const { userId, amountPaise, purpose, bookingMeta } = req.body as {
      userId:       string;
      amountPaise:  number;
      purpose:      "topup" | "first_booking" | "shortfall";
      bookingMeta?: {
        chargerId:    number;
        packageName:  string;
        packagePaise: number;
        kwhLimit:     number;
      };
    };

    if (!userId || !amountPaise || !purpose) {
      return res.status(400).json({ ok: false, error: "Missing required fields" });
    }

    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      return res.status(500).json({ ok: false, error: "Razorpay not configured" });
    }

    const auth = Buffer
      .from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`)
      .toString("base64");

    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method:  "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({
        amount:   amountPaise,
        currency: "INR",
        notes: {
          userId,
          purpose,
          bookingMeta: bookingMeta ? JSON.stringify(bookingMeta) : "",
        }
      })
    });

    // FIX: Handle Razorpay HTTP errors properly
    if (!response.ok) {
      const errBody = await response.json();
      console.error("[WALLET] Razorpay order creation failed:", errBody);
      return res.status(502).json({
        ok:    false,
        error: "Could not create payment order. Try again."
      });
    }

    const order = await response.json() as {
      id:       string;
      amount:   number;
      currency: string;
    };

    console.log(`[WALLET] Order created: ${order.id} ₹${amountPaise / 100} (${purpose})`);

    return res.json({
      ok:       true,
      orderId:  order.id,
      amount:   order.amount,
      currency: order.currency,
      keyId:    RAZORPAY_KEY_ID,
    });

  } catch (err) {
    console.error("[WALLET] create-order error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /wallet/razorpay-webhook
//
// FIX: req.body is a Buffer (express.raw) — use .toString() for HMAC
// Idempotent: razorpayId checked before processing
// ─────────────────────────────────────────────────────────────────────────────

router.post("/razorpay-webhook", async (req: Request, res: Response) => {
  try {
    const signature = req.headers["x-razorpay-signature"] as string;

    // FIX: req.body is Buffer from express.raw — must use toString() for HMAC
    const rawBody = req.body instanceof Buffer
      ? req.body.toString("utf8")
      : JSON.stringify(req.body);

    // Verify Razorpay signature
    if (WEBHOOK_SECRET) {
      const expected = crypto
        .createHmac("sha256", WEBHOOK_SECRET)
        .update(rawBody)
        .digest("hex");

      if (signature !== expected) {
        console.warn("[WALLET] Webhook signature mismatch — rejected");
        return res.status(400).json({ ok: false, error: "Invalid signature" });
      }
    }

    // Parse body (Buffer was already converted to string above)
    const event = JSON.parse(rawBody) as {
      event:   string;
      payload: {
        payment: {
          entity: {
            id:       string;
            order_id: string;
            amount:   number;
            notes: {
              userId:      string;
              purpose:     string;
              bookingMeta: string;
            };
          };
        };
      };
    };

    // Only process successful payments
    if (event.event !== "payment.captured") {
      return res.json({ ok: true });
    }

    const payment     = event.payload.payment.entity;
    const paymentId   = payment.id;
    const amountPaise = payment.amount;
    const { userId, purpose, bookingMeta: bookingMetaStr } = payment.notes;

    // Idempotency: skip if already processed
    const alreadyProcessed = await prisma.walletTransaction.findFirst({
      where: { razorpayId: paymentId }
    });
    if (alreadyProcessed) {
      console.log(`[WALLET] Payment ${paymentId} already processed — skip`);
      return res.json({ ok: true });
    }

    // Get or create wallet
    let wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) {
      wallet = await prisma.wallet.create({
        data: { userId, balance: 0, deposit: 0 }
      });
    }

    if (purpose === "topup") {
      const newBalance = wallet.balance + amountPaise;

      await prisma.$transaction(async (tx) => {
        await tx.wallet.update({
          where: { userId },
          data:  { balance: newBalance }
        });
        await tx.walletTransaction.create({
          data: {
            walletId:     wallet!.id,
            type:         WalletTxnType.TOPUP,
            amountPaise,
            balancePaise: newBalance,
            note:         `Wallet top-up ₹${amountPaise / 100}`,
            razorpayId:   paymentId,
          }
        });
      });

      console.log(`[WALLET] Top-up: ${userId} +₹${amountPaise / 100}`);

    } else if (purpose === "first_booking" || purpose === "shortfall") {
      const isFirst      = purpose === "first_booking";
      const depositPaise = isFirst ? SECURITY_DEPOSIT_PAISE : 0;
      const packagePaise = amountPaise - depositPaise;

      let bookingMeta: {
        chargerId:    number;
        packageName:  string;
        packagePaise: number;
        kwhLimit:     number;
      } | null = null;

      try {
        bookingMeta = JSON.parse(bookingMetaStr);
      } catch {
        console.error("[WALLET] Cannot parse bookingMeta:", bookingMetaStr);
        return res.status(400).json({ ok: false, error: "Invalid booking metadata" });
      }

      await prisma.$transaction(async (tx) => {
        const newDeposit = wallet!.deposit + depositPaise;
        // Balance stays same — package cost is paid directly, not via balance
        const newBalance = wallet!.balance;

        await tx.wallet.update({
          where: { userId },
          data:  { deposit: newDeposit }
        });

        // Log deposit collection (first booking only)
        if (isFirst && depositPaise > 0) {
          await tx.walletTransaction.create({
            data: {
              walletId:     wallet!.id,
              type:         WalletTxnType.DEPOSIT_COLLECT,
              amountPaise:  depositPaise,
              balancePaise: newBalance,
              note:         "Security deposit ₹100 (locked permanently)",
              razorpayId:   paymentId,
            }
          });
        }

        if (bookingMeta) {
          const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

          const booking = await tx.booking.create({
            data: {
              chargerId:    bookingMeta.chargerId,
              userId,
              packageName:  bookingMeta.packageName,
              packagePaise: bookingMeta.packagePaise,
              kwhLimit:     bookingMeta.kwhLimit,
              expiresAt,
            }
          });

          const txn = await tx.walletTransaction.create({
            data: {
              walletId:     wallet!.id,
              type:         WalletTxnType.PACKAGE_DEBIT,
              amountPaise:  packagePaise,
              balancePaise: newBalance,
              note:         `${bookingMeta.packageName} pack ₹${packagePaise / 100}`,
              bookingId:    booking.id,
              razorpayId:   paymentId,
            }
          });

          await tx.booking.update({
            where: { id: booking.id },
            data:  { walletTxnId: txn.id }
          });

          console.log(`[WALLET] Booking created via webhook: id=${booking.id}`);
        }
      });

      console.log(`[WALLET] ${purpose}: ${userId} deposit=₹${depositPaise / 100} pkg=₹${packagePaise / 100}`);
    }

    return res.json({ ok: true });

  } catch (err) {
    console.error("[WALLET] webhook error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /wallet/verify-payment
// Called by Android after Razorpay SDK returns success.
// Verifies signature + checks if webhook already processed.
// ─────────────────────────────────────────────────────────────────────────────

router.post("/verify-payment", async (req: Request, res: Response) => {
  try {
    const {
      razorpayPaymentId,
      razorpayOrderId,
      razorpaySignature,
      userId
    } = req.body as {
      razorpayPaymentId: string;
      razorpayOrderId:   string;
      razorpaySignature: string;
      userId:            string;
    };

    if (!razorpayPaymentId || !razorpayOrderId || !razorpaySignature) {
      return res.status(400).json({ ok: false, error: "Missing payment fields" });
    }

    // Verify Razorpay signature
    const expectedSig = crypto
      .createHmac("sha256", RAZORPAY_KEY_SECRET)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest("hex");

    if (expectedSig !== razorpaySignature) {
      return res.status(400).json({ ok: false, error: "Invalid payment signature" });
    }

    // Check if webhook already processed this
    const txn = await prisma.walletTransaction.findFirst({
      where: { razorpayId: razorpayPaymentId }
    });

    if (txn) {
      // Find booking created by this payment
      const booking = await prisma.booking.findFirst({
        where:   { userId, walletTxnId: txn.id },
        orderBy: { createdAt: "desc" }
      });

      return res.json({
        ok:        true,
        processed: true,
        bookingId: booking?.id ?? null,
      });
    }

    // Webhook not yet fired — verified but not credited yet
    // App should retry after 2s
    return res.json({
      ok:        true,
      processed: false,
      message:   "Payment verified. Processing in progress.",
    });

  } catch (err) {
    console.error("[WALLET] verify-payment error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

export default router;