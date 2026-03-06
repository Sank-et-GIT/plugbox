package com.example.plugbox.ui

import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import com.example.plugbox.network.ApiClient
import com.example.plugbox.network.HoldRequest
import com.example.plugbox.network.StartRequest
import com.example.plugbox.network.StopRequest
import kotlinx.coroutines.launch

private enum class Screen { LIST, DETAIL, SESSION }

@Composable
fun PlugBoxHost(
    modifier: Modifier = Modifier
) {
    val scope = rememberCoroutineScope()

    var screen by remember { mutableStateOf(Screen.LIST) }

    var connected by remember { mutableStateOf(false) }
    var chargers by remember { mutableStateOf<List<UiCharger>>(emptyList()) }
    var filtered by remember { mutableStateOf<List<UiCharger>>(emptyList()) }

    var selected by remember { mutableStateOf<UiCharger?>(null) }

    var holdOk by remember { mutableStateOf(false) }
    var chargingActive by remember { mutableStateOf(false) }

    var sessionId by remember { mutableStateOf<Int?>(null) }

    // your userId (keep same as before)
    val userId = "rashi"

    // Auto: health + chargers on launch
    LaunchedEffect(Unit) {
        try {
            val res = ApiClient.api.health()
            connected = res.status.trim().lowercase() == "ok" || res.status.isNotBlank()
        } catch (_: Exception) {
            connected = false
        }

        try {
            val res = ApiClient.api.chargers()
            chargers = res.chargers.map { it.toUiCharger() }
            filtered = chargers
        } catch (_: Exception) {
            chargers = emptyList()
            filtered = emptyList()
        }
    }

    fun resetSessionLocal() {
        holdOk = false
        chargingActive = false
        sessionId = null
    }

    when (screen) {
        Screen.LIST -> {
            HomeMapScreen(
                chargers = filtered,
                selected = selected,
                onSelect = { c -> selected = c },                 //  stay on Home
                onBookNow = { c -> selected = c; screen = Screen.DETAIL }, // CTA navigates
                onFilterClick = { },
                onSearchChanged = { q ->
                    val query = q.trim().lowercase()
                    filtered = if (query.isEmpty()) chargers else chargers.filter {
                        it.name.lowercase().contains(query) || it.address.lowercase().contains(query)
                    }
                }
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
                            val cid = sel.id.toInt()
                            val res = ApiClient.api.hold(HoldRequest(chargerId = cid, userId = userId))
                            holdOk = res.ok
                            // After hold → open session screen
                            screen = Screen.SESSION
                        } catch (_: Exception) {
                            holdOk = false
                        }
                    }
                },
                onStart = {
                    scope.launch {
                        try {
                            val cid = sel.id.toInt()
                            val res = ApiClient.api.start(StartRequest(chargerId = cid, userId = userId))
                            sessionId = res.sessionId
                            chargingActive = res.ok
                            screen = Screen.SESSION
                        } catch (_: Exception) {
                            chargingActive = false
                        }
                    }
                },
                onStop = {
                    scope.launch {
                        try {
                            val sid = sessionId ?: return@launch
                            val res = ApiClient.api.stop(StopRequest(sessionId = sid))
                            if (res.ok) {
                                resetSessionLocal()
                                screen = Screen.SESSION
                            }
                        } catch (_: Exception) {
                            // keep state
                        }
                    }
                }
            )
        }

        Screen.SESSION -> {
            val sel = selected ?: run { screen = Screen.LIST; return }

            val uiState: UiSessionState =
                when {
                    chargingActive -> UiSessionState.Charging(
                        chargerName = sel.name,
                        socketLabel = "Socket 1",
                        connected = connected,
                        usedKwh = 0.00, usedInr = 0,
                        remainingKwh = 0.00, remainingInr = 0,
                        packageLimitKwh = 1.00, packageLimitInr = 0
                    )
                    holdOk -> UiSessionState.Grace(
                        chargerName = sel.name,
                        socketLabel = "Socket 1",
                        connected = connected,
                        expiryLabel = "--:--",
                        penaltyInr = 0,
                        packageLimitKwh = 1.0,
                        packageLimitInr = 0
                    )
                    else -> UiSessionState.Ended(
                        chargerName = sel.name,
                        socketLabel = "Socket 1",
                        connected = connected,
                        totalKwh = 0.0,
                        chargedInr = 0,
                        refundInr = 0,
                        depositReleased = true,
                        showThankYouPopup = false
                    )
                }

            SessionScreen(
                state = uiState,
                onSwipeGenerateCode = { /* not used now */ },
                onConfirmEnteredCode = { /* not used now */ },
                onStartCharging = { /* not used now */ },

                // Stop from session screen when active
                onStopCharging = {
                    if (chargingActive) {
                        scope.launch {
                            try {
                                val sid = sessionId ?: return@launch
                                val res = ApiClient.api.stop(StopRequest(sessionId = sid))
                                if (res.ok) {
                                    resetSessionLocal()
                                }
                            } catch (_: Exception) {}
                        }
                    }
                },

                onCloseLidCheck = { /* not used now */ },

                // Cancel session = reset local (unless you add a backend cancel endpoint)
                onCancelSession = {
                    resetSessionLocal()
                    screen = Screen.DETAIL
                },

                onViewReceipt = { /* later */ },
                onDone = { screen = Screen.DETAIL }
            )
        }
    }
}