// ─────────────────────────────────────────────────────────────────────────────
// StatusScreen.kt
//
// PURPOSE:
//   Shows the user's charging history and live session status.
//   Emotional goal: "Look how far you've come" — makes user feel good
//   about their EV choice every time they open it.
//
// SECTIONS:
//   1. Active session card  → only shown if a session is currently live
//                             tappable → navigates to SessionScreen
//   2. Lifetime stats strip → total kWh, total spent, CO₂ saved
//   3. Past sessions list   → grouped by Today/Yesterday/Earlier
//                             each row is expandable (tap to see details)
//   4. Empty state          → shown when no sessions at all
//
// DATA:
//   Phase 1 → hardcoded dummy data
//   Phase 2 → ApiClient.api.getSessions(userId)
//             ApiClient.api.getActiveSession(userId)
//
// NAVIGATION:
//   Accessed from: Bottom nav Status tab
//   Exits to: SessionScreen (via active session card tap)
// ─────────────────────────────────────────────────────────────────────────────

package com.example.plugbox.ui

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.platform.LocalContext
import com.example.plugbox.network.ApiClient
import kotlinx.coroutines.launch
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1 — Colors
// ─────────────────────────────────────────────────────────────────────────────

private val StGreen         = Color(0xFF16C784)
private val StGreenDark     = Color(0xFF065F46)
private val StGreenBg       = Color(0xFFECFDF5)
private val StBlue          = Color(0xFF3B82F6)
private val StBlueBg        = Color(0xFFEFF6FF)
private val StOrange        = Color(0xFFF59E0B)
private val StOrangeBg      = Color(0xFFFFF7ED)
private val StTextPrimary   = Color(0xFF111827)
private val StTextSecondary = Color(0xFF6B7280)
private val StDivider       = Color(0xFFE5E7EB)
private val StWhite         = Color(0xFFFFFFFF)
private val StSurface       = Color(0xFFF9FAFB)

// Gradient for active session card
private val StActiveGradient = Brush.linearGradient(
    colors = listOf(Color(0xFF16C784), Color(0xFF059669))
)

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2 — Data models + dummy data
// ─────────────────────────────────────────────────────────────────────────────

// Active BOOKING — booking confirmed, timer running, user hasn't arrived yet
// This is the critical "app closed and reopened" state
// Phase 2: ApiClient.api.getActiveBooking(userId)
data class StActiveBooking(
    val chargerName:    String,
    val packageName:    String,
    val packageInr:     Int,
    val secondsLeft:    Int     // remaining grace period in seconds
)

// Active SESSION — charging in progress
// Phase 2: ApiClient.api.getActiveSession(userId)
data class StActiveSession(
    val chargerName: String,
    val usedKwh:     Double,
    val usedInr:     Int,
    val etaMinutes:  Int,
    val progress:    Float
)

// Past session — shown in the history list
data class StSession(
    val id:          String,
    val chargerName: String,
    val dateGroup:   String,
    val dateLabel:   String,
    val durationMin: Int,
    val usedKwh:     Double,
    val usedInr:     Int,
    val refundInr:   Int
)

// ── Dummy data ────────────────────────────────────────────────────────────────
// Phase 1: set dummyActiveBooking = null and dummyActiveSession = null
// to test different states. Only one should be non-null at a time.

// Simulates: user booked, closed app, reopened — booking still active
private val dummyActiveBooking: StActiveBooking? = StActiveBooking(
    chargerName  = "PlugBox - Nandanvan, D-mart",
    packageName  = "Standard",
    packageInr   = 40,
    secondsLeft  = 487   // ~8 minutes left when screen opens
)

// Active session — set to null when testing booking state above
// Phase 2: only one of these will be non-null at any time
private val dummyActiveSession: StActiveSession? = null

// Past sessions
private val dummySessions = listOf(
    StSession("s1", "PlugBox - Medical Chowk, V.R Mall",
        "Yesterday", "Yesterday, 6:30 PM", 45, 1.0, 40, 0),
    StSession("s2", "PlugBox - Nandanvan, D-mart",
        "Yesterday", "Yesterday, 2:15 PM", 22, 0.5, 20, 0),
    StSession("s3", "PlugBox - INOX Movie Theater",
        "Earlier",   "Oct 25, 7:10 PM",   38, 0.8, 32, 8),
    StSession("s4", "PlugBox - Civil Lines, C.P Club",
        "Earlier",   "Oct 23, 5:45 PM",   55, 1.5, 55, 0),
    StSession("s5", "PlugBox - Besa Pipla Rd",
        "Earlier",   "Oct 20, 11:30 AM",  18, 0.4, 16, 4),
)

