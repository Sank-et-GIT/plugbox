package com.example.plugbox.ui

import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.foundation.layout.offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.ContentScale
import androidx.compose.foundation.Image
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.plugbox.R

// ── LIGHT PALETTE (Amazon-style) ──────────────────────────────
private val PageBg        = Color(0xFFF5F5F0)   // Amazon's warm off-white
private val TextDark      = Color(0xFF131921)   // Amazon's near-black
private val TextGray      = Color(0xFF565959)   // Amazon secondary text
private val TextLight     = Color(0xFF999999)   // subtle tip text
private val ButtonBg      = Color(0xFFE7E9EC)   // Amazon's gray button
private val ButtonText    = Color(0xFF0F1111)   // Amazon button text
private val DividerGray   = Color(0xFFDDDDDD)
private val PlugGreen     = Color(0xFF16C784)
private val PlugGreenBg   = Color(0xFFECFDF5)
private val PlugGreenText = Color(0xFF065F46)

// ─────────────────────────────────────────────────────────────
//  CHECKING SCREEN
//  Shown for ~100–300ms on startup.
//  Prevents the "offline flash" before real state is known.
// ─────────────────────────────────────────────────────────────
@Composable
fun CheckingConnectivityScreen() {
    val inf = rememberInfiniteTransition(label = "check")

    val rotation by inf.animateFloat(
        initialValue  = 0f,
        targetValue   = 360f,
        animationSpec = infiniteRepeatable(
            tween(900, easing = LinearEasing),
            RepeatMode.Restart
        ),
        label = "rot"
    )
    val d1 by inf.animateFloat(0.3f, 1f,
        infiniteRepeatable(tween(500, delayMillis = 0), RepeatMode.Reverse), "d1")
    val d2 by inf.animateFloat(0.3f, 1f,
        infiniteRepeatable(tween(500, delayMillis = 180), RepeatMode.Reverse), "d2")
    val d3 by inf.animateFloat(0.3f, 1f,
        infiniteRepeatable(tween(500, delayMillis = 360), RepeatMode.Reverse), "d3")

    Box(
        Modifier.fillMaxSize().background(PageBg),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(18.dp)
        ) {
            Box(Modifier.size(64.dp), contentAlignment = Alignment.Center) {
                Canvas(Modifier.size(64.dp)) {
                    drawArc(
                        brush      = Brush.sweepGradient(
                            listOf(PlugGreen.copy(alpha = 0f), PlugGreen)
                        ),
                        startAngle = rotation,
                        sweepAngle = 260f,
                        useCenter  = false,
                        style      = Stroke(5.dp.toPx(), cap = StrokeCap.Round)
                    )
                }
                Box(
                    Modifier.size(10.dp).clip(CircleShape).background(PlugGreen)
                )
            }
            Text(
                "Checking connection…",
                fontSize   = 15.sp,
                color      = TextGray,
                fontWeight = FontWeight.Medium
            )
            Row(horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                listOf(d1, d2, d3).forEach { alpha ->
                    Box(
                        Modifier.size(6.dp).clip(CircleShape)
                            .background(PlugGreen.copy(alpha = alpha))
                    )
                }
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────
//  NO INTERNET SCREEN
//  Light background — dog's white bg blends in perfectly.
//  Layout inspired by Amazon: dog top, text below, button at bottom.
// ─────────────────────────────────────────────────────────────
@Composable
fun NoInternetScreen(onRetry: () -> Unit) {

    // Gentle bounce on the dog — makes it feel alive
    val inf = rememberInfiniteTransition(label = "dogBounce")
    val offsetY by inf.animateFloat(
        initialValue  = 0f,
        targetValue   = -10f,
        animationSpec = infiniteRepeatable(
            tween(1800, easing = FastOutSlowInEasing),
            RepeatMode.Reverse
        ),
        label = "bounce"
    )

    Box(
        Modifier
            .fillMaxSize()
            .background(PageBg)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 28.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {

            Spacer(Modifier.weight(0.6f))

            // ── DOG ILLUSTRATION ───────────────────────────
            // Offset Y creates the gentle floating/bounce effect
            Image(
                painter            = painterResource(id = R.drawable.no_internet_dog),
                contentDescription = "No internet connection",
                modifier           = Modifier
                    .size(260.dp)                     // prominent but not overflowing
                    .offset(y = offsetY.dp),
                contentScale       = ContentScale.Fit
            )

            Spacer(Modifier.height(8.dp))

            // ── HEADLINE ──────────────────────────────────
            Text(
                text          = "OOPS!",
                fontSize      = 12.sp,
                fontWeight    = FontWeight.ExtraBold,
                color         = TextGray,
                letterSpacing = 3.sp
            )

            Spacer(Modifier.height(4.dp))

            Text(
                text       = "No Internet",
                fontSize   = 30.sp,
                fontWeight = FontWeight.ExtraBold,
                color      = TextDark,
                textAlign  = TextAlign.Center
            )

            Spacer(Modifier.height(10.dp))

            // ── DESCRIPTION ───────────────────────────────
            Text(
                text       = "Please check your network connection.",
                fontSize   = 15.sp,
                color      = TextGray,
                textAlign  = TextAlign.Center,
                lineHeight = 22.sp
            )

            Spacer(Modifier.weight(0.5f))

            // ── TRY AGAIN BUTTON (Amazon-style flat gray) ─
            Button(
                onClick   = onRetry,
                modifier  = Modifier
                    .fillMaxWidth()
                    .height(50.dp),
                shape     = RoundedCornerShape(8.dp),
                colors    = ButtonDefaults.buttonColors(
                    containerColor = ButtonBg,
                    contentColor   = ButtonText
                ),
                elevation = ButtonDefaults.buttonElevation(0.dp)
            ) {
                Text(
                    text          = "TRY AGAIN",
                    fontSize      = 14.sp,
                    fontWeight    = FontWeight.Bold,
                    letterSpacing = 1.5.sp
                )
            }

            Spacer(Modifier.height(12.dp))

            // ── DIVIDER ROW ───────────────────────────────
            Row(
                Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                HorizontalDivider(modifier = Modifier.weight(1f), color = DividerGray)
                Text(
                    "  or  ",
                    fontSize = 12.sp,
                    color    = TextLight
                )
                HorizontalDivider(modifier = Modifier.weight(1f), color = DividerGray)
            }

            Spacer(Modifier.height(12.dp))

            // ── OFFLINE TIP ───────────────────────────────
            Surface(
                Modifier.fillMaxWidth(),
                shape          = RoundedCornerShape(10.dp),
                color          = PlugGreenBg,
                tonalElevation = 0.dp
            ) {
                Row(
                    Modifier.padding(horizontal = 14.dp, vertical = 11.dp),
                    verticalAlignment     = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Box(
                        Modifier.size(7.dp).clip(CircleShape).background(PlugGreen)
                    )
                    Text(
                        "You can still view your last session summary offline.",
                        fontSize   = 12.sp,
                        color      = PlugGreenText,
                        lineHeight = 18.sp
                    )
                }
            }

            Spacer(Modifier.weight(0.4f))

            // ── BOTTOM BRAND LABEL ────────────────────────
            Text(
                "PlugBox",
                fontSize = 11.sp,
                color    = TextLight
            )

            Spacer(Modifier.height(20.dp))
        }
    }
}