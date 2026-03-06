package com.example.plugbox.ui

import com.example.plugbox.network.Charger

private fun chargerStatusFromApi(status: String): ChargerStatus {
    return when (status.trim().uppercase()) {
        "ONLINE" -> ChargerStatus.IDLE
        "OFFLINE" -> ChargerStatus.OFFLINE
        "IN_USE" -> ChargerStatus.IN_USE
        "RESERVED" -> ChargerStatus.RESERVED
        else -> ChargerStatus.OFFLINE
    }
}

fun Charger.toUiCharger(): UiCharger {
    val uiStatus = chargerStatusFromApi(status)

    val lastSeenText =
        lastSeenSecondsAgo?.let { secs ->
            when {
                secs < 60 -> "Last seen just now"
                secs < 3600 -> "Last seen ${(secs / 60)} min ago"
                else -> "Last seen ${(secs / 3600)} hr ago"
            }
        } ?: "Last seen —"

    return UiCharger(
        id = id.toString(),
        name = name,
        address = lastSeenText, //Temporary; Later you can show real address/map
        distanceKm = 0.0, //Later via Location
        etaMin = 0,
        powerKw = 1.5,
        socketsAvailable = if (uiStatus == ChargerStatus.IDLE) 1 else 0,
        socketsTotal = 1,
        status = uiStatus,
        priceHint = status.trim(), //shows ONLINE/OFFLINE for now
        depositInr = 0,
        packages = emptyList(),
        lat = lat,
        lng = lng
    )
}