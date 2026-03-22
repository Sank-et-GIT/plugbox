package com.example.plugbox.ui

import com.example.plugbox.network.Charger

private fun chargerStatusFromApi(status: String): ChargerStatus {
    return when (status.trim().uppercase()) {
        "IDLE"     -> ChargerStatus.IDLE
        "IN_USE"   -> ChargerStatus.IN_USE
        "RESERVED" -> ChargerStatus.RESERVED
        "OFFLINE"  -> ChargerStatus.OFFLINE
        "ONLINE"   -> ChargerStatus.IDLE      // legacy fallback
        else       -> ChargerStatus.OFFLINE
    }
}

// Default packages — same for all chargers until backend adds per-charger packages
private val defaultPackages = listOf(
    UiPackage(id = "p1", name = "Mini",     kwhLimit = 0.5, priceInr = 20),
    UiPackage(id = "p2", name = "Standard", kwhLimit = 1.0, priceInr = 40, badge = "Best value"),
    UiPackage(id = "p3", name = "Plus",     kwhLimit = 1.5, priceInr = 55)
)

fun Charger.toUiCharger(): UiCharger {
    val uiStatus = chargerStatusFromApi(status)

    val lastSeenText = lastSeenSecondsAgo?.let { secs ->
        when {
            secs < 60   -> "Just now"
            secs < 3600 -> "${secs / 60} min ago"
            else        -> "${secs / 3600} hr ago"
        }
    } ?: ""

    return UiCharger(
        id               = id.toString(),
        name             = name,
        address          = lastSeenText,
        distanceKm       = 0.0,          // calculated from GPS in HomeScreen
        etaMin           = 0,            // calculated from distance later
        powerKw          = 1.5,
        socketsAvailable = if (uiStatus == ChargerStatus.IDLE) 1 else 0,
        socketsTotal     = 1,
        status           = uiStatus,
        priceHint        = "₹40 / 1.0 kWh",
        depositInr       = 100,
        packages         = defaultPackages,
        lat              = lat,
        lng              = lng
    )
}
