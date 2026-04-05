// ─────────────────────────────────────────────────────────────────────────────
// src/routes/auth.ts
//
// PURPOSE:
//   Firebase-based authentication for PlugBox.
//   Firebase handles OTP sending and verification completely.
//   We only verify the Firebase idToken and issue our own JWT.
//
// ENDPOINTS:
//   POST /auth/firebase-login → verify Firebase idToken → return our JWT + userId
//   POST /auth/update-name   → save user's name after signup
//
// FLOW:
//   Android: Firebase sends OTP → user verifies → Firebase returns idToken
//   Android: sends idToken to POST /auth/firebase-login
//   Backend: verifies idToken with Firebase Admin SDK
//   Backend: extracts phone from token → upsert User in our DB
//   Backend: returns our JWT + userId + isNewUser flag
//
// ENV VARS NEEDED (.env):
//   JWT_SECRET=your_strong_random_secret_here
//   FIREBASE_SERVICE_ACCOUNT=./firebase-service-account.json
//
// SETUP:
//   npm install firebase-admin jsonwebtoken
//   npm install --save-dev @types/jsonwebtoken
//   Download service account from Firebase Console →
//   Project settings → Service accounts → Generate new private key
//   Save as firebase-service-account.json in backend root
//   Add firebase-service-account.json to .gitignore
// ─────────────────────────────────────────────────────────────────────────────

import { Router, Request, Response } from "express";
import { PrismaClient }              from "@prisma/client";
import * as admin                    from "firebase-admin";
import * as jwt                      from "jsonwebtoken";
import * as fs                       from "fs";
import * as path                     from "path";
import * as bcrypt                   from "bcryptjs";

const router = Router();
const prisma = new PrismaClient();

// ── Initialize Firebase Admin SDK (once) ──────────────────────────────────────
// Reads service account JSON from path specified in .env
// Temporarily disabled due to JSON parsing issues
/*
if (!admin.apps.length) {
 const serviceAccountPath =
  process.env.FIREBASE_SERVICE_ACCOUNT ?? "./firebase-service-account.json";

const absolutePath = path.isAbsolute(serviceAccountPath)
  ? serviceAccountPath
  : path.resolve(process.cwd(), serviceAccountPath);

  if (!fs.existsSync(absolutePath)) {
    console.error(
      `[AUTH] Firebase service account not found at: ${absolutePath}\n` +
      `Download it from Firebase Console → Project settings → Service accounts`
    );
  } else {
    const serviceAccount = JSON.parse(fs.readFileSync(absolutePath, "utf8"));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log("[AUTH] Firebase Admin SDK initialized ✓");
  }
}
*/

// ── Constants ──────────────────────────────────────────────────────────────────
const JWT_EXPIRY = "30d";  // User stays logged in for 30 days

