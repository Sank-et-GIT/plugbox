// ─────────────────────────────────────────────────────────────────────────────
// src/routes/auth.ts
//
// Purpose:
//   Firebase-based authentication for PlugBox.
//
// What this file does:
//   1. Verifies Firebase ID token from Android app
//   2. Upserts user in local DB using phone number
//   3. Issues backend JWT for your own API auth
//   4. Updates user name after signup
//
// Endpoints:
//   POST /auth/firebase-login
//   POST /auth/update-name
//
// Notes:
//   - Firebase handles OTP send/verify on client side
//   - Backend only verifies Firebase token and issues app JWT
//   - JWT contains userId and expires in 30 days
// ─────────────────────────────────────────────────────────────────────────────

import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { logDebug, logError, logInfo, logWarn } from "../lib/logger";
import * as admin from "firebase-admin";
import * as jwt from "jsonwebtoken";
import * as fs from "fs";
import * as path from "path";

const router = Router();
const prisma = new PrismaClient();

// ─────────────────────────────────────────────────────────────────────────────
// Firebase Admin SDK initialization
//
// Runs once when this route file is loaded.
// Reads service account file path from .env.
// ─────────────────────────────────────────────────────────────────────────────
if (!admin.apps.length) {
  const serviceAccountPath =
    process.env.FIREBASE_SERVICE_ACCOUNT ?? "./firebase-service-account.json";

  const absolutePath = path.isAbsolute(serviceAccountPath)
    ? serviceAccountPath
    : path.resolve(process.cwd(), serviceAccountPath);

  if (!fs.existsSync(absolutePath)) {
    logError("auth_firebase_service_account_missing", {
      category: "auth",
      path: absolutePath,
      errorMessage:
        "Firebase service account not found. Download it from Firebase Console → Project settings → Service accounts",
    });
  } else {
    const serviceAccount = JSON.parse(fs.readFileSync(absolutePath, "utf8"));

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    logInfo("auth_firebase_admin_initialized", {
      category: "auth",
      path: absolutePath,
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// JWT settings
// ─────────────────────────────────────────────────────────────────────────────
const JWT_EXPIRY = "30d";

// Helper: sign backend JWT
function signToken(userId: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET not set in .env");
  }

  return jwt.sign({ userId }, secret, { expiresIn: JWT_EXPIRY });
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/firebase-login
//
// Body:
//   { idToken: string }
//
// Flow:
//   1. Validate idToken present
//   2. Verify token with Firebase Admin SDK
//   3. Extract phone number + Firebase UID
//   4. Upsert user into DB
//   5. Sign backend JWT
//   6. Return token + user info
// ─────────────────────────────────────────────────────────────────────────────
router.post("/firebase-login", async (req: Request, res: Response) => {
  try {
    const { idToken } = req.body as { idToken: string };

    logDebug("auth_firebase_login_requested", {
      category: "auth",
      hasIdToken: !!idToken,
    });

    if (!idToken) {
      return res.status(400).json({ ok: false, error: "idToken is required" });
    }

    // Verify Firebase token
    let decoded: admin.auth.DecodedIdToken;
    try {
      decoded = await admin.auth().verifyIdToken(idToken);

      logInfo("auth_firebase_token_verified", {
        category: "auth",
        firebaseUid: decoded.uid,
        phone: decoded.phone_number,
      });
    } catch (err: any) {
      logWarn("auth_firebase_token_verification_failed", {
        category: "auth",
        errorMessage: err?.message,
      });

      return res.status(401).json({ ok: false, error: "Invalid or expired Firebase token" });
    }

    const phone = decoded.phone_number;
    const firebaseUid = decoded.uid;

    if (!phone) {
      logWarn("auth_firebase_phone_missing", {
        category: "auth",
        firebaseUid,
      });

      return res.status(400).json({ ok: false, error: "Phone number not found in token" });
    }

    // Check whether this is a new user
    const existingUser = await prisma.user.findUnique({
      where: { phone },
    });

    const isNewUser = !existingUser;

    logDebug("auth_user_lookup_by_phone", {
      category: "auth",
      phone,
      firebaseUid,
      found: !!existingUser,
      existingUserId: existingUser?.id,
      isNewUser,
    });

    // Create or update local user
    const user = await prisma.user.upsert({
      where: { phone },
      update: { firebaseUid },
      create: { phone, firebaseUid, name: "" },
    });

    logInfo("auth_user_upserted", {
      category: "auth",
      userId: user.id,
      phone,
      firebaseUid,
      isNewUser,
    });

    // Issue backend JWT
    const token = signToken(user.id);

    logInfo("auth_login_success", {
      category: "auth",
      userId: user.id,
      phone,
      isNewUser,
    });

    return res.json({
      ok: true,
      token,
      userId: user.id,
      name: user.name,
      isNewUser,
    });
  } catch (err: any) {
    logError("auth_firebase_login_failed", {
      category: "auth",
      errorMessage: err?.message,
      stack: err?.stack,
    });

    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/update-name
//
// Header:
//   Authorization: Bearer <backend JWT>
//
// Body:
//   { name: string }
//
// Flow:
//   1. Validate Authorization header
//   2. Verify backend JWT
//   3. Validate provided name
//   4. Update user record
// ─────────────────────────────────────────────────────────────────────────────
router.post("/update-name", async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;

    logDebug("auth_update_name_requested", {
      category: "auth",
      hasAuthorizationHeader: !!authHeader,
    });

    if (!authHeader?.startsWith("Bearer ")) {
      logWarn("auth_update_name_missing_bearer", {
        category: "auth",
      });

      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    const token = authHeader.slice(7);
    const secret = process.env.JWT_SECRET;

    if (!secret) {
      throw new Error("JWT_SECRET not set");
    }

    let payload: { userId: string };

    try {
      payload = jwt.verify(token, secret) as { userId: string };

      logDebug("auth_update_name_token_verified", {
        category: "auth",
        userId: payload.userId,
      });
    } catch {
      logWarn("auth_update_name_invalid_token", {
        category: "auth",
      });

      return res.status(401).json({ ok: false, error: "Invalid or expired token" });
    }

    const { name } = req.body as { name: string };

    if (!name || name.trim().length < 2) {
      logWarn("auth_update_name_validation_failed", {
        category: "auth",
        userId: payload.userId,
        providedName: name,
      });

      return res.status(400).json({
        ok: false,
        error: "Name must be at least 2 characters",
      });
    }

    const trimmedName = name.trim();

    await prisma.user.update({
      where: { id: payload.userId },
      data: { name: trimmedName },
    });

    logInfo("auth_update_name_success", {
      category: "auth",
      userId: payload.userId,
      name: trimmedName,
    });

    return res.json({ ok: true });
  } catch (err: any) {
    logError("auth_update_name_failed", {
      category: "auth",
      errorMessage: err?.message,
      stack: err?.stack,
    });

    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

export default router;