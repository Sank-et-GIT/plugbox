// ─────────────────────────────────────────────────────────────────────────────
// SessionScreen.kt
//
// PURPOSE:
//   Manages the entire charging session from arrival to completion.
//   Self-contained — owns its own stage state machine internally.
//   No UiSessionState sealed class needed — simpler and cleaner.
//
// STAGES (internal enum):
//   GRACE     → User arrived. GPS checks radius. Unlock button activates at 150m.
//   LID_OPEN  → Lid unlocked. 2-min countdown to plug in cable.
//   CHARGING  → Live kWh meter. Stop button always visible.
//   COMPLETE  → Session ended. Receipt shown. Refund calculated if early stop.
//
// NAVIGATION:
//   Entered from : BookingConfirmedScreen (I've Arrived)
//   Exits to     : HomeScreen (Done / Cancel)
//
// GPS:
//   Uses FusedLocationProvider. Unlock button disabled if > 150m from charger.
//   Shows live distance so user knows how close they are.
//
// LIVE METER (CHARGING stage):
//   Phase 1 → simulated increment every 30s
//   Phase 2 → replace TODO with real API poll: ApiClient.api.getMeterReading(sessionId)
//
// STOP EARLY:
//   Shows AlertDialog with exact amount used + refund amount before confirming.
//   Refund = package price - amount used (rounded).
//
// BACK GESTURE:
//   GRACE/LID_OPEN → shows cancel confirmation dialog
//   CHARGING       → shows stop confirmation dialog
//   COMPLETE       → allowed (calls onDone)
// ─────────────────────────────────────────────────────────────────────────────

package com.example.plugbox.ui

import android.Manifest
import android.annotation.SuppressLint
import android.location.Location
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Paint
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import com.example.plugbox.network.ApiClient
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlin.math.*
import kotlin.math.roundToInt
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.Spring
import androidx.compose.ui.draw.scale
import androidx.compose.ui.unit.IntOffset

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1 — Constants
// ─────────────────────────────────────────────────────────────────────────────

private const val UNLOCK_RADIUS_M   = 150.0   // metres — unlock button activates within this
private const val PLUG_IN_TIMEOUT_S = 120      // 2 minutes to plug in after lid opens
private const val POLL_INTERVAL_MS  = 3_000L   // live meter refresh — 3s for smooth demo experience

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2 — Colors
// ─────────────────────────────────────────────────────────────────────────────

private val SsGreen         = Color(0xFF16C784)
private val SsGreenBg       = Color(0xFFECFDF5)
private val SsGreenDark     = Color(0xFF059669)
private val SsBlue          = Color(0xFF3B82F6)
private val SsOrange        = Color(0xFFF59E0B)
private val SsOrangeBg      = Color(0xFFFFF7ED)
private val SsRed           = Color(0xFFEF4444)
private val SsRedBg         = Color(0xFFFEF2F2)
private val SsTextPrimary   = Color(0xFF111827)
private val SsTextSecondary = Color(0xFF6B7280)
private val SsDivider       = Color(0xFFE5E7EB)
private val SsWhite         = Color(0xFFFFFFFF)
private val SsSurface       = Color(0xFFF9FAFB)

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3 — Stage enum (internal state machine)
// ─────────────────────────────────────────────────────────────────────────────