// ── Helper: sign our own JWT ───────────────────────────────────────────────────
function signToken(userId: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET not set in .env");
  return jwt.sign({ userId }, secret, { expiresIn: JWT_EXPIRY });
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/firebase-login
//
// Body:    { idToken: "Firebase ID token from Android" }
// Returns: { ok, token, userId, name, isNewUser }
//
// Flow:
//   1. Verify Firebase idToken with Admin SDK
//   2. Extract phone number from decoded token
//   3. Upsert User in our DB (create if new, skip if returning)
//   4. Sign our own JWT with userId
//   5. Return JWT + userId + isNewUser flag
// ─────────────────────────────────────────────────────────────────────────────

router.post("/firebase-login", async (req: Request, res: Response) => {
  try {
    const { idToken } = req.body as { idToken: string };

    if (!idToken) {
      res.status(400).json({ ok: false, error: "idToken is required" });
      return;
    }

    // Verify Firebase idToken — throws if invalid or expired
    let decoded: admin.auth.DecodedIdToken;
    try {
      decoded = await admin.auth().verifyIdToken(idToken);
    } catch (err) {
      console.error("[AUTH] Firebase token verification failed:", err);
      res.status(401).json({ ok: false, error: "Invalid or expired Firebase token" });
      return;
    }

    // Firebase phone auth guarantees phone_number is present
    const phone       = decoded.phone_number;
    const firebaseUid = decoded.uid;

    if (!phone) {
      res.status(400).json({ ok: false, error: "Phone number not found in token" });
      return;
    }

    // Upsert user — create if new, return existing if returning
    const existingUser = await prisma.user.findUnique({ where: { phone } });
    const isNewUser    = !existingUser;

    const user = await prisma.user.upsert({
      where:  { phone },
      update: { firebaseUid },          // update uid in case it changed
      create: { phone, firebaseUid, name: "" }
    });

    // Sign our own JWT
    const token = signToken(user.id);

    console.log(
      `[AUTH] Login: ${phone} → userId=${user.id} isNew=${isNewUser}`
    );

    res.json({
      ok:        true,
      token,
      userId:    user.id,
      name:      user.name,
      isNewUser
    });

  } catch (err) {
    console.error("[AUTH] firebase-login error:", err);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/update-name
//
// Header:  Authorization: Bearer <our JWT>
// Body:    { name: "Sanket Raut" }
// Returns: { ok: true }
//
// Called after firebase-login for new users (signup step 3)
// ─────────────────────────────────────────────────────────────────────────────

router.post("/update-name", async (req: Request, res: Response) => {
  try {
    // Verify our JWT from header
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({ ok: false, error: "Unauthorized" });
      return;
    }

    const token  = authHeader.slice(7);
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("JWT_SECRET not set");

    let payload: { userId: string };
    try {
      payload = jwt.verify(token, secret) as { userId: string };
    } catch {
      res.status(401).json({ ok: false, error: "Invalid or expired token" });
      return;
    }

    // Validate name
    const { name } = req.body as { name: string };
    if (!name || name.trim().length < 2) {
      res.status(400).json({
        ok:    false,
        error: "Name must be at least 2 characters"
      });
      return;
    }

    await prisma.user.update({
      where: { id: payload.userId },
      data:  { name: name.trim() }
    });

    console.log(`[AUTH] Name updated: userId=${payload.userId} name="${name.trim()}"`);
    res.json({ ok: true });

  } catch (err) {
    console.error("[AUTH] update-name error:", err);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/login
//
// Body:    { email: "user@example.com", password: "password" }
// Returns: { success, token, user, message }
//
// Unified login endpoint for both admin and vendor
// ─────────────────────────────────────────────────────────────────────────────

router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as { email: string; password: string };

    if (!email || !password) {
      res.status(400).json({ 
        success: false, 
        message: "Email and password are required" 
      });
      return;
    }

    // First check if it's an admin user
    const admin = await prisma.user.findUnique({
      where: { 
        email,
        role: "admin" 
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        password: true,
        isActive: true,
        createdAt: true,
      },
    });

    if (admin) {
      // Admin login
      if (!admin.isActive) {
        res.status(401).json({ 
          success: false, 
          message: "Account is deactivated" 
        });
        return;
      }

      if (admin.password !== password) {
        res.status(401).json({ 
          success: false, 
          message: "Invalid email or password" 
        });
        return;
      }

      const token = signToken(admin.id);

      console.log(`[AUTH] Admin Login: ${email} → userId=${admin.id}`);

      res.json({
        success: true,
        message: "Login successful",
        token,
        user: {
          id: admin.id,
          email: admin.email,
          name: admin.name,
          phone: admin.phone,
          role: "admin",
          createdAt: admin.createdAt,
        },
      });
      return;
    }

    // Check if it's a vendor
    const vendor = await prisma.vendor.findUnique({
      where: { email },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            phone: true,
            isActive: true,
          },
        },
      },
    });

    if (vendor) {
      // Vendor login
      if (!vendor.user?.isActive) {
        res.status(401).json({ 
          success: false, 
          message: "Account is deactivated" 
        });
        return;
      }

      if (vendor.password !== password) {
        res.status(401).json({ 
          success: false, 
          message: "Invalid email or password" 
        });
        return;
      }

      const token = signToken(vendor.user.id);

      console.log(`[AUTH] Vendor Login: ${email} → userId=${vendor.user.id}`);

      res.json({
        success: true,
        message: "Login successful",
        token,
        user: {
          id: vendor.user.id,
          email: vendor.email,
          name: vendor.user.name,
          phone: vendor.user.phone,
          role: "vendor",
          vendorId: vendor.id,
          companyName: vendor.companyName,
          kycStatus: vendor.kycStatus,
        },
      });
      return;
    }

    // No user found
    res.status(401).json({ 
      success: false, 
      message: "Invalid email or password" 
    });

  } catch (err) {
    console.error("[AUTH] login error:", err);
    res.status(500).json({ 
      success: false, 
      message: "Server error" 
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/admin-login
//
// Body:    { email: "admin@example.com", password: "password" }
// Returns: { success, token, admin, message }
//
// Admin login with email/password authentication
// ─────────────────────────────────────────────────────────────────────────────

router.post("/admin-login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as { email: string; password: string };

    if (!email || !password) {
      res.status(400).json({ 
        success: false, 
        message: "Email and password are required" 
      });
      return;
    }

    // Find admin user by email and role
    const admin = await prisma.user.findUnique({
      where: { 
        email,
        role: "admin" 
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        password: true,
        isActive: true,
        createdAt: true,
      },
    });

    if (!admin) {
      res.status(401).json({ 
        success: false, 
        message: "Invalid email or password" 
      });
      return;
    }

    // Check if admin is active
    if (!admin.isActive) {
      res.status(401).json({ 
        success: false, 
        message: "Account is deactivated" 
      });
      return;
    }

    // Verify password (assuming plain text for now)
    if (admin.password !== password) {
      res.status(401).json({ 
        success: false, 
        message: "Invalid email or password" 
      });
      return;
    }

    // Sign JWT token
    const token = signToken(admin.id);

    console.log(`[AUTH] Admin Login: ${email} → userId=${admin.id}`);

    res.json({
      success: true,
      message: "Login successful",
      token,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        phone: admin.phone,
        role: "admin",
        createdAt: admin.createdAt,
      },
    });

  } catch (err) {
    console.error("[AUTH] admin-login error:", err);
    res.status(500).json({ 
      success: false, 
      message: "Server error" 
    });
  }
});

export default router;