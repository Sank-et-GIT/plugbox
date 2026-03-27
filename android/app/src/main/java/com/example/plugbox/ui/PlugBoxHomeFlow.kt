// ─────────────────────────────────────────────────────────────────────────────
// PlugBoxHomeFlow.kt
//
// PURPOSE:
//   Navigation state machine for the Home tab.
//   No NavHost — simple enum-driven screen switching.
//   Each screen gets exactly what it needs, nothing more.
//
// CURRENT FLOW (Phase 1 — UI only):
//   LIST → DETAIL → CONFIRMED
//
// COMING (Phase 2):
//   CONFIRMED → SESSION (after Hold API + I've Arrived)
//
// API CALLS:
//   Phase 1 → chargers loaded on launch (real API)
//   Phase 2 → Hold API on Proceed to pay, Start API on I've Arrived
// ─────────────────────────────────────────────────────────────────────────────

package com.example.plugbox.ui

import android.util.Log
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import com.example.plugbox.network.ApiClient

private const val TAG = "PlugBoxFlow"

private enum class Screen {
    LIST,       // HomeMapScreen — charger map + list
    DETAIL,     // ChargerDetailScreen — packages, deposit, pay
    CONFIRMED,  // BookingConfirmedScreen — timer, maps, arrived
    // SESSION  ← Phase 2: SessionScreen
}

@Composable
fun PlugBoxHost(modifier: Modifier = Modifier) {

    var screen          by remember { mutableStateOf(Screen.LIST) }
    var selected        by remember { mutableStateOf<UiCharger?>(null) }
    var selectedPackage by remember { mutableStateOf<UiPackage?>(null) }
    var chargers        by remember { mutableStateOf<List<UiCharger>>(emptyList()) }
    var filtered        by remember { mutableStateOf<List<UiCharger>>(emptyList()) }

    // Load chargers once on launch — real API call
    LaunchedEffect(Unit) {
        try {
            val res    = ApiClient.api.chargers()
            val mapped = res.chargers.map { it.toUiCharger() }
            Log.d(TAG, "Loaded ${mapped.size} chargers")
            chargers = mapped
            filtered = mapped
        } catch (e: Exception) {
            Log.e(TAG, "Failed to load chargers: ${e.message}", e)
        }
    }

    when (screen) {

        // ── 1. HOME MAP ───────────────────────────────────────────────────────
        Screen.LIST -> {
            HomeMapScreen(
                chargers        = filtered,
                selected        = selected,
                onSelect        = { selected = it },
                onBookNow       = { charger ->
                    selected = charger
                    screen   = Screen.DETAIL
                    Log.d(TAG, "→ DETAIL: ${charger.name}")
                },
                onFilterClick   = { },
                onSearchChanged = { q ->
                    val query = q.trim().lowercase()
                    filtered  = if (query.isEmpty()) chargers
                    else chargers.filter {
                        it.name.lowercase().contains(query) ||
                                it.address.lowercase().contains(query)
                    }
                },
                modifier = modifier
            )
        }

        // ── 2. CHARGER DETAIL ─────────────────────────────────────────────────
        Screen.DETAIL -> {
            val sel = selected ?: run { screen = Screen.LIST; return }

            ChargerDetailScreen(
                charger        = sel,
                onBack         = { screen = Screen.LIST },
                onNavigate     = { /* Maps intent handled inside ChargerDetailScreen */ },
                onProceedToPay = { pkg ->
                    // Save selected package for use on BookingConfirmedScreen
                    selectedPackage = pkg
                    Log.d(TAG, "→ CONFIRMED: ${pkg.name} ₹${pkg.priceInr}")
                    // Phase 2: call Hold API here before navigating
                    // scope.launch { ApiClient.api.hold(HoldRequest(...)) }
                    screen = Screen.CONFIRMED
                }
            )
        }

        // ── 3. BOOKING CONFIRMED ──────────────────────────────────────────────
        Screen.CONFIRMED -> {
            val sel = selected        ?: run { screen = Screen.LIST; return }
            val pkg = selectedPackage ?: run { screen = Screen.LIST; return }

            BookingConfirmedScreen(
                charger      = sel,
                pkg          = pkg,
                onIveArrived = {
                    Log.d(TAG, "→ SESSION: user arrived at ${sel.name}")
                    // Phase 2: call Start API here, then navigate to SESSION
                    // scope.launch { ApiClient.api.start(StartRequest(...)) }
                    // screen = Screen.SESSION
                },
                onCancelBooking = {
                    // User confirmed cancel — clear selection and go home
                    Log.d(TAG, "Booking cancelled")
                    selectedPackage = null
                    screen          = Screen.LIST
                },
                onTimerExpired = {
                    // 10 minutes up — auto-cancel, go home
                    Log.d(TAG, "Grace period expired")
                    selectedPackage = null
                    screen          = Screen.LIST
                }
            )
        }
    }
}