// ─────────────────────────────────────────────────────────────────────────────
// src/lib/prismaClient.ts
//
// Single shared PrismaClient for the entire app.
// Prevents "too many connections" from multiple instances.
// Import this everywhere instead of new PrismaClient()
// ─────────────────────────────────────────────────────────────────────────────

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default prisma;