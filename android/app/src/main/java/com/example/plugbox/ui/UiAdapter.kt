// ─────────────────────────────────────────────────────────────────────────────
// UiAdapter.kt
//
// PURPOSE:
//   Converts raw API Charger objects (from network layer) into UiCharger objects
//   (used by all screens). This is the single place where API data becomes UI data.
//
// PACKAGES:
//   Phase 1 → hardcoded default packages (3 packages matching mockup)
//   Phase 2 → will come from API per-charger response
//
// STATUS MAPPING:
//   Backend sends: "IDLE", "IN_USE", "RESERVED", "OFFLINE"
//   "ONLINE" kept as legacy fallback (old backend version)
// ─────────────────────────────────────────────────────────────────────────────

package com.example.plugbox.ui

import com.example.plugbox.network.Charger

// ── Status mapping ────────────────────────────────────────────────────────────
private fun chargerStatusFromApi(status: String): ChargerStatus =
    when (status.trim().uppercase()) {
        "IDLE"     -> ChargerStatus.IDLE
        "ONLINE"   -> ChargerStatus.IDLE      // legacy fallback
        "IN_USE"   -> ChargerStatus.IN_USE
        "RESERVED" -> ChargerStatus.RESERVED
        "OFFLINE"  -> ChargerStatus.OFFLINE
        else       -> ChargerStatus.OFFLINE
    }

// ── Default packages (Phase 1 — hardcoded, matching mockup) ──────────────────
// Phase 2: remove this and use packages from API response
private val defaultPackages = listOf(
    UiPackage(
        id       = "pkg_mini",
        name     = "Mini",
        kwhLimit = 0.005,   // ~2 min at 150W
        priceInr = 10
    ),
    UiPackage(
        id       = "pkg_standard",
        name     = "Standard",
        kwhLimit = 0.0075,  // ~3 min at 150W
        priceInr = 20,
        badge    = "Best value"
    ),
    UiPackage(
        id       = "pkg_plus",
        name     = "Plus",
        kwhLimit = 0.0125,  // ~5 min at 150W
        priceInr = 30
    )
)
// ── Last seen label ───────────────────────────────────────────────────────────
private fun lastSeenLabel(secondsAgo: Long?): String =
    secondsAgo?.let { secs ->
        when {
            secs < 60   -> "Just now"
            secs < 3600 -> "${secs / 60} min ago"
            else        -> "${secs / 3600} hr ago"
        }
    } ?: ""

// ── Main mapper: Charger (API) → UiCharger (UI) ──────────────────────────────
fun Charger.toUiCharger(): UiCharger {
    val uiStatus = chargerStatusFromApi(status)
    return UiCharger(
        id               = id.toString(),
        name             = name,
        address          = lastSeenLabel(lastSeenSecondsAgo),
        distanceKm       = 0.0,          // filled by HomeScreen GPS
        etaMin           = 0,            // calculated in ChargerDetailScreen
        powerKw          = 0.15,  // actual charger draw ~150W
        socketsAvailable = if (uiStatus == ChargerStatus.IDLE) 1 else 0,
        socketsTotal     = 1,
        status           = uiStatus,
        priceHint        = "₹20 / 0.05 kWh",
        depositInr       = 100,
        packages         = defaultPackages,
        lat              = lat,
        lng              = lng
    )
}