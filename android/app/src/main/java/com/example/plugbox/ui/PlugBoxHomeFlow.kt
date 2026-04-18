package com.example.plugbox.ui

import android.util.Log
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import com.example.plugbox.network.ApiClient
import com.example.plugbox.network.HoldRequest
import com.example.plugbox.network.StartRequest
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

private const val TAG = "PlugBoxFlow"

private enum class Screen { LIST, DETAIL, CONFIRMED, SESSION }

@Composable
fun PlugBoxHost(modifier: Modifier = Modifier) {

    val context = LocalContext.current
    val scope   = rememberCoroutineScope()

    var screen          by remember { mutableStateOf(Screen.LIST) }
    var selected        by remember { mutableStateOf<UiCharger?>(null) }
    var selectedPackage by remember { mutableStateOf<UiPackage?>(null) }
    var sessionId       by remember { mutableIntStateOf(0) }
    var chargers        by remember { mutableStateOf<List<UiCharger>>(emptyList()) }
    var filtered        by remember { mutableStateOf<List<UiCharger>>(emptyList()) }

    // ── Poll chargers every 10s — keeps status live ───────────────────────────
    LaunchedEffect(Unit) {
        while (true) {
            try {
                val res    = ApiClient.api.chargers()
                val mapped = res.chargers.map { it.toUiCharger() }
                chargers = mapped
                // Only reset filtered if user hasn't searched
                if (filtered.size == chargers.size) filtered = mapped
                Log.d(TAG, "Chargers refreshed: ${mapped.size}")
            } catch (e: Exception) {
                Log.e(TAG, "Load chargers failed: ${e.message}", e)
            }
            delay(5_000L)
        }
    }

    // ── Active session recovery on app launch ─────────────────────────────────
    LaunchedEffect(Unit) {
        try {
            // getUserId returns null if not logged in — fall back to test user
            val userId = ApiClient.getUserId(context) ?: "rashi"
            val res    = ApiClient.api.activeSession(userId)

            if (res.active && res.sessionId != null) {
                sessionId = res.sessionId
                Log.d(TAG, "Restored session: id=${res.sessionId} status=${res.status}")

                // UiCharger.id is String — convert chargerId Int to String
                val chargerIdStr = res.chargerId?.toString()
                val match = chargers.firstOrNull { it.id == chargerIdStr }

                selected = match ?: if (res.chargerId != null && res.chargerName != null) {
                    UiCharger(
                        id               = res.chargerId.toString(),
                        name             = res.chargerName,
                        address          = "",
                        distanceKm       = 0.0,
                        etaMin           = 0,
                        powerKw          = 1.5,
                        socketsAvailable = 1,
                        socketsTotal     = 1,
                        status           = ChargerStatus.IDLE,
                        priceHint        = "",
                        depositInr       = 100,
                        packages         = emptyList(),
                        lat              = res.chargerLat ?: 0.0,
                        lng              = res.chargerLng ?: 0.0
                    )
                } else null

                if (res.packageName != null && res.packagePaise != null && res.kwhLimit != null) {
                    selectedPackage = UiPackage(
                        id       = "restored",
                        name     = res.packageName,
                        priceInr = res.packagePaise / 100,
                        kwhLimit = res.kwhLimit,
                        badge    = null
                    )
                }

                if (selected != null && selectedPackage != null) {
                    screen = Screen.SESSION
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Session recovery failed: ${e.message}", e)
        }
    }

    fun resetAndGoHome() {
        selectedPackage = null
        sessionId       = 0
        screen          = Screen.LIST
    }

    when (screen) {

        // ── 1. HOME MAP ───────────────────────────────────────────────────────
        Screen.LIST -> HomeMapScreen(
            chargers        = filtered,
            selected        = selected,
            onSelect        = { selected = it },
            onBookNow       = { charger ->
                selected = charger
                screen   = Screen.DETAIL
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

        // ── 2. CHARGER DETAIL ─────────────────────────────────────────────────
        Screen.DETAIL -> {
            val sel = selected ?: run { screen = Screen.LIST; return }

            ChargerDetailScreen(
                charger        = sel,
                onBack         = { screen = Screen.LIST },
                onNavigate     = { },
                onProceedToPay = { pkg ->
                    selectedPackage = pkg
                    scope.launch {
                        try {
                            // getUserId returns null → fall back to "rashi" for testing
                            val userId = ApiClient.getUserId(context) ?: "rashi"

                            val res = ApiClient.api.hold(
                                HoldRequest(
                                    chargerId    = sel.id.toInt(), // UiCharger.id is String
                                    userId       = userId,
                                    packageName  = pkg.name,
                                    packagePaise = pkg.priceInr * 100,
                                    kwhLimit     = pkg.kwhLimit
                                )
                            )

                            when {
                                res.ok -> {
                                    Log.d(TAG, "Hold OK → bookingId=${res.bookingId}")
                                    screen = Screen.CONFIRMED
                                }
                                res.reason == "insufficient_balance" -> {
                                    Log.e(TAG, "Insufficient balance — shortfall: ${res.shortfallPaise}")
                                    // TODO: show InsufficientBalanceSheet
                                }
                                else -> {
                                    Log.e(TAG, "Hold failed: ${res.error}")
                                }
                            }
                        } catch (e: Exception) {
                            Log.e(TAG, "Hold exception: ${e.message}", e)
                        }
                    }
                }
            )
        }

        // ── 3. BOOKING CONFIRMED ──────────────────────────────────────────────
        Screen.CONFIRMED -> {
            val sel = selected        ?: run { screen = Screen.LIST; return }
            val pkg = selectedPackage ?: run { screen = Screen.LIST; return }

            BookingConfirmedScreen(
                charger         = sel,
                pkg             = pkg,
                onIveArrived    = {
                    // Just navigate to SESSION screen
                    // sessions/start is called inside SessionScreen when user taps Unlock Lid
                    Log.d(TAG, "I've Arrived → SESSION screen")
                    screen = Screen.SESSION
                },
                onCancelBooking = { resetAndGoHome() },
                onTimerExpired  = { resetAndGoHome() }
            )
        }

        // ── 4. SESSION ────────────────────────────────────────────────────────
        Screen.SESSION -> {
            val sel = selected        ?: run { screen = Screen.LIST; return }
            val pkg = selectedPackage ?: run { screen = Screen.LIST; return }

            SessionScreen(
                charger          = sel,
                pkg              = pkg,
                sessionId        = sessionId,
                onSessionStarted = { id -> sessionId = id },
                onDone           = { resetAndGoHome() },
                onCancel         = { resetAndGoHome() }
            )
        }
    }
}