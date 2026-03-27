// ─────────────────────────────────────────────────────────────────────────────
// BookingConfirmedScreen.kt
//
// PURPOSE:
//   Celebration + action screen shown after payment is accepted.
//   Primary goal: get user moving toward the charger immediately.
//
// DESIGN DECISIONS:
//   • No top bar — this is a moment, not a navigation screen
//   • Large animated checkmark dominates top — makes user feel the success
//   • Maps is PRIMARY action — user must drive there first
//   • I've Arrived is SECONDARY — only usable after reaching charger
//   • Cancel is tiny text at bottom — reduces accidental cancels
//   • Timer is clean and calm — not a colored alert box
//   • No progress steps — irrelevant at this moment, shown on Session screen
//
// NAVIGATION:
//   Entered from : ChargerDetailScreen (Proceed to pay)
//   Exits to     : SessionScreen (I've Arrived)
//                  HomeScreen   (Cancel confirmed / Timer expired)
//
// TIMER:
//   10 min → stops when user taps I've Arrived
//   Hits 0 → onTimerExpired() → back to Home
//
// DATA:
//   Phase 1 → UiCharger + UiPackage from PlugBoxHomeFlow, no API calls here
//   Phase 2 → onIveArrived triggers session start API in PlugBoxHomeFlow
// ─────────────────────────────────────────────────────────────────────────────

package com.example.plugbox.ui

import android.content.Intent
import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1 — Constants
// ─────────────────────────────────────────────────────────────────────────────

private const val GRACE_SECONDS  = 600   // 10 minutes
private const val WARN_SECONDS   = 180   // 3 minutes → orange
private const val URGENT_SECONDS = 60    // 1 minute  → red

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2 — Colors
// ─────────────────────────────────────────────────────────────────────────────

private val BcGreen         = Color(0xFF16C784)
private val BcGreenBg       = Color(0xFFECFDF5)
private val BcGreenDark     = Color(0xFF059669)
private val BcBlue          = Color(0xFF3B82F6)
private val BcOrange        = Color(0xFFF59E0B)
private val BcRed           = Color(0xFFEF4444)
private val BcTextPrimary   = Color(0xFF111827)
private val BcTextSecondary = Color(0xFF6B7280)
private val BcDivider       = Color(0xFFE5E7EB)
private val BcWhite         = Color(0xFFFFFFFF)
private val BcSurface       = Color(0xFFF9FAFB)

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3 — Main composable
// ─────────────────────────────────────────────────────────────────────────────

