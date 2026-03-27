// ─────────────────────────────────────────────────────────────────────────────
// PlugBoxHomeFlow.kt
//
// PURPOSE: Navigation state machine for the Home tab.
// Phase 1: LIST → DETAIL (UI only, no API calls on Proceed to pay yet)
// Phase 2: Add CONFIRMED and SESSION, wire real API calls
// ─────────────────────────────────────────────────────────────────────────────

package com.example.plugbox.ui

import android.util.Log
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import com.example.plugbox.network.ApiClient

private const val TAG = "PlugBoxFlow"

private enum class Screen {
    LIST,     // HomeMapScreen
    DETAIL,   // ChargerDetailScreen
    // CONFIRMED  ← Phase 2
    // SESSION    ← Phase 2
}

@Composable
fun PlugBoxHost(modifier: Modifier = Modifier) {

    var screen   by remember { mutableStateOf(Screen.LIST) }
    var selected by remember { mutableStateOf<UiCharger?>(null) }
    var chargers by remember { mutableStateOf<List<UiCharger>>(emptyList()) }
    var filtered by remember { mutableStateOf<List<UiCharger>>(emptyList()) }

    // Load chargers on launch
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

        // ── LIST: Home map + charger list ─────────────────────────────────
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

        // ── DETAIL: Charger detail, packages, pay button ──────────────────
        Screen.DETAIL -> {
            val sel = selected ?: run { screen = Screen.LIST; return }

            ChargerDetailScreen(
                charger        = sel,
                onBack         = { screen = Screen.LIST },
                onNavigate     = { /* Maps intent handled inside screen */ },
                onProceedToPay = { pkg ->
                    // Phase 1: log only — no API call, no navigation yet
                    // Phase 2: Hold API + navigate to CONFIRMED
                    Log.d(TAG, "Proceed to pay: ${pkg.name} ₹${pkg.priceInr}")
                }
            )
        }
    }
}