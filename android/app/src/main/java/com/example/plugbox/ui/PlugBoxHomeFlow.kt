package com.example.plugbox.ui

import android.util.Log
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import com.example.plugbox.network.ApiClient
import com.example.plugbox.network.HoldRequest
import com.example.plugbox.network.StartRequest
import com.example.plugbox.network.StopRequest
import kotlinx.coroutines.launch

private const val TAG = "PlugBoxFlow"
private enum class Screen { LIST, DETAIL, SESSION }

@Composable
fun PlugBoxHost(modifier: Modifier = Modifier) {
    val scope = rememberCoroutineScope()

    var screen         by remember { mutableStateOf(Screen.LIST) }
    var connected      by remember { mutableStateOf(false) }
    var chargers       by remember { mutableStateOf<List<UiCharger>>(emptyList()) }
    var filtered       by remember { mutableStateOf<List<UiCharger>>(emptyList()) }
    var selected       by remember { mutableStateOf<UiCharger?>(null) }
    var holdOk         by remember { mutableStateOf(false) }
    var chargingActive by remember { mutableStateOf(false) }
    var sessionId      by remember { mutableStateOf<Int?>(null) }

    val userId = "user1"

    // ── LOAD ON LAUNCH ────────────────────────────────────────
    LaunchedEffect(Unit) {
        // 1. Health check
        try {
            val res = ApiClient.api.health()
            connected = res.status.trim().lowercase() == "ok" || res.status.isNotBlank()
            Log.d(TAG, "Health OK: ${res.status}")
        } catch (e: Exception) {
            connected = false
            Log.e(TAG, "Health FAILED: ${e.message}", e)
        }

        // 2. Load chargers
        try {
            Log.d(TAG, "Loading chargers...")
            val res = ApiClient.api.chargers()
            Log.d(TAG, "Got ${res.chargers.size} chargers from API")

            res.chargers.forEach { c ->
                Log.d(TAG, "  Charger: id=${c.id} name=${c.name} status='${c.status}' lat=${c.lat} lng=${c.lng}")
            }

            val mapped = res.chargers.map { it.toUiCharger() }
            Log.d(TAG, "Mapped chargers: ${mapped.size}")
            mapped.forEach { c ->
                Log.d(TAG, "  UiCharger: id=${c.id} name=${c.name} status=${c.status}")
            }

            chargers = mapped
            filtered = mapped
        } catch (e: Exception) {
            Log.e(TAG, "Chargers FAILED: ${e.message}", e)
            chargers = emptyList()
            filtered = emptyList()
        }
    }

    fun resetSession() {
        holdOk = false
        chargingActive = false
        sessionId = null
    }

    when (screen) {

        Screen.LIST -> {
            HomeMapScreen(
                chargers = filtered,
                selected = selected,
                onSelect = { c -> selected = c },
                onBookNow = { c -> selected = c; screen = Screen.DETAIL },
                onFilterClick = { },
                onSearchChanged = { q ->
                    val query = q.trim().lowercase()
                    filtered = if (query.isEmpty()) chargers
                    else chargers.filter {
                        it.name.lowercase().contains(query) ||
                                it.address.lowercase().contains(query)
                    }
                },
                modifier = modifier
            )
        }

        Screen.DETAIL -> {
            val sel = selected ?: run { screen = Screen.LIST; return }

            ChargerDetailActionScreen(
                charger = sel,
                connected = connected,
                holdOk = holdOk,
                chargingActive = chargingActive,
                onBack = { screen = Screen.LIST },
                onHold = {
                    scope.launch {
                        try {
                            val res = ApiClient.api.hold(
                                HoldRequest(chargerId = sel.id.toInt(), userId = userId)
                            )
                            holdOk = res.ok
                            Log.d(TAG, "Hold: ok=${res.ok} booking=${res.booking.id}")
                            if (res.ok) screen = Screen.SESSION
                        } catch (e: Exception) {
                            holdOk = false
                            Log.e(TAG, "Hold FAILED: ${e.message}", e)
                        }
                    }
                },
                onStart = {
                    scope.launch {
                        try {
                            val res = ApiClient.api.start(
                                StartRequest(chargerId = sel.id.toInt(), userId = userId)
                            )
                            sessionId = res.sessionId
                            chargingActive = res.ok
                            Log.d(TAG, "Start: ok=${res.ok} sessionId=${res.sessionId}")
                            if (res.ok) screen = Screen.SESSION
                        } catch (e: Exception) {
                            chargingActive = false
                            Log.e(TAG, "Start FAILED: ${e.message}", e)
                        }
                    }
                },
                onStop = {
                    scope.launch {
                        try {
                            val sid = sessionId ?: return@launch
                            val res = ApiClient.api.stop(StopRequest(sessionId = sid))
                            Log.d(TAG, "Stop: ok=${res.ok}")
                            if (res.ok) { resetSession(); screen = Screen.SESSION }
                        } catch (e: Exception) {
                            Log.e(TAG, "Stop FAILED: ${e.message}", e)
                        }
                    }
                }
            )
        }

        Screen.SESSION -> {
            val sel = selected ?: run { screen = Screen.LIST; return }

            val uiState: UiSessionState = when {
                chargingActive -> UiSessionState.Charging(
                    chargerName = sel.name, socketLabel = "Socket 1",
                    connected = connected,
                    usedKwh = 0.00, usedInr = 0,
                    remainingKwh = 0.00, remainingInr = 0,
                    packageLimitKwh = 1.00, packageLimitInr = 0
                )
                holdOk -> UiSessionState.Grace(
                    chargerName = sel.name, socketLabel = "Socket 1",
                    connected = connected, expiryLabel = "--:--",
                    penaltyInr = 0, packageLimitKwh = 1.0, packageLimitInr = 0
                )
                else -> UiSessionState.Ended(
                    chargerName = sel.name, socketLabel = "Socket 1",
                    connected = connected,
                    totalKwh = 0.0, chargedInr = 0, refundInr = 0,
                    depositReleased = true, showThankYouPopup = false
                )
            }

            SessionScreen(
                state = uiState,
                onSwipeGenerateCode = { },
                onConfirmEnteredCode = { },
                onStartCharging = { },
                onStopCharging = {
                    if (chargingActive) {
                        scope.launch {
                            try {
                                val sid = sessionId ?: return@launch
                                val res = ApiClient.api.stop(StopRequest(sessionId = sid))
                                if (res.ok) resetSession()
                            } catch (e: Exception) {
                                Log.e(TAG, "StopCharging FAILED: ${e.message}", e)
                            }
                        }
                    }
                },
                onCloseLidCheck = { },
                onCancelSession = { resetSession(); screen = Screen.DETAIL },
                onViewReceipt = { },
                onDone = { screen = Screen.LIST }
            )
        }
    }
}