@Composable
fun BookingConfirmedScreen(
    charger:         UiCharger,
    pkg:             UiPackage,
    onIveArrived:    () -> Unit,
    onCancelBooking: () -> Unit,
    onTimerExpired:  () -> Unit,
    modifier:        Modifier = Modifier
) {
    val context = LocalContext.current

    // ── Timer ─────────────────────────────────────────────────────────────────
    var secondsLeft  by remember { mutableIntStateOf(GRACE_SECONDS) }
    var timerRunning by remember { mutableStateOf(true) }

    LaunchedEffect(timerRunning) {
        if (!timerRunning) return@LaunchedEffect
        while (secondsLeft > 0) {
            delay(1_000L)
            secondsLeft--
        }
        onTimerExpired()
    }

    val minutes    = secondsLeft / 60
    val seconds    = secondsLeft % 60
    val timerLabel = String.format(java.util.Locale.getDefault(), "%02d:%02d", minutes, seconds)

    val isUrgent  = secondsLeft <= URGENT_SECONDS
    val isWarning = secondsLeft <= WARN_SECONDS

    val timerColor by animateColorAsState(
        targetValue   = when { isUrgent -> BcRed; isWarning -> BcOrange; else -> BcGreen },
        animationSpec = tween(800),
        label         = "timerColor"
    )

    // ── Checkmark animation — large spring bounce on entry ────────────────────
    var animStarted by remember { mutableStateOf(false) }
    val checkScale by animateFloatAsState(
        targetValue   = if (animStarted) 1f else 0f,
        animationSpec = spring(
            dampingRatio = Spring.DampingRatioMediumBouncy,
            stiffness    = Spring.StiffnessMediumLow
        ),
        label = "checkScale"
    )
    LaunchedEffect(Unit) {
        delay(100L)   // tiny delay so user sees the animation start
        animStarted = true
    }

    // ── Cancel dialog ─────────────────────────────────────────────────────────
    var showCancelDialog by remember { mutableStateOf(false) }

    // Back gesture → cancel dialog (prevent accidental exits)
    BackHandler { showCancelDialog = true }

    if (showCancelDialog) {
        AlertDialog(
            onDismissRequest = { showCancelDialog = false },
            containerColor   = BcWhite,
            shape            = RoundedCornerShape(20.dp),
            icon = {
                Icon(Icons.Outlined.WarningAmber, null,
                    tint = BcOrange, modifier = Modifier.size(30.dp))
            },
            title = {
                Text("Cancel booking?",
                    fontWeight = FontWeight.Bold, fontSize = 18.sp,
                    color = BcTextPrimary, textAlign = TextAlign.Center)
            },
            text = {
                Text(
                    "The charger will be released to others. " +
                            "Any amount charged will be refunded to your wallet instantly.",
                    fontSize = 14.sp, color = BcTextSecondary,
                    textAlign = TextAlign.Center, lineHeight = 22.sp
                )
            },
            confirmButton = {
                Button(
                    onClick = { showCancelDialog = false; onCancelBooking() },
                    colors  = ButtonDefaults.buttonColors(containerColor = BcRed),
                    shape   = RoundedCornerShape(12.dp)
                ) { Text("Yes, cancel", fontWeight = FontWeight.Bold, color = BcWhite) }
            },
            dismissButton = {
                OutlinedButton(
                    onClick = { showCancelDialog = false },
                    shape   = RoundedCornerShape(12.dp)
                ) { Text("Keep booking", color = BcTextPrimary) }
            }
        )
    }

    // ── Main layout ───────────────────────────────────────────────────────────
    Box(
        modifier = modifier
            .fillMaxSize()
            .background(BcWhite)
    ) {
        Column(
            modifier            = Modifier
                .fillMaxSize()
                .statusBarsPadding()
                .navigationBarsPadding()
                .padding(horizontal = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.SpaceBetween
        ) {

            // ── TOP SECTION — celebration ──────────────────────────────────────
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier            = Modifier.padding(top = 48.dp)
            ) {

                // Large animated checkmark — dominates the top
                Box(
                    modifier = Modifier
                        .size(100.dp)
                        .scale(checkScale)
                        .clip(CircleShape)
                        .background(BcGreenBg),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        Icons.Outlined.CheckCircle,
                        contentDescription = "Confirmed",
                        tint     = BcGreen,
                        modifier = Modifier.size(64.dp)
                    )
                }

                Spacer(Modifier.height(20.dp))

                Text(
                    text       = "Booking Confirmed!",
                    fontSize   = 26.sp,
                    fontWeight = FontWeight.Bold,
                    color      = BcTextPrimary
                )

                Spacer(Modifier.height(8.dp))

                Text(
                    text      = "Head to the charger now",
                    fontSize  = 15.sp,
                    color     = BcTextSecondary
                )
            }

            // ── MIDDLE SECTION — info ─────────────────────────────────────────
            Column(
                modifier            = Modifier.fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {

                // Charger + package info — clean, readable
                Surface(
                    modifier        = Modifier.fillMaxWidth(),
                    shape           = RoundedCornerShape(16.dp),
                    color           = BcSurface,
                    border          = androidx.compose.foundation.BorderStroke(1.dp, BcDivider)
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        // Charger name — large and prominent
                        Row(
                            verticalAlignment     = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Icon(Icons.Outlined.EvStation, null,
                                tint = BcGreen, modifier = Modifier.size(20.dp))
                            Text(
                                text       = charger.name,
                                fontSize   = 15.sp,
                                fontWeight = FontWeight.SemiBold,
                                color      = BcTextPrimary,
                                maxLines   = 1
                            )
                        }

                        // Package as a clean chip
                        Row(
                            verticalAlignment     = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Surface(
                                color = BcGreen.copy(alpha = 0.1f),
                                shape = RoundedCornerShape(999.dp)
                            ) {
                                Text(
                                    text     = pkg.name,
                                    fontSize = 12.sp,
                                    color    = BcGreenDark,
                                    fontWeight = FontWeight.SemiBold,
                                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                                )
                            }
                            Text("·", color = BcTextSecondary, fontSize = 13.sp)
                            Text("${pkg.kwhLimit} kWh",
                                fontSize = 13.sp, color = BcTextSecondary)
                            Text("·", color = BcTextSecondary, fontSize = 13.sp)
                            Text("₹${pkg.priceInr}",
                                fontSize = 13.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = BcTextPrimary)
                        }
                    }
                }

                // Timer — clean minimal design, not a colored alert box
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    shape    = RoundedCornerShape(16.dp),
                    color    = BcSurface,
                    border   = androidx.compose.foundation.BorderStroke(
                        1.5.dp, timerColor.copy(alpha = 0.3f)
                    )
                ) {
                    Row(
                        modifier              = Modifier.padding(horizontal = 20.dp, vertical = 14.dp),
                        verticalAlignment     = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Row(
                            verticalAlignment     = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Icon(
                                Icons.Outlined.Timer, null,
                                tint     = timerColor,
                                modifier = Modifier.size(22.dp)
                            )
                            Column {
                                Text("Charger reserved for",
                                    fontSize = 11.sp, color = BcTextSecondary)
                                Text(
                                    text       = timerLabel,
                                    fontSize   = 26.sp,
                                    fontWeight = FontWeight.Bold,
                                    color      = timerColor
                                )
                            }
                        }

                        // Urgency badge — only when under 1 minute
                        if (isUrgent) {
                            Surface(
                                color = BcRed.copy(alpha = 0.1f),
                                shape = RoundedCornerShape(8.dp)
                            ) {
                                Text(
                                    "Hurry!",
                                    fontSize   = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                    color      = BcRed,
                                    modifier   = Modifier.padding(horizontal = 10.dp, vertical = 5.dp)
                                )
                            }
                        }
                    }
                }
            }

            // ── BOTTOM SECTION — actions ──────────────────────────────────────
            Column(
                modifier            = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 16.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {

                // PRIMARY — Open in Google Maps (user needs to drive there first)
                Button(
                    onClick  = {
                        val uri    = Uri.parse("google.navigation:q=${charger.lat},${charger.lng}&mode=d")
                        val intent = Intent(Intent.ACTION_VIEW, uri).apply {
                            setPackage("com.google.android.apps.maps")
                        }
                        runCatching { context.startActivity(intent) }.onFailure {
                            context.startActivity(
                                Intent(Intent.ACTION_VIEW,
                                    Uri.parse("https://maps.google.com/?daddr=${charger.lat},${charger.lng}"))
                            )
                        }
                    },
                    modifier = Modifier.fillMaxWidth().height(54.dp),
                    shape    = RoundedCornerShape(14.dp),
                    colors   = ButtonDefaults.buttonColors(
                        containerColor = BcBlue, contentColor = BcWhite)
                ) {
                    Icon(Icons.Outlined.Navigation, null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(8.dp))
                    Text("Open in Google Maps",
                        fontWeight = FontWeight.Bold, fontSize = 15.sp)
                }

                // SECONDARY — I've Arrived (green outlined)
                OutlinedButton(
                    onClick  = {
                        timerRunning = false   // stop the countdown — user is here
                        onIveArrived()
                    },
                    modifier = Modifier.fillMaxWidth().height(54.dp),
                    shape    = RoundedCornerShape(14.dp),
                    border   = androidx.compose.foundation.BorderStroke(1.5.dp, BcGreen),
                    colors   = ButtonDefaults.outlinedButtonColors(contentColor = BcGreen)
                ) {
                    Icon(Icons.Outlined.LocationOn, null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(8.dp))
                    Text("I've Arrived", fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
                }

                // DESTRUCTIVE — Cancel (tiny, at the very bottom, easy to miss)
                TextButton(onClick = { showCancelDialog = true }) {
                    Text(
                        "Cancel booking",
                        fontSize   = 13.sp,
                        color      = BcTextSecondary.copy(alpha = 0.7f),
                        fontWeight = FontWeight.Normal
                    )
                }
            }
        }
    }
}