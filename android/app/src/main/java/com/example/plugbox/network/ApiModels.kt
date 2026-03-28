package com.example.plugbox.network

// ─────────────────────────────────────────────────────────────────────────────
// ApiModels.kt
// CHANGES: Firebase auth models added. OTP models removed (Firebase handles OTP).
// All charging models untouched.
// ─────────────────────────────────────────────────────────────────────────────

// ── Existing responses ────────────────────────────────────────────────────────

data class HealthResponse(val status: String)
data class ChargersResponse(val chargers: List<Charger>)
data class HoldResponse(val ok: Boolean, val booking: Booking)
data class StartResponse(val ok: Boolean, val sessionId: Int, val commandId: Int)
data class StopResponse(val ok: Boolean)

// ── Existing entities ─────────────────────────────────────────────────────────

data class Charger(
    val id:                 Int,
    val name:               String,
    val lat:                Double,
    val lng:                Double,
    val status:             String,
    val lastSeen:           String?,
    val lastSeenSecondsAgo: Long?
)

data class Booking(
    val id:        Int,
    val chargerId: Int,
    val userId:    String,
    val status:    String,
    val expiresAt: String,
    val createdAt: String,
    val updatedAt: String
)

// ── Existing requests ─────────────────────────────────────────────────────────

data class HoldRequest(val chargerId: Int, val userId: String)
data class StartRequest(val chargerId: Int, val userId: String)
data class StopRequest(val sessionId: Int)

// ─────────────────────────────────────────────────────────────────────────────
// NEW — Firebase Auth models
// ─────────────────────────────────────────────────────────────────────────────

// POST /auth/firebase-login
// Android sends Firebase idToken → backend verifies → returns our JWT
data class FirebaseLoginRequest(val idToken: String)
data class FirebaseLoginResponse(
    val ok:        Boolean,
    val token:     String?  = null,   // our JWT — save to SharedPreferences
    val userId:    String?  = null,   // UUID — use in hold/start/stop requests
    val name:      String?  = null,   // empty string for new users
    val isNewUser: Boolean  = false,  // true → show name entry step
    val error:     String?  = null
)

// POST /auth/update-name (requires Authorization: Bearer <token>)
data class UpdateNameRequest(val name: String)
data class UpdateNameResponse(val ok: Boolean, val error: String? = null)