private val lifetimeKwh  = dummySessions.sumOf { it.usedKwh }
private val lifetimeInr  = dummySessions.sumOf { it.usedInr }
private val lifetimeCo2g = (lifetimeKwh * 120).toInt()

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3 — Main composable
// ─────────────────────────────────────────────────────────────────────────────

@Composable
fun StatusScreen(
    onViewActiveSession: () -> Unit = {},
    onIveArrived:        () -> Unit = {},
    onCancelBooking:     () -> Unit = {},
    modifier:            Modifier   = Modifier
) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val scope   = rememberCoroutineScope()
    var expandedId by remember { mutableStateOf<String?>(null) }
    var showCancelDialog by remember { mutableStateOf(false) }

    // Real data state
    var activeBooking  by remember { mutableStateOf<StActiveBooking?>(null) }
    var activeSession  by remember { mutableStateOf<StActiveSession?>(null) }

    // Load real active booking/session on launch
    LaunchedEffect(Unit) {
        try {
            val userId = com.example.plugbox.network.ApiClient.getUserId(context)
                ?: return@LaunchedEffect
            val res = com.example.plugbox.network.ApiClient.api.activeSession(userId)
            if (res.active && res.sessionId != null) {
                when (res.status) {
                    "CREATED", "UNLOCK_SENT", "UNLOCKED", "PLUG_WAIT" -> {
                        // Has booking but not charging yet
                        activeBooking = StActiveBooking(
                            chargerName = res.chargerName ?: "PlugBox Charger",
                            packageName = res.packageName ?: "Standard",
                            packageInr  = (res.packagePaise ?: 4000) / 100,
                            secondsLeft = 600
                        )
                    }
                    "ACTIVE" -> {
                        activeSession = StActiveSession(
                            chargerName = res.chargerName ?: "PlugBox Charger",
                            usedKwh     = 0.0,
                            usedInr     = 0,
                            etaMinutes  = 0,
                            progress    = 0f
                        )
                        activeBooking = null
                    }
                    else -> {
                        activeBooking = null
                        activeSession = null
                    }
                }
            }
        } catch (e: Exception) {
            android.util.Log.e("StatusScreen", "Load active session failed: ${e.message}")
        }
    }

    if (showCancelDialog) {
        AlertDialog(
            onDismissRequest = { showCancelDialog = false },
            containerColor   = Color.White,
            shape            = RoundedCornerShape(20.dp),
            icon = {
                Icon(Icons.Outlined.WarningAmber, null,
                    tint = StOrange, modifier = Modifier.size(30.dp))
            },
            title = {
                Text("Cancel booking?", fontWeight = FontWeight.Bold,
                    fontSize = 18.sp, color = StTextPrimary,
                    textAlign = TextAlign.Center)
            },
            text = {
                Text(
                    "The charger will be released and made available to others. " +
                            "Any amount deducted will be refunded to your wallet.",
                    fontSize = 14.sp, color = StTextSecondary,
                    textAlign = TextAlign.Center, lineHeight = 22.sp
                )
            },
            confirmButton = {
                Button(
                    onClick = { showCancelDialog = false; onCancelBooking() },
                    colors  = ButtonDefaults.buttonColors(
                        containerColor = Color(0xFFEF4444)),
                    shape   = RoundedCornerShape(12.dp)
                ) { Text("Yes, cancel", fontWeight = FontWeight.Bold,
                    color = Color.White) }
            },
            dismissButton = {
                OutlinedButton(onClick = { showCancelDialog = false },
                    shape = RoundedCornerShape(12.dp)) {
                    Text("Keep booking", color = StTextPrimary)
                }
            }
        )
    }

    // Real past sessions
    var pastSessions by remember { mutableStateOf<List<StSession>>(emptyList()) }

    LaunchedEffect(Unit) {
        try {
            val userId = com.example.plugbox.network.ApiClient.getUserId(context)
                ?: return@LaunchedEffect
            val res = com.example.plugbox.network.ApiClient.api.sessionHistory(userId)
            if (res.ok) {
                pastSessions = res.sessions.map { s ->
                    StSession(
                        id          = s.id.toString(),
                        chargerName = s.chargerName,
                        dateGroup   = "Recent",
                        dateLabel   = s.endedAt?.take(16)?.replace("T", " ") ?: "",
                        durationMin = s.durationMin,
                        usedKwh     = s.usedKwh,
                        usedInr     = s.usedInr.toInt(),
                        refundInr   = s.refundInr.toInt()
                    )
                }
            }
        } catch (e: Exception) {
            android.util.Log.e("StatusScreen", "History failed: ${e.message}")
        }
    }

    val lifetimeKwh  = pastSessions.sumOf { it.usedKwh }
    val lifetimeInr  = pastSessions.sumOf { it.usedInr }
    val lifetimeCo2g = (lifetimeKwh * 120).toInt()

    val grouped: List<Pair<String, List<StSession>>> = remember(pastSessions) {
        listOf("Recent").mapNotNull { group ->
            val sessions = pastSessions.filter { it.dateGroup == group }
            if (sessions.isNotEmpty()) group to sessions else null
        }
    }

    Scaffold(
        modifier       = modifier.fillMaxSize(),
        containerColor = StSurface
    ) { padding ->

        LazyColumn(
            modifier       = Modifier.padding(padding).fillMaxSize(),
            contentPadding = PaddingValues(bottom = 32.dp)
        ) {

            // Screen title
            item {
                Text(
                    text       = "Status",
                    fontSize   = 26.sp,
                    fontWeight = FontWeight.Bold,
                    color      = StTextPrimary,
                    modifier   = Modifier
                        .statusBarsPadding()
                        .padding(horizontal = 16.dp, vertical = 16.dp)
                )
            }

            // ── Active BOOKING card ────────────────────────────────────────
            activeBooking?.let { booking ->
                item {
                    StActiveBookingCard(
                        booking        = booking,
                        onIveArrived   = onIveArrived,
                        onCancelClick  = { showCancelDialog = true },
                        modifier       = Modifier.padding(horizontal = 16.dp)
                    )
                    Spacer(Modifier.height(14.dp))
                }
            }

            // ── Active SESSION card ────────────────────────────────────────
            activeSession?.let { session ->
                item {
                    StActiveSessionCard(
                        session  = session,
                        onTap    = onViewActiveSession,
                        modifier = Modifier.padding(horizontal = 16.dp)
                    )
                    Spacer(Modifier.height(14.dp))
                }
            }

            // Lifetime stats
            if (pastSessions.isNotEmpty()) {
                item {
                    StLifetimeStats(
                        totalKwh = lifetimeKwh,
                        totalInr = lifetimeInr,
                        co2Grams = lifetimeCo2g,
                        modifier = Modifier.padding(horizontal = 16.dp)
                    )
                    Spacer(Modifier.height(20.dp))
                }
            }

            // Past sessions heading
            if (pastSessions.isNotEmpty()) {
                item {
                    Text("Past Sessions", fontSize = 17.sp,
                        fontWeight = FontWeight.Bold, color = StTextPrimary,
                        modifier   = Modifier.padding(horizontal = 16.dp))
                    Spacer(Modifier.height(10.dp))
                }

                grouped.forEach { (header, sessions) ->
                    item(key = "header_$header") {
                        Text(header, fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                            color      = StTextSecondary,
                            modifier   = Modifier.padding(
                                horizontal = 16.dp, vertical = 6.dp))
                    }
                    items(sessions, key = { it.id }) { session ->
                        StSessionRow(
                            session    = session,
                            isExpanded = expandedId == session.id,
                            onToggle   = {
                                expandedId = if (expandedId == session.id)
                                    null else session.id
                            },
                            modifier = Modifier.padding(horizontal = 16.dp)
                        )
                        Spacer(Modifier.height(8.dp))
                    }
                }

            } else if (activeBooking == null && activeSession == null) {
                item { StEmptyState() }
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4 — Active BOOKING card
//
// Shown when: user booked → closed app → reopened
// This solves the critical navigation gap — user can always find I've Arrived.
//
// Emotion: Urgency — "You have something to do before time runs out"
// Color: Orange gradient — different from green (charging) on purpose
//
// Timer: counts down live from secondsLeft
// When timer hits 0 → booking auto-expired → card disappears
// ─────────────────────────────────────────────────────────────────────────────

@Composable
private fun StActiveBookingCard(
    booking:       StActiveBooking,
    onIveArrived:  () -> Unit,
    onCancelClick: () -> Unit,
    modifier:      Modifier = Modifier
) {
    // Live countdown — starts from booking.secondsLeft
    var secondsLeft by remember { mutableIntStateOf(booking.secondsLeft) }

    LaunchedEffect(Unit) {
        while (secondsLeft > 0) {
            kotlinx.coroutines.delay(1_000L)
            secondsLeft--
        }
        // Timer expired — Phase 2: call cancel API, update UI state
    }

    val minutes    = secondsLeft / 60
    val seconds    = secondsLeft % 60
    val timerLabel = String.format(java.util.Locale.getDefault(), "%02d:%02d", minutes, seconds)
    val isUrgent   = secondsLeft <= 60

    // Orange for warning/pending, red tint when urgent
    val cardGradient = if (isUrgent)
        Brush.linearGradient(listOf(Color(0xFFEF4444), Color(0xFFDC2626)))
    else
        Brush.linearGradient(listOf(Color(0xFFF59E0B), Color(0xFFD97706)))

    Box(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .background(cardGradient)
    ) {
        Column(Modifier.padding(18.dp)) {

            // Header row — booking label + timer
            Row(
                Modifier.fillMaxWidth(),
                Arrangement.SpaceBetween,
                Alignment.CenterVertically
            ) {
                Column {
                    // Status label
                    Row(
                        verticalAlignment     = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Icon(Icons.Outlined.BookmarkAdded, null,
                            tint     = Color.White.copy(alpha = 0.9f),
                            modifier = Modifier.size(14.dp))
                        Text("BOOKING ACTIVE", fontSize = 11.sp,
                            fontWeight    = FontWeight.Bold,
                            color         = Color.White.copy(alpha = 0.9f),
                            letterSpacing = 1.sp)
                    }
                    Spacer(Modifier.height(4.dp))
                    Text(booking.chargerName,
                        fontWeight = FontWeight.Bold,
                        fontSize   = 15.sp,
                        color      = Color.White,
                        maxLines   = 1)
                    Spacer(Modifier.height(2.dp))
                    Text("${booking.packageName}  ·  ₹${booking.packageInr}",
                        fontSize = 13.sp,
                        color    = Color.White.copy(alpha = 0.85f))
                }

                // Timer — right side, large
                Column(horizontalAlignment = Alignment.End) {
                    Text("Time left", fontSize = 11.sp,
                        color = Color.White.copy(alpha = 0.75f))
                    Text(timerLabel, fontSize = 26.sp,
                        fontWeight = FontWeight.Bold,
                        color      = Color.White)
                    if (isUrgent) {
                        Text("Hurry!", fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color      = Color.White.copy(alpha = 0.9f))
                    }
                }
            }

            Spacer(Modifier.height(16.dp))

            // Action buttons
            Row(
                Modifier.fillMaxWidth(),
                Arrangement.spacedBy(10.dp)
            ) {
                // PRIMARY — I've Arrived (white filled — stands out on orange)
                Button(
                    onClick  = onIveArrived,
                    modifier = Modifier.weight(1f).height(46.dp),
                    shape    = RoundedCornerShape(12.dp),
                    colors   = ButtonDefaults.buttonColors(
                        containerColor = Color.White,
                        contentColor   = if (isUrgent) Color(0xFFEF4444)
                        else Color(0xFFF59E0B)
                    )
                ) {
                    Icon(Icons.Outlined.LocationOn, null,
                        modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(6.dp))
                    Text("I've Arrived",
                        fontWeight = FontWeight.Bold, fontSize = 14.sp)
                }

                // SECONDARY — Cancel (outlined white)
                OutlinedButton(
                    onClick  = onCancelClick,
                    modifier = Modifier.height(46.dp),
                    shape    = RoundedCornerShape(12.dp),
                    border   = androidx.compose.foundation.BorderStroke(
                        1.5.dp, Color.White.copy(alpha = 0.6f)),
                    colors   = ButtonDefaults.outlinedButtonColors(
                        contentColor = Color.White)
                ) {
                    Text("Cancel", fontWeight = FontWeight.Medium, fontSize = 14.sp)
                }
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5 — Active SESSION card
//
// Green gradient — same visual language as CHARGING header in SessionScreen.
// Pulsing bolt + "LIVE" badge — impossible to miss.
// Progress bar shows how far along the session is.
// Tapping anywhere navigates to SessionScreen.
// ─────────────────────────────────────────────────────────────────────────────

@Composable
private fun StActiveSessionCard(
    session:  StActiveSession,
    onTap:    () -> Unit,
    modifier: Modifier = Modifier
) {
    // Pulsing bolt animation
    val inf = rememberInfiniteTransition(label = "bolt")
    val boltAlpha by inf.animateFloat(
        initialValue  = 0.5f,
        targetValue   = 1f,
        animationSpec = infiniteRepeatable(tween(700), RepeatMode.Reverse),
        label         = "boltAlpha"
    )

    Box(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .background(StActiveGradient)
            .clickable { onTap() }
    ) {
        Column(Modifier.padding(20.dp)) {

            // LIVE badge + charger name
            Row(
                Modifier.fillMaxWidth(),
                Arrangement.SpaceBetween,
                Alignment.CenterVertically
            ) {
                Column(Modifier.weight(1f)) {
                    // LIVE badge
                    Row(
                        verticalAlignment     = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Box(
                            Modifier.size(8.dp).clip(CircleShape)
                                .background(StWhite)
                        )
                        Text("LIVE", fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color      = StWhite.copy(alpha = 0.9f),
                            letterSpacing = 1.sp)
                    }
                    Spacer(Modifier.height(4.dp))
                    Text(session.chargerName,
                        fontWeight = FontWeight.Bold,
                        fontSize   = 15.sp,
                        color      = StWhite,
                        maxLines   = 1)
                }

                // Pulsing bolt
                Icon(Icons.Outlined.Bolt, null,
                    tint     = StWhite.copy(alpha = boltAlpha),
                    modifier = Modifier.size(32.dp))
            }

            Spacer(Modifier.height(16.dp))

            // Stats row
            Row(
                Modifier.fillMaxWidth(),
                Arrangement.spacedBy(0.dp)
            ) {
                StLiveStat(
                    value    = "${"%.2f".format(session.usedKwh)} kWh",
                    label    = "Used",
                    modifier = Modifier.weight(1f)
                )
                // Vertical separator
                Box(
                    Modifier.width(1.dp).height(36.dp)
                        .background(StWhite.copy(alpha = 0.25f))
                        .align(Alignment.CenterVertically)
                )
                StLiveStat(
                    value    = "₹${session.usedInr}",
                    label    = "Charged",
                    modifier = Modifier.weight(1f)
                )
                Box(
                    Modifier.width(1.dp).height(36.dp)
                        .background(StWhite.copy(alpha = 0.25f))
                        .align(Alignment.CenterVertically)
                )
                StLiveStat(
                    value    = "~${session.etaMinutes} min",
                    label    = "ETA",
                    modifier = Modifier.weight(1f)
                )
            }

            Spacer(Modifier.height(14.dp))

            // Progress bar
            LinearProgressIndicator(
                progress   = { session.progress },
                modifier   = Modifier
                    .fillMaxWidth()
                    .height(6.dp)
                    .clip(RoundedCornerShape(999.dp)),
                color      = StWhite,
                trackColor = StWhite.copy(alpha = 0.25f),
                strokeCap  = StrokeCap.Round
            )

            Spacer(Modifier.height(10.dp))

            // Tap hint
            Row(
                Modifier.fillMaxWidth(),
                Arrangement.End,
                Alignment.CenterVertically
            ) {
                Text("View session", fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    color      = StWhite.copy(alpha = 0.9f))
                Spacer(Modifier.width(4.dp))
                Icon(Icons.Outlined.ArrowForward, null,
                    tint     = StWhite.copy(alpha = 0.9f),
                    modifier = Modifier.size(16.dp))
            }
        }
    }
}

@Composable
private fun StLiveStat(value: String, label: String, modifier: Modifier = Modifier) {
    Column(
        modifier            = modifier,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(value, fontSize = 16.sp,
            fontWeight = FontWeight.Bold, color = StWhite)
        Text(label, fontSize = 11.sp,
            color = StWhite.copy(alpha = 0.75f))
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5 — Lifetime stats strip
//
// 3 equal cards in a row — kWh, ₹ spent, CO₂ saved.
// CO₂ is in green — reinforces eco-positive feeling.
// ─────────────────────────────────────────────────────────────────────────────

@Composable
private fun StLifetimeStats(
    totalKwh: Double,
    totalInr: Int,
    co2Grams: Int,
    modifier: Modifier = Modifier
) {
    Row(
        modifier              = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        StStatCard(
            icon     = Icons.Outlined.Bolt,
            iconBg   = StBlueBg,
            iconTint = StBlue,
            value    = "${"%.1f".format(totalKwh)}",
            unit     = "kWh",
            label    = "Total charged",
            modifier = Modifier.weight(1f)
        )
        StStatCard(
            icon     = Icons.Outlined.CurrencyRupee,
            iconBg   = StOrangeBg,
            iconTint = StOrange,
            value    = "₹$totalInr",
            unit     = "",
            label    = "Total spent",
            modifier = Modifier.weight(1f)
        )
        StStatCard(
            icon     = Icons.Outlined.Park,
            iconBg   = StGreenBg,
            iconTint = StGreen,
            value    = "${co2Grams}g",
            unit     = "",
            label    = "CO₂ saved",
            modifier = Modifier.weight(1f)
        )
    }
}

@Composable
private fun StStatCard(
    icon:     ImageVector,
    iconBg:   Color,
    iconTint: Color,
    value:    String,
    unit:     String,
    label:    String,
    modifier: Modifier = Modifier
) {
    Surface(
        modifier        = modifier,
        shape           = RoundedCornerShape(16.dp),
        color           = StWhite,
        shadowElevation = 2.dp,
        border          = androidx.compose.foundation.BorderStroke(1.dp, StDivider)
    ) {
        Column(
            modifier            = Modifier.padding(12.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .clip(CircleShape)
                    .background(iconBg),
                contentAlignment = Alignment.Center
            ) {
                Icon(icon, null, tint = iconTint, modifier = Modifier.size(18.dp))
            }

            Text(value, fontSize = 18.sp,
                fontWeight = FontWeight.Bold, color = StTextPrimary,
                textAlign  = TextAlign.Center)

            Text(label, fontSize = 10.sp,
                color     = StTextSecondary,
                textAlign = TextAlign.Center,
                lineHeight = 14.sp)
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 6 — Past session row (expandable)
//
// Collapsed: charger name + date + kWh + amount on one row
// Expanded:  adds duration, per-kWh rate, refund if any
//
// AnimatedVisibility handles the expand/collapse smoothly
// ─────────────────────────────────────────────────────────────────────────────

@Composable
private fun StSessionRow(
    session:    StSession,
    isExpanded: Boolean,
    onToggle:   () -> Unit,
    modifier:   Modifier = Modifier
) {
    Surface(
        modifier        = modifier.fillMaxWidth(),
        shape           = RoundedCornerShape(14.dp),
        color           = StWhite,
        shadowElevation = 1.dp,
        border          = androidx.compose.foundation.BorderStroke(
            width = if (isExpanded) 1.5.dp else 1.dp,
            color = if (isExpanded) StGreen.copy(alpha = 0.4f) else StDivider
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clickable { onToggle() }
        ) {
            // ── Collapsed row ──────────────────────────────────────────────
            Row(
                modifier          = Modifier.padding(14.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Bolt icon
                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .clip(CircleShape)
                        .background(StGreenBg),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Outlined.EvStation, null,
                        tint     = StGreen,
                        modifier = Modifier.size(18.dp))
                }

                Spacer(Modifier.width(12.dp))

                Column(Modifier.weight(1f)) {
                    Text(session.chargerName,
                        fontWeight = FontWeight.SemiBold,
                        fontSize   = 14.sp,
                        color      = StTextPrimary,
                        maxLines   = 1)
                    Spacer(Modifier.height(3.dp))
                    Text(session.dateLabel,
                        fontSize = 12.sp, color = StTextSecondary)
                }

                Column(horizontalAlignment = Alignment.End) {
                    Text("${"%.1f".format(session.usedKwh)} kWh",
                        fontWeight = FontWeight.Bold,
                        fontSize   = 14.sp,
                        color      = StTextPrimary)
                    Spacer(Modifier.height(2.dp))
                    Text("₹${session.usedInr}",
                        fontSize = 13.sp, color = StTextSecondary)
                }

                Spacer(Modifier.width(8.dp))

                // Chevron rotates on expand
                val rotation by animateFloatAsState(
                    targetValue   = if (isExpanded) 180f else 0f,
                    animationSpec = tween(200),
                    label         = "chevron"
                )
                Icon(Icons.Outlined.KeyboardArrowDown, null,
                    tint     = StTextSecondary,
                    modifier = Modifier.size(20.dp)
                        .graphicsLayer { rotationZ = rotation })
            }

            // ── Expanded detail ────────────────────────────────────────────
            AnimatedVisibility(
                visible = isExpanded,
                enter   = expandVertically() + fadeIn(),
                exit    = shrinkVertically() + fadeOut()
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(StGreenBg.copy(alpha = 0.5f))
                        .padding(horizontal = 14.dp, vertical = 12.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    HorizontalDivider(color = StDivider)
                    Spacer(Modifier.height(2.dp))

                    // Detail rows
                    StDetailRow(
                        icon  = Icons.Outlined.Timer,
                        label = "Duration",
                        value = "${session.durationMin} min"
                    )
                    StDetailRow(
                        icon  = Icons.Outlined.Bolt,
                        label = "Energy",
                        value = "${"%.2f".format(session.usedKwh)} kWh"
                    )
                    StDetailRow(
                        icon  = Icons.Outlined.CurrencyRupee,
                        label = "Rate",
                        value = "₹${"%.1f".format(session.usedInr / session.usedKwh)}/kWh"
                    )
                    StDetailRow(
                        icon  = Icons.Outlined.Park,
                        label = "CO₂ saved",
                        value = "${(session.usedKwh * 120).toInt()} g"
                    )

                    // Refund row — only shown if applicable
                    if (session.refundInr > 0) {
                        StDetailRow(
                            icon      = Icons.Outlined.Refresh,
                            label     = "Wallet refund",
                            value     = "+₹${session.refundInr}",
                            valueColor = StGreen
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun StDetailRow(
    icon:       ImageVector,
    label:      String,
    value:      String,
    valueColor: Color = StTextPrimary
) {
    Row(
        Modifier.fillMaxWidth(),
        Arrangement.SpaceBetween,
        Alignment.CenterVertically
    ) {
        Row(
            verticalAlignment     = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Icon(icon, null, tint = StTextSecondary, modifier = Modifier.size(14.dp))
            Text(label, fontSize = 13.sp, color = StTextSecondary)
        }
        Text(value, fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold, color = valueColor)
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 7 — Empty state
// First-time user — no sessions yet
// ─────────────────────────────────────────────────────────────────────────────

@Composable
private fun StEmptyState() {
    Column(
        modifier            = Modifier
            .fillMaxWidth()
            .padding(vertical = 80.dp, horizontal = 32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // Illustration — nested circles
        Box(
            modifier = Modifier.size(100.dp),
            contentAlignment = Alignment.Center
        ) {
            Box(
                Modifier.size(100.dp).clip(CircleShape)
                    .background(StGreenBg)
            )
            Box(
                Modifier.size(70.dp).clip(CircleShape)
                    .background(StGreen.copy(alpha = 0.1f))
            )
            Icon(Icons.Outlined.Bolt, null,
                tint     = StGreen,
                modifier = Modifier.size(40.dp))
        }

        Text("No sessions yet",
            fontWeight = FontWeight.Bold,
            fontSize   = 20.sp,
            color      = StTextPrimary)

        Text(
            "Your charging sessions will appear here.\nBook your first charge to get started.",
            fontSize  = 14.sp,
            color     = StTextSecondary,
            textAlign = TextAlign.Center,
            lineHeight = 22.sp
        )
    }
}