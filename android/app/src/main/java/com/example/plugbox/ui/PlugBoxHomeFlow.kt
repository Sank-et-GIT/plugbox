// ─────────────────────────────────────────────────────────────────────────────
// PlugBoxHomeFlow.kt
//
// PURPOSE:
//   Navigation state machine for the Home tab.
//   Simple enum-driven switching — no NavHost, no back stack library.
//
// FLOW:
//   LIST → DETAIL → CONFIRMED → SESSION
//
// API CALLS:
//   Phase 1 → chargers loaded on launch (real API)
//   Phase 2 → Hold API on Proceed to pay, Start API on I've Arrived
//             (marked with TODO comments below)
// ─────────────────────────────────────────────────────────────────────────────

package com.example.plugbox.ui

import android.util.Log
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import com.example.plugbox.network.ApiClient

private const val TAG = "PlugBoxFlow"

private enum class Screen {
    LIST,       // HomeMapScreen
    DETAIL,     // ChargerDetailScreen
    CONFIRMED,  // BookingConfirmedScreen
    SESSION     // SessionScreen
}

@Composable
fun PlugBoxHost(modifier: Modifier = Modifier) {

    var screen          by remember { mutableStateOf(Screen.LIST) }
    var selected        by remember { mutableStateOf<UiCharger?>(null) }
    var selectedPackage by remember { mutableStateOf<UiPackage?>(null) }
    var chargers        by remember { mutableStateOf<List<UiCharger>>(emptyList()) }
    var filtered        by remember { mutableStateOf<List<UiCharger>>(emptyList()) }

    // Load chargers once on launch
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

    // Helper: clear booking state and go home
    fun resetAndGoHome() {
        selectedPackage = null
        screen          = Screen.LIST
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
                onNavigate     = { /* Maps intent handled inside screen */ },
                onProceedToPay = { pkg ->
                    selectedPackage = pkg
                    Log.d(TAG, "→ CONFIRMED: ${pkg.name} ₹${pkg.priceInr}")
                    // TODO Phase 2: call Hold API here
                    // scope.launch { ApiClient.api.hold(HoldRequest(sel.id.toInt(), userId)) }
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
                    // TODO Phase 2: call Start API here
                    // scope.launch { ApiClient.api.start(StartRequest(sel.id.toInt(), userId)) }
                    screen = Screen.SESSION
                },
                onCancelBooking = {
                    Log.d(TAG, "Booking cancelled by user")
                    resetAndGoHome()
                },
                onTimerExpired = {
                    Log.d(TAG, "Grace period expired — auto cancel")
                    resetAndGoHome()
                }
            )
        }

        // ── 4. SESSION ────────────────────────────────────────────────────────
        Screen.SESSION -> {
            val sel = selected        ?: run { screen = Screen.LIST; return }
            val pkg = selectedPackage ?: run { screen = Screen.LIST; return }

            SessionScreen(
                charger  = sel,
                pkg      = pkg,
                onDone   = {
                    Log.d(TAG, "Session complete → Home")
                    resetAndGoHome()
                },
                onCancel = {
                    Log.d(TAG, "Session cancelled → Home")
                    resetAndGoHome()
                }
            )
        }
    }
}