private enum class Stage {
    GRACE,     // Arrived, waiting to unlock
    LID_OPEN,  // Lid unlocked, waiting for plug-in
    CHARGING,  // Charging in progress
    COMPLETE   // Session ended
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4 — Haversine distance helper
// Calculates straight-line distance in metres between two GPS coordinates.
// Used to check if user is within UNLOCK_RADIUS_M of the charger.
// ─────────────────────────────────────────────────────────────────────────────

private fun distanceMeters(
    lat1: Double, lon1: Double,
    lat2: Double, lon2: Double
): Double {
    val r    = 6_371_000.0
    val dLat = Math.toRadians(lat2 - lat1)
    val dLon = Math.toRadians(lon2 - lon1)
    val a    = sin(dLat / 2).pow(2) +
            cos(Math.toRadians(lat1)) * cos(Math.toRadians(lat2)) * sin(dLon / 2).pow(2)
    return r * 2 * atan2(sqrt(a), sqrt(1 - a))
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5 — Main composable
// ─────────────────────────────────────────────────────────────────────────────

@SuppressLint("MissingPermission", "DefaultLocale")
@Composable
fun SessionScreen(
    charger:          UiCharger,
    pkg:              UiPackage,
    sessionId:        Int   = 0,
    onSessionStarted: (Int) -> Unit = {},  // called with real sessionId after unlock
    onDone:           () -> Unit,
    onCancel:         () -> Unit,
    modifier:         Modifier = Modifier
) {
    val context = LocalContext.current
    val scope   = rememberCoroutineScope()

    // ── Stage state ───────────────────────────────────────────────────────────
    // If sessionId > 0 on entry (start API already called from I've Arrived),
    // skip GRACE entirely and go straight to LID_OPEN — door is already unlocked.
    // LaunchedEffect below will further advance to CHARGING if already ACTIVE.
    var stage           by remember { mutableStateOf(if (sessionId > 0) Stage.LID_OPEN else Stage.GRACE) }
    var activeSessionId by remember { mutableIntStateOf(sessionId) }
    // true when session ended due to timeout or hardware failure (not normal completion)
    var sessionFailed   by remember { mutableStateOf(false) }

    // If we enter with an existing sessionId (restored from active session API),
    // jump straight to CHARGING — no need to go through GRACE/LID_OPEN again
    LaunchedEffect(Unit) {
        if (sessionId > 0) {
            try {
                val meter = ApiClient.api.meter(sessionId)
                when {
                    meter.ok && meter.status == "ACTIVE"   -> stage = Stage.CHARGING
                    meter.ok && meter.status == "PLUG_WAIT" -> stage = Stage.LID_OPEN
                    meter.ok && meter.status == "ENDED"    -> stage = Stage.COMPLETE
                    meter.ok && meter.status == "FAILED"   -> stage = Stage.COMPLETE
                }
            } catch (_: Exception) {
                // If meter check fails, default to GRACE — user can retry unlock
            }
        }
    }

    // ── GPS ───────────────────────────────────────────────────────────────────
    var userLocation    by remember { mutableStateOf<Location?>(null) }
    var locationGranted by remember { mutableStateOf(false) }

    val permLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { grants -> locationGranted = grants.values.any { it } }

    // Request location permission on entry
    LaunchedEffect(Unit) {
        permLauncher.launch(arrayOf(
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION
        ))
    }

    // Poll GPS every 3s while in GRACE stage
    // Single fetch was wrong — user walks toward charger, distance must update live
    LaunchedEffect(locationGranted, stage) {
        if (!locationGranted) return@LaunchedEffect
        if (stage != Stage.GRACE) return@LaunchedEffect
        val fused = LocationServices.getFusedLocationProviderClient(context)
        while (stage == Stage.GRACE) {
            try {
                val cts = CancellationTokenSource()
                userLocation = fused.getCurrentLocation(
                    Priority.PRIORITY_HIGH_ACCURACY, cts.token
                ).await()
            } catch (_: Exception) {
                // GPS unavailable — keep previous reading, retry next cycle
            }
            delay(3_000L)
        }
    }

    // Distance to charger in metres (null = GPS not ready)
    val distanceToCharger: Double? = userLocation?.let {
        distanceMeters(it.latitude, it.longitude, charger.lat, charger.lng)
    }
    val withinRange = distanceToCharger?.let { it <= UNLOCK_RADIUS_M } ?: false

    // ── Plug-in countdown (LID_OPEN stage) ────────────────────────────────────
    var plugInSecondsLeft by remember { mutableIntStateOf(PLUG_IN_TIMEOUT_S) }

    LaunchedEffect(stage) {
        if (stage != Stage.LID_OPEN) return@LaunchedEffect
        plugInSecondsLeft = PLUG_IN_TIMEOUT_S
        // Poll backend every 3s to detect when session becomes ACTIVE
        // (hardware presses button + closes lid → backend sets ACTIVE)
        while (plugInSecondsLeft > 0 && stage == Stage.LID_OPEN) {
            delay(3_000L)
            plugInSecondsLeft = (plugInSecondsLeft - 3).coerceAtLeast(0)
            try {
                if (activeSessionId > 0) {
                    val meter = ApiClient.api.meter(activeSessionId)
                    if (meter.ok && meter.status == "ACTIVE") {
                        stage = Stage.CHARGING
                        return@LaunchedEffect
                    }
                    if (meter.ok && meter.status == "FAILED") {
                        sessionFailed = true
                        stage = Stage.COMPLETE
                        return@LaunchedEffect
                    }
                }
            } catch (_: Exception) { }
        }
        if (stage == Stage.LID_OPEN) {
            sessionFailed = true   // timer expired — user never plugged in
            stage = Stage.COMPLETE
        }
    }

    // ── Live meter (CHARGING stage) ───────────────────────────────────────────
    // displayKwh       = what UI shows — interpolates every 1s
    // realKwh          = last confirmed PZEM value from backend
    // realKwhPrev      = realKwh from previous poll cycle
    // noAdvanceCount   = consecutive polls with no kWh advancement
    // energyFlowing    = true until 2 consecutive polls show no change
    //
    // WHY start true + require 2 polls:
    //   At session start, PZEM usedKwh = 0.000. First poll: newKwh=0, prev=0,
    //   delta=0 → if we set false immediately, bar never starts. PZEM resolution
    //   is 0.01 kWh — it takes ~30-40s to accumulate the first tick. We must
    //   allow the bar to run forward during that window.
    //   After 2 consecutive no-advance polls (6s gap) we are confident
    //   the plug is actually out and billing should stop.
    var realKwh        by remember { mutableDoubleStateOf(0.0) }
    var realKwhPrev    by remember { mutableDoubleStateOf(-1.0) } // -1 = no data yet
    var displayKwh     by remember { mutableDoubleStateOf(0.0) }
    var noAdvanceCount by remember { mutableIntStateOf(0) }
    // Start true — assume energy is flowing until 2 consecutive polls prove otherwise
    var energyFlowing  by remember { mutableStateOf(true) }

    val ratePerKwh   = pkg.priceInr.toDouble() / pkg.kwhLimit
    val usedKwh      = displayKwh
    val usedInr      = (displayKwh * ratePerKwh).roundToInt()
    val remainingKwh = (pkg.kwhLimit - displayKwh).coerceAtLeast(0.0)
    val remainingInr = (pkg.priceInr - usedInr).coerceAtLeast(0)
    val progress     = (displayKwh / pkg.kwhLimit).toFloat().coerceIn(0f, 1f)

    val powerKw    = charger.powerKw.coerceAtLeast(0.1)
    val etaMinutes = if (remainingKwh > 0)
        ((remainingKwh / powerKw) * 60).toInt().coerceAtLeast(1) else 0

    // ── 1s display ticker ────────────────────────────────────────────────────
    // While energyFlowing: interpolates forward every second (smooth bar).
    // When energyFlowing = false: HOLDS at current value — does NOT snap to 0.
    //
    // WHY not snap to 0:
    //   After door_closed, kwhAtStart is updated to current PZEM value so
    //   usedKwh resets to 0 from the API. But the PZEM hasn't actually stopped —
    //   it just needs ~40s to accumulate the next 0.01 kWh tick above the new
    //   kwhAtStart. Snapping displayKwh to 0 here would visually reset the bar.
    //   Instead we HOLD the bar at its current estimated position and wait for
    //   the next real PZEM tick to arrive before resuming forward movement.
    LaunchedEffect(stage) {
        if (stage != Stage.CHARGING) return@LaunchedEffect
        val kwhPerSecond = powerKw / 3600.0
        while (stage == Stage.CHARGING) {
            delay(1_000L)
            if (energyFlowing) {
                val estimated = (displayKwh + kwhPerSecond).coerceAtMost(pkg.kwhLimit)
                displayKwh = maxOf(estimated, realKwh).coerceAtMost(pkg.kwhLimit)
            }
            // energyFlowing = false → do nothing (hold current displayKwh value)
            // The 3s poll will snap forward when real kWh arrives
            if (displayKwh >= pkg.kwhLimit) {
                if (activeSessionId > 0) {
                    try {
                        ApiClient.api.stop(
                            com.example.plugbox.network.StopRequest(activeSessionId)
                        )
                    } catch (e: Exception) {
                        android.util.Log.e("SessionScreen", "Auto-stop failed: ${e.message}")
                    }
                }
                stage = Stage.COMPLETE
            }
        }
    }

    // ── 3s API poll — authoritative PZEM sync ────────────────────────────────
    // noAdvanceCount threshold = 20 polls = 60 seconds.
    //
    // WHY 60 seconds:
    //   PZEM-004T resolution is 0.01 kWh. At ~900W load, one tick takes ~40s.
    //   A threshold of 2 polls (6s) declared energyFlowing=false mid-tick,
    //   even while energy was genuinely flowing. 60s guarantees at least one
    //   full PZEM tick has been missed before we declare the plug as removed.
    LaunchedEffect(stage) {
        if (stage != Stage.CHARGING) return@LaunchedEffect
        while (stage == Stage.CHARGING) {
            try {
                if (activeSessionId > 0) {
                    val reading = ApiClient.api.meter(activeSessionId)
                    if (reading.ok) {
                        val newKwh = reading.usedKwh

                        when {
                            reading.noLoad -> {
                                // Backend confirmed no PZEM reading for >3s = plug removed.
                                // Freeze billing instantly — no need to wait 60s.
                                energyFlowing  = false
                                noAdvanceCount = 20 // skip the slow-path threshold
                                android.util.Log.d("SessionScreen", "noLoad=true → billing frozen")
                            }
                            realKwhPrev < 0.0 -> {
                                // First poll — no comparison yet, assume flowing
                                noAdvanceCount = 0
                            }
                            (newKwh - realKwhPrev) > 0.0001 -> {
                                // kWh advanced — energy is definitely flowing
                                noAdvanceCount = 0
                                energyFlowing  = true
                            }
                            else -> {
                                noAdvanceCount++
                                // 60s fallback: declare not-flowing if no tick for 20 polls
                                // At 150W, PZEM ticks every ~240s (80 polls × 3s).
                                // Old threshold of 20 (60s) froze bar before first tick.
                                if (noAdvanceCount >= 80) energyFlowing = false
                            }
                        }

                        realKwhPrev = realKwh
                        realKwh     = newKwh
                        if (newKwh > displayKwh) displayKwh = newKwh

                        if (reading.status == "ENDED" || reading.status == "FAILED") {
                            displayKwh = newKwh
                            stage = Stage.COMPLETE
                        }
                    }
                }
            } catch (e: Exception) {
                android.util.Log.e("SessionScreen", "Meter poll failed: ${e.message}")
            }
            delay(POLL_INTERVAL_MS)
        }
    }

    // Refund = unused amount (shown on stop dialog + receipt)
    val refundInr = (pkg.priceInr - usedInr).coerceAtLeast(0)

    // ── Dialogs ───────────────────────────────────────────────────────────────
    var showStopDialog   by remember { mutableStateOf(false) }
    var showCancelDialog by remember { mutableStateOf(false) }

    // Back gesture behaviour depends on current stage
    BackHandler {
        when (stage) {
            Stage.GRACE, Stage.LID_OPEN -> showCancelDialog = true
            Stage.CHARGING              -> showStopDialog   = true
            Stage.COMPLETE              -> onDone()
        }
    }

    // Stop charging dialog
    if (showStopDialog) {
        AlertDialog(
            onDismissRequest = { showStopDialog = false },
            containerColor   = SsWhite,
            shape            = RoundedCornerShape(20.dp),
            icon = {
                Icon(Icons.Outlined.StopCircle, null,
                    tint = SsRed, modifier = Modifier.size(30.dp))
            },
            title = {
                Text("Stop charging?", fontWeight = FontWeight.Bold,
                    fontSize = 18.sp, color = SsTextPrimary, textAlign = TextAlign.Center)
            },
            text = {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    Text(
                        "You've used ${String.format("%.2f", usedKwh)} kWh (₹$usedInr)",
                        fontSize = 14.sp, color = SsTextPrimary,
                        fontWeight = FontWeight.SemiBold, textAlign = TextAlign.Center
                    )
                    if (refundInr > 0) {
                        Text("₹$refundInr will be refunded to your wallet.",
                            fontSize = 13.sp, color = SsGreenDark, textAlign = TextAlign.Center)
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        showStopDialog = false
                        scope.launch {
                            try {
                                // FIX: use activeSessionId (set after unlock API returns),
                                // not sessionId (constructor param — always 0 for fresh sessions)
                                if (activeSessionId > 0) {
                                    ApiClient.api.stop(
                                        com.example.plugbox.network.StopRequest(activeSessionId)
                                    )
                                    // Backend now sends RELAY_OFF + SOLENOID_UNLOCK to hardware
                                }
                            } catch (e: Exception) {
                                android.util.Log.e("SessionScreen", "Stop failed: ${e.message}")
                            }
                            stage = Stage.COMPLETE
                        }
                    },
                    colors  = ButtonDefaults.buttonColors(containerColor = SsRed),
                    shape   = RoundedCornerShape(12.dp)
                ) { Text("Stop", fontWeight = FontWeight.Bold, color = SsWhite) }
            },
            dismissButton = {
                OutlinedButton(
                    onClick = { showStopDialog = false },
                    shape   = RoundedCornerShape(12.dp)
                ) { Text("Continue", color = SsTextPrimary) }
            }
        )
    }

    // Cancel session dialog (before charging starts)
    if (showCancelDialog) {
        AlertDialog(
            onDismissRequest = { showCancelDialog = false },
            containerColor   = SsWhite,
            shape            = RoundedCornerShape(20.dp),
            icon = {
                Icon(Icons.Outlined.WarningAmber, null,
                    tint = SsOrange, modifier = Modifier.size(30.dp))
            },
            title = {
                Text("Leave session?", fontWeight = FontWeight.Bold,
                    fontSize = 18.sp, color = SsTextPrimary, textAlign = TextAlign.Center)
            },
            text = {
                Text("Charging hasn't started yet. The charger will be released.",
                    fontSize = 14.sp, color = SsTextSecondary, textAlign = TextAlign.Center,
                    lineHeight = 22.sp)
            },
            confirmButton = {
                Button(
                    onClick = { showCancelDialog = false; onCancel() },
                    colors  = ButtonDefaults.buttonColors(containerColor = SsRed),
                    shape   = RoundedCornerShape(12.dp)
                ) { Text("Leave", fontWeight = FontWeight.Bold, color = SsWhite) }
            },
            dismissButton = {
                OutlinedButton(
                    onClick = { showCancelDialog = false },
                    shape   = RoundedCornerShape(12.dp)
                ) { Text("Stay", color = SsTextPrimary) }
            }
        )
    }

    // ── Main layout ───────────────────────────────────────────────────────────
    Scaffold(
        modifier       = modifier.fillMaxSize(),
        containerColor = SsSurface,
        topBar = { SsHeader(charger = charger, stage = stage) },
        // Stop button is sticky — always visible without scrolling (safety critical)
        bottomBar = {
            if (stage == Stage.CHARGING) {
                Surface(color = SsWhite, shadowElevation = 10.dp) {
                    Column(
                        Modifier
                            .fillMaxWidth()
                            .navigationBarsPadding()
                            .padding(horizontal = 16.dp, vertical = 12.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Button(
                            onClick  = { showStopDialog = true },
                            modifier = Modifier.fillMaxWidth().height(54.dp),
                            shape    = RoundedCornerShape(14.dp),
                            colors   = ButtonDefaults.buttonColors(
                                containerColor = SsRed, contentColor = SsWhite)
                        ) {
                            Icon(Icons.Outlined.StopCircle, null,
                                modifier = Modifier.size(20.dp))
                            Spacer(Modifier.width(8.dp))
                            Text("Stop charging",
                                fontWeight = FontWeight.Bold, fontSize = 16.sp)
                        }
                        SsInfoCard(
                            icon  = Icons.Outlined.Info,
                            text  = "Only the amount you use is charged. Unused balance is refunded instantly.",
                            color = SsGreenDark,
                            bg    = SsGreenBg
                        )
                    }
                }
            }
        }
    ) { scaffoldPadding ->

        Column(
            modifier = Modifier
                .padding(scaffoldPadding)
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp, vertical = 16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {

            // Render the active stage content
            when (stage) {

                Stage.GRACE -> SsGraceContent(
                    distanceMeters = distanceToCharger,
                    withinRange    = withinRange,
                    onUnlockLid    = {
                        // Call sessions/start → SOLENOID_UNLOCK sent to hardware
                        scope.launch {
                            try {
                                val userId = ApiClient.getUserId(context)
                                    ?: return@launch
                                val res = ApiClient.api.start(
                                    com.example.plugbox.network.StartRequest(
                                        chargerId = charger.id.toInt(),
                                        userId    = userId
                                    )
                                )
                                if (res.ok && res.sessionId != null) {
                                    activeSessionId = res.sessionId
                                    onSessionStarted(res.sessionId)
                                    android.util.Log.d("SessionScreen",
                                        "Start OK sessionId=${res.sessionId}")
                                    stage = Stage.LID_OPEN
                                } else {
                                    android.util.Log.e("SessionScreen",
                                        "Start failed: ${res.error}")
                                }
                            } catch (e: Exception) {
                                android.util.Log.e("SessionScreen",
                                    "Start exception: ${e.message}")
                                // Still advance to show lid open UI
                                stage = Stage.LID_OPEN
                            }
                        }
                    }
                )

                Stage.LID_OPEN -> SsLidOpenContent(
                    secondsLeft        = plugInSecondsLeft,
                    onSimulatePluggedIn = { stage = Stage.CHARGING } // dev only
                )

                Stage.CHARGING -> SsChargingContent(
                    pkg          = pkg,
                    usedKwh      = usedKwh,
                    usedInr      = usedInr,
                    remainingKwh = remainingKwh,
                    remainingInr = remainingInr,
                    progress     = progress,   // updates every 1s — no animation needed
                    etaMinutes   = etaMinutes
                )

                Stage.COMPLETE -> SsCompleteContent(
                    pkg           = pkg,
                    usedKwh       = usedKwh,
                    usedInr       = usedInr,
                    refundInr     = refundInr,
                    sessionFailed = sessionFailed,
                    sessionId     = activeSessionId,
                    onDone        = onDone
                )
            }

            // Step tracker — always visible at bottom
            if (stage != Stage.COMPLETE) {
                Spacer(Modifier.height(8.dp))
                SsStepTracker(stage = stage)
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 6 — Header
//
// Emotional design:
//   GRACE     → white, calm — user is approaching
//   LID_OPEN  → orange tint — urgency, action needed
//   CHARGING  → full green — alive, energy flowing, pulsing live dot
//   COMPLETE  → deep green — rich, celebratory finish
// ─────────────────────────────────────────────────────────────────────────────

@Composable
private fun SsHeader(charger: UiCharger, stage: Stage) {
    val bg = when (stage) {
        Stage.GRACE    -> SsWhite
        Stage.LID_OPEN -> SsOrangeBg
        Stage.CHARGING -> SsGreen
        Stage.COMPLETE -> SsGreenDark
    }
    val textColor = when (stage) {
        Stage.GRACE    -> SsTextPrimary
        Stage.LID_OPEN -> Color(0xFF92400E)
        Stage.CHARGING -> SsWhite
        Stage.COMPLETE -> SsWhite
    }
    val subColor = when (stage) {
        Stage.GRACE    -> SsTextSecondary
        Stage.LID_OPEN -> SsOrange
        Stage.CHARGING -> SsWhite.copy(alpha = 0.8f)
        Stage.COMPLETE -> SsWhite.copy(alpha = 0.8f)
    }
    val stageLabel = when (stage) {
        Stage.GRACE    -> "Walk to charger"
        Stage.LID_OPEN -> "Plug in & close door"
        Stage.CHARGING -> "Charging"
        Stage.COMPLETE -> "Session complete"
    }

    Surface(Modifier.fillMaxWidth(), color = bg,
        shadowElevation = if (stage == Stage.GRACE) 2.dp else 0.dp) {
        Row(
            modifier = Modifier
                .statusBarsPadding()
                .padding(horizontal = 16.dp, vertical = 14.dp),
            verticalAlignment     = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Icon(Icons.Outlined.EvStation, null,
                tint     = if (stage == Stage.GRACE) SsGreen else textColor,
                modifier = Modifier.size(22.dp))

            Column(Modifier.weight(1f)) {
                Text(charger.name, fontWeight = FontWeight.Bold,
                    fontSize = 15.sp, color = textColor, maxLines = 1)
                Text(stageLabel, fontSize = 12.sp, color = subColor)
            }

            // Live pulsing dot — only when charging
            if (stage == Stage.CHARGING) {
                SsPulseDot()
                Spacer(Modifier.width(4.dp))
                Text("Live", fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold, color = SsWhite)
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 7 — Stage: GRACE
//
// Emotion: Anticipation — "I'm here, let me in"
//
// Design:
//   • Large pulsing ripple around location icon — feels alive, GPS is working
//   • When within range → whole card flips green instantly — arrival moment
//   • Distance shown as hero number — user tracks their approach
//   • Unlock button pulses when enabled — draws eye to the action
// ─────────────────────────────────────────────────────────────────────────────

@Composable
private fun SsGraceContent(
    distanceMeters: Double?,
    withinRange:    Boolean,
    onUnlockLid:    () -> Unit
) {
    // Ripple animation — pulsing ring around the location icon
    val inf = rememberInfiniteTransition(label = "ripple")
    val rippleScale by inf.animateFloat(
        initialValue  = 0.6f,
        targetValue   = 1.4f,
        animationSpec = infiniteRepeatable(tween(1200, easing = FastOutSlowInEasing),
            RepeatMode.Restart),
        label = "rippleScale"
    )
    val rippleAlpha by inf.animateFloat(
        initialValue  = 0.5f,
        targetValue   = 0f,
        animationSpec = infiniteRepeatable(tween(1200, easing = FastOutSlowInEasing),
            RepeatMode.Restart),
        label = "rippleAlpha"
    )

    // Unlock button pulse when enabled
    val btnScale by inf.animateFloat(
        initialValue  = 1f,
        targetValue   = if (withinRange) 1.02f else 1f,
        animationSpec = infiniteRepeatable(tween(800), RepeatMode.Reverse),
        label         = "btnPulse"
    )

    Column(
        modifier            = Modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(24.dp)
    ) {

        Spacer(Modifier.height(16.dp))

        // ── Hero: Pulsing location icon ────────────────────────────────────
        Box(
            modifier         = Modifier.size(140.dp),
            contentAlignment = Alignment.Center
        ) {
            // Ripple ring — only when NOT within range (GPS is searching)
            if (!withinRange) {
                Box(
                    modifier = Modifier
                        .size(140.dp)
                        .scale(rippleScale)
                        .clip(CircleShape)
                        .background(SsOrange.copy(alpha = rippleAlpha))
                )
            }

            // Background circle — green when arrived, orange when approaching
            Box(
                modifier = Modifier
                    .size(100.dp)
                    .clip(CircleShape)
                    .background(if (withinRange) SsGreenBg else SsOrangeBg),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector        = if (withinRange) Icons.Outlined.LocationOn
                    else Icons.Outlined.NearMe,
                    contentDescription = null,
                    tint               = if (withinRange) SsGreen else SsOrange,
                    modifier           = Modifier.size(48.dp)
                )
            }
        }

        // ── Distance as hero text ──────────────────────────────────────────
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            when {
                withinRange -> {
                    Text("You're here!", fontSize = 26.sp,
                        fontWeight = FontWeight.Bold, color = SsGreen)
                    Spacer(Modifier.height(4.dp))
                    Text("Tap below to unlock the charger lid",
                        fontSize = 14.sp, color = SsTextSecondary)
                }
                distanceMeters == null -> {
                    Text("Locating you...", fontSize = 22.sp,
                        fontWeight = FontWeight.Bold, color = SsTextPrimary)
                    Spacer(Modifier.height(4.dp))
                    Text("Please wait while GPS loads",
                        fontSize = 14.sp, color = SsTextSecondary)
                }
                else -> {
                    // Hero distance number
                    val distText = if (distanceMeters < 1000)
                        "${distanceMeters.toInt()} m"
                    else "${"%.1f".format(distanceMeters / 1000)} km"

                    Text(distText, fontSize = 40.sp,
                        fontWeight = FontWeight.Bold, color = SsTextPrimary)
                    Spacer(Modifier.height(4.dp))
                    Text("away from the charger",
                        fontSize = 14.sp, color = SsTextSecondary)
                    Spacer(Modifier.height(2.dp))
                    Text("Unlock activates within ${UNLOCK_RADIUS_M.toInt()} m",
                        fontSize = 12.sp, color = SsOrange)
                }
            }
        }

        // ── Unlock button — pulses when ready ─────────────────────────────
        Button(
            onClick  = onUnlockLid,
            enabled  = withinRange,
            modifier = Modifier
                .fillMaxWidth()
                .height(58.dp)
                .scale(btnScale),
            shape    = RoundedCornerShape(16.dp),
            colors   = ButtonDefaults.buttonColors(
                containerColor         = SsGreen,
                contentColor           = SsWhite,
                disabledContainerColor = Color(0xFFCBD5E1),
                disabledContentColor   = SsWhite.copy(alpha = 0.6f)
            ),
            elevation = ButtonDefaults.buttonElevation(
                defaultElevation  = if (withinRange) 8.dp else 0.dp
            )
        ) {
            Icon(Icons.Outlined.LockOpen, null, modifier = Modifier.size(22.dp))
            Spacer(Modifier.width(10.dp))
            Text(
                text       = if (withinRange) "Unlock Lid" else "Get closer to unlock",
                fontWeight = FontWeight.Bold,
                fontSize   = 17.sp
            )
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 8 — Stage: LID_OPEN
//
// Emotion: Action — "One thing to do right now"
//
// Design:
//   • ONE large animated cable icon — user knows exactly what to do
//   • Bouncing arrow connecting cable to port — visual instruction
//   • Timer bold and central — urgency without panic until <30s
//   • Text is minimal — user is physically doing something, not reading
// ─────────────────────────────────────────────────────────────────────────────

@Composable
private fun SsLidOpenContent(
    secondsLeft:         Int,
    onSimulatePluggedIn: () -> Unit   // dev only — remove in production
) {
    val isUrgent   = secondsLeft <= 30
    val timerColor = if (isUrgent) SsRed else SsOrange
    val minutes    = secondsLeft / 60
    val seconds    = secondsLeft % 60
    val timerLabel = String.format(java.util.Locale.getDefault(), "%02d:%02d", minutes, seconds)

    // Bouncing cable icon animation
    val inf = rememberInfiniteTransition(label = "cable")
    val cableOffset by inf.animateFloat(
        initialValue  = 0f,
        targetValue   = -10f,
        animationSpec = infiniteRepeatable(
            tween(600, easing = FastOutSlowInEasing), RepeatMode.Reverse),
        label = "cableY"
    )

    Column(
        modifier            = Modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(24.dp)
    ) {

        Spacer(Modifier.height(8.dp))

        // Lid unlocked confirmation chip — small, not the hero
        Surface(
            modifier = Modifier.wrapContentSize(),
            shape    = RoundedCornerShape(999.dp),
            color    = SsGreenBg,
            border   = androidx.compose.foundation.BorderStroke(1.dp, SsGreen.copy(0.3f))
        ) {
            Row(
                Modifier.padding(horizontal = 14.dp, vertical = 8.dp),
                Arrangement.spacedBy(6.dp),
                Alignment.CenterVertically
            ) {
                Icon(Icons.Outlined.LockOpen, null,
                    tint = SsGreen, modifier = Modifier.size(16.dp))
                Text("Lid unlocked", fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold, color = SsGreenDark)
            }
        }

        // ── Hero: Cable icon with bounce ───────────────────────────────────
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(100.dp)
                    .offset(y = cableOffset.dp)
                    .clip(CircleShape)
                    .background(SsOrangeBg),
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.Outlined.Cable, null,
                    tint     = SsOrange,
                    modifier = Modifier.size(54.dp))
            }

            Text("Plug in your cable now", fontSize = 22.sp,
                fontWeight = FontWeight.Bold, color = SsTextPrimary,
                textAlign  = TextAlign.Center)

            Text("Connect the charger cable to\nyour vehicle's charging port",
                fontSize   = 14.sp,
                color      = SsTextSecondary,
                textAlign  = TextAlign.Center,
                lineHeight = 22.sp)
        }

        // ── Timer — hero number ────────────────────────────────────────────
        Surface(
            modifier = Modifier.fillMaxWidth(),
            shape    = RoundedCornerShape(16.dp),
            color    = if (isUrgent) SsRedBg else SsOrangeBg
        ) {
            Row(
                modifier              = Modifier.padding(horizontal = 20.dp, vertical = 16.dp),
                verticalAlignment     = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column {
                    Text("Plug in within", fontSize = 12.sp, color = SsTextSecondary)
                    Text(timerLabel, fontSize = 34.sp,
                        fontWeight = FontWeight.Bold, color = timerColor)
                }
                if (isUrgent) {
                    Surface(color = SsRed.copy(0.12f), shape = RoundedCornerShape(8.dp)) {
                        Text("Hurry!", fontSize = 13.sp, fontWeight = FontWeight.Bold,
                            color = SsRed,
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp))
                    }
                } else {
                    Icon(Icons.Outlined.Timer, null,
                        tint = timerColor, modifier = Modifier.size(34.dp))
                }
            }
        }

        // Dev simulate button — REMOVE IN PRODUCTION
        OutlinedButton(
            onClick  = onSimulatePluggedIn,
            modifier = Modifier.fillMaxWidth(),
            shape    = RoundedCornerShape(12.dp)
        ) {
            Icon(Icons.Outlined.ElectricBolt, null,
                modifier = Modifier.size(16.dp), tint = SsTextSecondary)
            Spacer(Modifier.width(6.dp))
            Text("Dev: Simulate Cable Plugged In",
                fontSize = 13.sp, color = SsTextSecondary)
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 9 — Stage: CHARGING
//
// Emotion: Confidence — "Everything is working, I'm in control"
//
// Design:
//   • kWh is the hero number — large, green, prominent
//   • Animated lightning bolt at top — shows energy is actively flowing
//   • Progress bar is thick and satisfying
//   • Small eco note — makes user feel good about EV choice
//   • Amount in smaller text below kWh — secondary info
// ─────────────────────────────────────────────────────────────────────────────

@SuppressLint("DefaultLocale")
@Composable
private fun SsChargingContent(
    pkg:          UiPackage,
    usedKwh:      Double,
    usedInr:      Int,
    remainingKwh: Double,
    remainingInr: Int,
    progress:     Float,
    etaMinutes:   Int
) {
    // Lightning bolt pulse — shows energy is flowing
    val inf = rememberInfiniteTransition(label = "bolt")
    val boltAlpha by inf.animateFloat(
        initialValue  = 0.4f,
        targetValue   = 1f,
        animationSpec = infiniteRepeatable(tween(600), RepeatMode.Reverse),
        label         = "boltAlpha"
    )

    // Approximate eco saving — 0.12 kg CO₂ saved per kWh vs petrol
    val co2Saved = (usedKwh * 0.12).let {
        if (it < 0.01) null else "${"%.0f".format(it * 1000)} g CO₂ saved"
    }

    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {

        // ── Charging status indicator ──────────────────────────────────────
        Surface(
            modifier = Modifier.fillMaxWidth(),
            shape    = RoundedCornerShape(16.dp),
            color    = SsGreenBg,
            border   = androidx.compose.foundation.BorderStroke(1.dp, SsGreen.copy(0.2f))
        ) {
            Row(
                Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
                Arrangement.spacedBy(10.dp),
                Alignment.CenterVertically
            ) {
                // Pulsing bolt — energy flowing indicator
                Icon(Icons.Outlined.Bolt, null,
                    tint     = SsGreen.copy(alpha = boltAlpha),
                    modifier = Modifier.size(24.dp))
                Text("Charging in progress",
                    fontWeight = FontWeight.SemiBold,
                    fontSize   = 14.sp,
                    color      = SsGreenDark,
                    modifier   = Modifier.weight(1f))
                SsPulseDot()
                Text("Live", fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold, color = SsGreen)
            }
        }

        // ── Live meter card ────────────────────────────────────────────────
        Surface(
            modifier        = Modifier.fillMaxWidth(),
            shape           = RoundedCornerShape(16.dp),
            color           = SsWhite,
            shadowElevation = 4.dp,
            border          = androidx.compose.foundation.BorderStroke(1.dp, SsDivider)
        ) {
            Column(Modifier.padding(20.dp)) {

                // kWh — hero stat, large green
                Column {
                    Row(
                        verticalAlignment     = Alignment.Bottom,
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Text(
                            // Use 4 decimal places for small packages, 2 for large
                            text       = if (pkg.kwhLimit < 0.1)
                                String.format("%.4f", usedKwh)
                            else
                                String.format("%.2f", usedKwh),
                            fontWeight = FontWeight.Bold,
                            fontSize   = 48.sp,
                            color      = SsGreen
                        )
                        Text("kWh",
                            fontSize   = 18.sp,
                            fontWeight = FontWeight.SemiBold,
                            color      = SsTextSecondary,
                            modifier   = Modifier.padding(bottom = 8.dp))
                    }
                    Text("used so far  ·  ₹$usedInr charged",
                        fontSize = 13.sp, color = SsTextSecondary)
                }

                Spacer(Modifier.height(20.dp))

                // ── Glowing EV progress bar ────────────────────────────────
                SsGlowingProgressBar(
                    progress = progress,
                    modifier = Modifier.fillMaxWidth()
                )

                Spacer(Modifier.height(6.dp))

                Row(Modifier.fillMaxWidth(), Arrangement.SpaceBetween) {
                    Text("${(progress * 100).toInt()}% complete",
                        fontSize = 12.sp, color = SsGreen,
                        fontWeight = FontWeight.SemiBold)
                    Text("${pkg.kwhLimit} kWh total",
                        fontSize = 12.sp, color = SsTextSecondary)
                }

                HorizontalDivider(Modifier.padding(vertical = 16.dp), color = SsDivider)

                // Secondary stats row
                Row(Modifier.fillMaxWidth(), Arrangement.SpaceBetween) {
                    // Remaining
                    Column {
                        Text("Remaining", fontSize = 11.sp, color = SsTextSecondary)
                        Text(
                            if (pkg.kwhLimit < 0.1)
                                String.format("%.4f kWh", remainingKwh)
                            else
                                String.format("%.2f kWh", remainingKwh),
                            fontSize = 14.sp, fontWeight = FontWeight.SemiBold,
                            color = SsTextPrimary)
                        Text("₹$remainingInr", fontSize = 13.sp, color = SsTextSecondary)
                    }
                    // ETA
                    Column(horizontalAlignment = Alignment.End) {
                        Text("ETA", fontSize = 11.sp, color = SsTextSecondary)
                        Text("~$etaMinutes min",
                            fontSize = 14.sp, fontWeight = FontWeight.SemiBold,
                            color = SsBlue)
                    }
                }

                // Eco note — only shows when there's something meaningful to show
                if (co2Saved != null) {
                    Spacer(Modifier.height(12.dp))
                    Surface(
                        color = SsGreenBg,
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Row(
                            Modifier.padding(horizontal = 10.dp, vertical = 7.dp),
                            Arrangement.spacedBy(6.dp),
                            Alignment.CenterVertically
                        ) {
                            Text("🌱", fontSize = 13.sp)
                            Text(co2Saved, fontSize = 12.sp,
                                color = SsGreenDark, fontWeight = FontWeight.Medium)
                        }
                    }
                }
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 10 — Stage: COMPLETE
//
// Emotion: Satisfaction — "I did it. Here's what happened."
//
// Design:
//   • Spring animated checkmark — same spring feel as BookingConfirmed
//   • Hero stat: kWh charged in large green — the achievement
//   • "X km of clean driving" — makes user feel great about their EV choice
//   • Receipt is secondary — below the fold, user can see it after celebrating
//   • Wallet refund highlighted in green — positive surprise if applicable
// ─────────────────────────────────────────────────────────────────────────────

private enum class UnlockState { IDLE, LOADING, UNLOCKED }

@SuppressLint("DefaultLocale")
@Composable
private fun SsCompleteContent(
    pkg:           UiPackage,
    usedKwh:       Double,
    usedInr:       Int,
    refundInr:     Int,
    sessionFailed: Boolean = false,
    sessionId:     Int     = 0,
    onDone:        () -> Unit
) {
    val context = LocalContext.current
    val scope   = rememberCoroutineScope()

    // Unlock cable button state
    var unlockState by remember { mutableStateOf(UnlockState.IDLE) }

    // Spring animation on entry
    var visible by remember { mutableStateOf(false) }
    val iconScale by animateFloatAsState(
        targetValue   = if (visible) 1f else 0f,
        animationSpec = spring(Spring.DampingRatioMediumBouncy, Spring.StiffnessMediumLow),
        label         = "completeIcon"
    )
    LaunchedEffect(Unit) { visible = true }

    // ── Session failed / timed out ─────────────────────────────────────────────
    if (sessionFailed) {
        Column(
            modifier            = Modifier.fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(20.dp)
        ) {
            Spacer(Modifier.height(8.dp))

            Box(
                modifier = Modifier
                    .size(88.dp)
                    .scale(iconScale)
                    .clip(CircleShape)
                    .background(Color(0xFFFFF0F0)),
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.Outlined.Cancel, "Failed",
                    tint     = Color(0xFFE53935),
                    modifier = Modifier.size(54.dp))
            }

            Text("Session Ended",
                fontSize   = 26.sp,
                fontWeight = FontWeight.Bold,
                color      = SsTextPrimary)

            Text(
                "The lid was not closed in time.\nYour full amount has been refunded.",
                fontSize   = 15.sp,
                color      = SsTextSecondary,
                textAlign  = androidx.compose.ui.text.style.TextAlign.Center,
                lineHeight = 22.sp
            )

            if (refundInr > 0) {
                Surface(
                    color  = SsGreenBg,
                    shape  = RoundedCornerShape(12.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, SsGreen.copy(0.2f))
                ) {
                    Row(
                        Modifier.padding(horizontal = 20.dp, vertical = 14.dp),
                        Arrangement.spacedBy(8.dp),
                        Alignment.CenterVertically
                    ) {
                        Icon(Icons.Outlined.Refresh, null,
                            tint = SsGreen, modifier = Modifier.size(20.dp))
                        Text("+₹$refundInr refunded to wallet",
                            fontSize   = 15.sp,
                            fontWeight = FontWeight.SemiBold,
                            color      = SsGreenDark)
                    }
                }
            }

            Button(
                onClick  = onDone,
                modifier = Modifier.fillMaxWidth(),
                colors   = ButtonDefaults.buttonColors(containerColor = SsGreen)
            ) {
                Text("Back to Home", fontSize = 15.sp,
                    fontWeight = FontWeight.SemiBold,
                    modifier   = Modifier.padding(vertical = 4.dp))
            }
        }
        return
    }

    // ── Normal completion ──────────────────────────────────────────────────────
    val checkScale by animateFloatAsState(
        targetValue   = if (visible) 1f else 0f,
        animationSpec = spring(Spring.DampingRatioMediumBouncy, Spring.StiffnessMediumLow),
        label         = "completeCheck"
    )

    // Approximate range from energy charged (avg EV: ~6 km per kWh for 2-wheelers)
    val approxKm = (usedKwh * 6).toInt().coerceAtLeast(0)

    Column(
        modifier            = Modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(20.dp)
    ) {

        Spacer(Modifier.height(8.dp))

        // Animated checkmark
        Box(
            modifier = Modifier
                .size(88.dp)
                .scale(checkScale)
                .clip(CircleShape)
                .background(SsGreenBg),
            contentAlignment = Alignment.Center
        ) {            Icon(Icons.Outlined.CheckCircle, "Done",
            tint     = SsGreen,
            modifier = Modifier.size(54.dp))
        }

        // Hero message
        Text("Charging Complete!", fontSize = 26.sp,
            fontWeight = FontWeight.Bold, color = SsTextPrimary)

        // Hero stat — kWh charged
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Row(
                verticalAlignment     = Alignment.Bottom,
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Text(String.format("%.2f", usedKwh),
                    fontSize   = 48.sp,
                    fontWeight = FontWeight.Bold,
                    color      = SsGreen)
                Text("kWh", fontSize = 18.sp,
                    fontWeight = FontWeight.SemiBold,
                    color      = SsTextSecondary,
                    modifier   = Modifier.padding(bottom = 8.dp))
            }
            Text("charged  ·  ₹$usedInr",
                fontSize = 14.sp, color = SsTextSecondary)

            // Eco / range note
            if (approxKm > 0) {
                Spacer(Modifier.height(8.dp))
                Surface(
                    color = SsGreenBg,
                    shape = RoundedCornerShape(999.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, SsGreen.copy(0.2f))
                ) {
                    Text(
                        "🌱  ~$approxKm km of clean driving added",
                        fontSize = 13.sp,
                        color    = SsGreenDark,
                        fontWeight = FontWeight.Medium,
                        modifier = Modifier.padding(horizontal = 14.dp, vertical = 7.dp)
                    )
                }
            }
        }

        // Unlock cable button — user taps when ready to retrieve cable
        when (unlockState) {
            UnlockState.IDLE -> {
                Button(
                    onClick = {
                        unlockState = UnlockState.LOADING
                        scope.launch {
                            try {
                                val userId = ApiClient.getUserId(context) ?: "rashi"
                                ApiClient.api.unlockCable(
                                    com.example.plugbox.network.UnlockCableRequest(
                                        sessionId = sessionId,
                                        userId    = userId
                                    )
                                )
                                unlockState = UnlockState.UNLOCKED
                            } catch (e: Exception) {
                                android.util.Log.e("SessionScreen", "unlock-cable failed: ${e.message}")
                                unlockState = UnlockState.UNLOCKED // show unlocked anyway
                            }
                        }
                    },
                    modifier = Modifier.fillMaxWidth().height(54.dp),
                    shape    = RoundedCornerShape(14.dp),
                    colors   = ButtonDefaults.buttonColors(
                        containerColor = SsGreen, contentColor = SsWhite)
                ) {
                    Icon(Icons.Outlined.LockOpen, null,
                        modifier = Modifier.size(20.dp).padding(end = 0.dp))
                    Spacer(Modifier.width(8.dp))
                    Text("Unlock to retrieve cable",
                        fontWeight = FontWeight.Bold, fontSize = 16.sp)
                }
            }
            UnlockState.LOADING -> {
                Button(
                    onClick  = {},
                    enabled  = false,
                    modifier = Modifier.fillMaxWidth().height(54.dp),
                    shape    = RoundedCornerShape(14.dp),
                    colors   = ButtonDefaults.buttonColors(
                        containerColor = SsGreen.copy(alpha = 0.6f))
                ) {
                    Text("Unlocking...", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                }
            }
            UnlockState.UNLOCKED -> {
                // Lid is now open — show instructions + Done
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    shape    = RoundedCornerShape(12.dp),
                    color    = SsGreenBg,
                    border   = androidx.compose.foundation.BorderStroke(1.dp, SsGreen.copy(0.2f))
                ) {
                    Row(
                        Modifier.padding(horizontal = 16.dp, vertical = 14.dp),
                        Arrangement.spacedBy(10.dp),
                        Alignment.CenterVertically
                    ) {
                        Icon(Icons.Outlined.LockOpen, null,
                            tint = SsGreen, modifier = Modifier.size(20.dp))
                        Column {
                            Text("Lid unlocked",
                                fontSize   = 14.sp,
                                fontWeight = FontWeight.SemiBold,
                                color      = SsGreenDark)
                            Text("Unplug cable and close the lid",
                                fontSize = 12.sp, color = SsTextSecondary)
                        }
                    }
                }

                Spacer(Modifier.height(4.dp))

                Button(
                    onClick  = onDone,
                    modifier = Modifier.fillMaxWidth().height(54.dp),
                    shape    = RoundedCornerShape(14.dp),
                    colors   = ButtonDefaults.buttonColors(
                        containerColor = SsGreen, contentColor = SsWhite)
                ) {
                    Text("Done", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                }
            }
        }

        Spacer(Modifier.height(8.dp))
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 11 — Step tracker
// Shows progress through the 4 stages at the bottom of the screen
// ─────────────────────────────────────────────────────────────────────────────

private data class SsStep(
    val label:  String,
    val icon:   ImageVector,
    val done:   Boolean,
    val active: Boolean
)

@Composable
private fun SsStepTracker(stage: Stage) {
    val steps = listOf(
        SsStep("Arrived",  Icons.Outlined.LocationOn,
            done = stage > Stage.GRACE,    active = stage == Stage.GRACE),
        SsStep("Unlocked", Icons.Outlined.LockOpen,
            done = stage > Stage.LID_OPEN,  active = stage == Stage.LID_OPEN),
        SsStep("Charging", Icons.Outlined.Bolt,
            done = stage > Stage.CHARGING,  active = stage == Stage.CHARGING),
        SsStep("Done",     Icons.Outlined.TaskAlt,
            done = stage == Stage.COMPLETE, active = false)
    )

    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape    = RoundedCornerShape(14.dp),
        color    = SsWhite,
        border   = androidx.compose.foundation.BorderStroke(1.dp, SsDivider)
    ) {
        Column(Modifier.padding(16.dp)) {
            Text("Journey progress", fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold, color = SsTextSecondary)
            Spacer(Modifier.height(12.dp))
            Row(
                Modifier.fillMaxWidth(),
                Arrangement.SpaceBetween,
                Alignment.Top
            ) {
                steps.forEachIndexed { i, step ->
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier            = Modifier.weight(1f)
                    ) {
                        Box(
                            modifier = Modifier.size(32.dp).clip(CircleShape).background(
                                when { step.done -> SsGreen; step.active -> SsGreenBg; else -> Color(0xFFE5E7EB) }
                            ),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(step.icon, null,
                                tint = when { step.done -> SsWhite; step.active -> SsGreen; else -> SsTextSecondary },
                                modifier = Modifier.size(16.dp))
                        }
                        Spacer(Modifier.height(4.dp))
                        Text(step.label, fontSize = 10.sp,
                            fontWeight = if (step.done || step.active) FontWeight.Bold else FontWeight.Normal,
                            color      = if (step.done || step.active) SsGreen else SsTextSecondary,
                            textAlign  = TextAlign.Center)
                    }
                    if (i < steps.lastIndex) {
                        Box(
                            Modifier.weight(0.4f).height(1.5.dp).padding(top = 15.dp)
                                .background(if (step.done) SsGreen else Color(0xFFE5E7EB))
                        )
                    }
                }
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 12 — Glowing EV progress bar
//
// Inspired by neon EV charging UI.
// Layout:  [%%]  [══glowing bar══  ]  [⚡]
//
// Glow is achieved with two BlurMaskFilter layers under the solid bar:
//   • Outer glow: large blur, low alpha
//   • Inner glow: tight blur, higher alpha
//   • Solid bar on top: full opacity SsGreen
//   • Bright leading-edge dot: white circle at tip of fill
//   • Inner highlight streak: subtle white line along top of fill
//
// The glow alpha pulses with InfiniteTransition so the bar looks alive
// even when progress is not changing (e.g. slow charge).
// ─────────────────────────────────────────────────────────────────────────────

@Composable
private fun SsGlowingProgressBar(
    progress: Float,
    modifier: Modifier = Modifier
) {
    // Pulsing glow — the bar breathes even when value is static
    val inf = rememberInfiniteTransition(label = "barGlow")
    val glowAlpha by inf.animateFloat(
        initialValue  = 0.45f,
        targetValue   = 0.85f,
        animationSpec = infiniteRepeatable(
            tween(1000, easing = FastOutSlowInEasing),
            RepeatMode.Reverse
        ),
        label = "glowAlpha"
    )

    val clampedProgress = progress.coerceIn(0f, 1f)

    Row(
        modifier          = modifier,
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        // ── EV charging icon ───────────────────────────────────────────────
        Icon(
            Icons.Outlined.EvStation,
            contentDescription = null,
            tint     = SsGreen,
            modifier = Modifier.size(22.dp)
        )

        // ── Bar ────────────────────────────────────────────────────────────
        Canvas(
            modifier = Modifier
                .weight(1f)
                .height(32.dp)   // extra height so outer glow has room
        ) {
            val barH    = 14.dp.toPx()
            val yOff    = (size.height - barH) / 2f
            val filled  = size.width * clampedProgress
            val r       = barH / 2f

            // Track — dark green tint background
            drawRoundRect(
                color        = SsGreen.copy(alpha = 0.12f),
                topLeft      = Offset(0f, yOff),
                size         = Size(size.width, barH),
                cornerRadius = CornerRadius(r)
            )

            if (clampedProgress > 0.01f) {
                // Outer glow — wide soft blur
                drawIntoCanvas { canvas ->
                    canvas.drawRoundRect(
                        left    = 0f,
                        top     = yOff,
                        right   = filled,
                        bottom  = yOff + barH,
                        radiusX = r,
                        radiusY = r,
                        paint   = Paint().apply {
                            asFrameworkPaint().apply {
                                isAntiAlias = true
                                color       = SsGreen.copy(alpha = glowAlpha * 0.45f).toArgb()
                                maskFilter  = android.graphics.BlurMaskFilter(
                                    24f, android.graphics.BlurMaskFilter.Blur.NORMAL
                                )
                            }
                        }
                    )
                }

                // Inner glow — tight blur, brighter
                drawIntoCanvas { canvas ->
                    canvas.drawRoundRect(
                        left    = 0f,
                        top     = yOff,
                        right   = filled,
                        bottom  = yOff + barH,
                        radiusX = r,
                        radiusY = r,
                        paint   = Paint().apply {
                            asFrameworkPaint().apply {
                                isAntiAlias = true
                                color       = SsGreen.copy(alpha = glowAlpha * 0.7f).toArgb()
                                maskFilter  = android.graphics.BlurMaskFilter(
                                    10f, android.graphics.BlurMaskFilter.Blur.NORMAL
                                )
                            }
                        }
                    )
                }

                // Solid filled bar on top
                drawRoundRect(
                    color        = SsGreen,
                    topLeft      = Offset(0f, yOff),
                    size         = Size(filled, barH),
                    cornerRadius = CornerRadius(r)
                )

                // Inner highlight — thin white streak along top of fill (glass effect)
                if (filled > r * 2) {
                    drawRoundRect(
                        color        = Color.White.copy(alpha = 0.28f),
                        topLeft      = Offset(r, yOff + barH * 0.1f),
                        size         = Size(
                            (filled - r * 2).coerceAtLeast(0f),
                            barH * 0.32f
                        ),
                        cornerRadius = CornerRadius(r * 0.4f)
                    )
                }

                // Bright leading-edge dot — marks the tip of progress
                if (filled > r) {
                    drawCircle(
                        color  = Color.White.copy(alpha = glowAlpha * 0.9f),
                        radius = r * 0.52f,
                        center = Offset(filled - r, yOff + barH / 2f)
                    )
                }
            }
        }

        // ── Percentage label ───────────────────────────────────────────────
        Text(
            text       = "${(clampedProgress * 100).toInt()}%",
            fontSize   = 13.sp,
            fontWeight = FontWeight.Bold,
            color      = SsGreen
        )
    }
}



// Pulsing green dot — used in header and live meter
@Composable
private fun SsPulseDot() {
    val inf = rememberInfiniteTransition(label = "dot")
    val a by inf.animateFloat(
        0.3f, 1f,
        infiniteRepeatable(tween(700), RepeatMode.Reverse),
        "dotAlpha"
    )
    Box(Modifier.size(8.dp).clip(CircleShape).background(SsGreen.copy(alpha = a)))
}

// Status card (lid open confirmation etc.)
@Composable
private fun SsStatusCard(
    icon:  ImageVector,
    bg:    Color,
    tint:  Color,
    title: String,
    sub:   String
) {
    Surface(Modifier.fillMaxWidth(), RoundedCornerShape(16.dp), color = bg) {
        Row(
            Modifier.padding(16.dp),
            Arrangement.spacedBy(12.dp),
            Alignment.CenterVertically
        ) {
            Box(
                Modifier.size(40.dp).clip(CircleShape)
                    .background(tint.copy(alpha = 0.15f)),
                Alignment.Center
            ) {
                Icon(icon, null, tint = tint, modifier = Modifier.size(22.dp))
            }
            Column {
                Text(title, fontWeight = FontWeight.Bold, fontSize = 14.sp, color = SsTextPrimary)
                Text(sub, fontSize = 12.sp, color = SsTextSecondary)
            }
        }
    }
}

// Info/hint card
@Composable
private fun SsInfoCard(
    icon:  ImageVector,
    text:  String,
    color: Color,
    bg:    Color = SsSurface
) {
    Surface(Modifier.fillMaxWidth(), RoundedCornerShape(12.dp), color = bg,
        border = androidx.compose.foundation.BorderStroke(1.dp, SsDivider)) {
        Row(Modifier.padding(12.dp), Arrangement.spacedBy(8.dp), Alignment.Top) {
            Icon(icon, null, tint = color, modifier = Modifier.size(16.dp).padding(top = 1.dp))
            Text(text, fontSize = 13.sp, color = color, lineHeight = 20.sp)
        }
    }
}

// Receipt row for complete screen
@Composable
private fun SsReceiptRow(label: String, value: String) {
    Row(Modifier.fillMaxWidth(), Arrangement.SpaceBetween, Alignment.CenterVertically) {
        Text(label, fontSize = 13.sp, color = SsTextSecondary)
        Text(value, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = SsTextPrimary)
    }
}