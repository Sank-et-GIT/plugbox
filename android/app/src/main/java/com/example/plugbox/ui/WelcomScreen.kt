// ─────────────────────────────────────────────────────────────────────────────
// WelcomeScreen.kt
//
// PURPOSE:
//   1.5 second animated welcome shown once — right after first login.
//   Creates a memorable first impression. Auto-advances to Home.
//
// EMOTION: "You're in. Welcome to your EV community."
//
// ANIMATION SEQUENCE:
//   0ms   → screen fades in
//   100ms → bolt icon springs in
//   400ms → "Welcome," fades up
//   700ms → user's name fades up (personalised)
//   1000ms→ tagline fades up
//   1500ms→ auto-advance to Home
// ─────────────────────────────────────────────────────────────────────────────

package com.example.plugbox.ui

import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Bolt
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay

private val WcGreen     = Color(0xFF16C784)
private val WcGreenMid  = Color(0xFF0D9166)
private val WcGreenDark = Color(0xFF065F46)
private val WcWhite     = Color(0xFFFFFFFF)

@Composable
fun WelcomeScreen(
    onFinished: () -> Unit,
    modifier:   Modifier = Modifier
) {
    val context  = LocalContext.current
    val userName = remember {
        context.getSharedPreferences("plugbox_prefs", android.content.Context.MODE_PRIVATE)
            .getString("user_name", "there") ?: "there"
    }
    // First name only
    val firstName = userName.split(" ").firstOrNull() ?: userName

    // Animation states
    var iconVisible     by remember { mutableStateOf(false) }
    var welcomeVisible  by remember { mutableStateOf(false) }
    var nameVisible     by remember { mutableStateOf(false) }
    var taglineVisible  by remember { mutableStateOf(false) }

    val iconScale by animateFloatAsState(
        targetValue   = if (iconVisible) 1f else 0f,
        animationSpec = spring(Spring.DampingRatioMediumBouncy, Spring.StiffnessMediumLow),
        label         = "iconScale"
    )
    val welcomeAlpha by animateFloatAsState(
        targetValue   = if (welcomeVisible) 1f else 0f,
        animationSpec = tween(400),
        label         = "welcomeAlpha"
    )
    val nameAlpha by animateFloatAsState(
        targetValue   = if (nameVisible) 1f else 0f,
        animationSpec = tween(400),
        label         = "nameAlpha"
    )
    val taglineAlpha by animateFloatAsState(
        targetValue   = if (taglineVisible) 1f else 0f,
        animationSpec = tween(400),
        label         = "taglineAlpha"
    )

    // Animation sequence
    LaunchedEffect(Unit) {
        delay(100L);  iconVisible    = true
        delay(300L);  welcomeVisible = true
        delay(300L);  nameVisible    = true
        delay(300L);  taglineVisible = true
        delay(600L);  onFinished()   // auto-advance after full sequence
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    listOf(WcGreen, WcGreenMid, WcGreenDark)
                )
            ),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Bolt icon in white circle
            Box(
                modifier = Modifier
                    .size(80.dp)
                    .scale(iconScale)
                    .clip(CircleShape)
                    .background(WcWhite.copy(alpha = 0.15f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    Icons.Outlined.Bolt, null,
                    tint     = WcWhite,
                    modifier = Modifier.size(44.dp)
                )
            }

            Spacer(Modifier.height(8.dp))

            // "Welcome,"
            Text(
                text      = "Welcome,",
                fontSize  = 22.sp,
                color     = WcWhite.copy(alpha = welcomeAlpha * 0.85f),
                fontWeight = FontWeight.Normal
            )

            // User's first name — large, personal
            Text(
                text       = firstName,
                fontSize   = 40.sp,
                fontWeight = FontWeight.Bold,
                color      = WcWhite.copy(alpha = nameAlpha)
            )

            // Tagline
            Text(
                text      = "Let's charge Nagpur. 🌱",
                fontSize  = 16.sp,
                color     = WcWhite.copy(alpha = taglineAlpha * 0.8f)
            )
        }
    }
}