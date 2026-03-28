// ─────────────────────────────────────────────────────────────────────────────
// OnboardingScreen.kt
//
// FIXES APPLIED:
//   • Local Nagpur-specific copy — feels real, not generic
//   • Subtle accent background tint per slide — personality not just gray
//   • Emotional headlines — sell a feeling, not a feature list
// ─────────────────────────────────────────────────────────────────────────────

package com.example.plugbox.ui

import androidx.compose.animation.core.*
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch

private val ObGreen    = Color(0xFF16C784)
private val ObGreenBg  = Color(0xFFECFDF5)
private val ObBlue     = Color(0xFF3B82F6)
private val ObBlueBg   = Color(0xFFEFF6FF)
private val ObOrange   = Color(0xFFF59E0B)
private val ObOrangeBg = Color(0xFFFFF7ED)
private val ObWhite    = Color(0xFFFFFFFF)
private val ObTextMain = Color(0xFF111827)
private val ObTextSub  = Color(0xFF6B7280)

// ─────────────────────────────────────────────────────────────────────────────
// Slide data — local, emotional, Nagpur-specific copy
// ─────────────────────────────────────────────────────────────────────────────

private data class ObSlide(
    val icon:       ImageVector,
    val iconBg:     Color,
    val iconTint:   Color,
    val screenBg:   Brush,       // subtle accent background per slide
    val accent:     Color,
    val title:      String,
    val subtitle:   String,
    val highlights: List<String>
)

private val slides = listOf(
    ObSlide(
        icon       = Icons.Outlined.EvStation,
        iconBg     = ObGreenBg,
        iconTint   = ObGreen,
        // Very subtle green wash — barely visible, just enough warmth
        screenBg   = Brush.verticalGradient(
            listOf(Color(0xFFECFDF5).copy(alpha = 0.6f), Color(0xFFF9FAFB))),
        accent     = ObGreen,
        title      = "Nagpur's EV charging network",
        subtitle   = "From Nandanvan to Civil Lines — PlugBox chargers are placed where you already go.",
        highlights = listOf(
            "Live availability — see open chargers now",
            "Distance & ETA to every charger",
            "Never hunt for a plug again"
        )
    ),
    ObSlide(
        icon       = Icons.Outlined.Bolt,
        iconBg     = ObBlueBg,
        iconTint   = ObBlue,
        screenBg   = Brush.verticalGradient(
            listOf(Color(0xFFEFF6FF).copy(alpha = 0.6f), Color(0xFFF9FAFB))),
        accent     = ObBlue,
        title      = "Charge while you shop",
        subtitle   = "Book a slot, head to the market. Your charger waits — no queues, no waiting.",
        highlights = listOf(
            "₹20 quick top-up to ₹55 full charge",
            "10 min grace to reach the charger",
            "Pay only for what you actually use"
        )
    ),
    ObSlide(
        icon       = Icons.Outlined.Insights,
        iconBg     = ObOrangeBg,
        iconTint   = ObOrange,
        screenBg   = Brush.verticalGradient(
            listOf(Color(0xFFFFF7ED).copy(alpha = 0.5f), Color(0xFFF9FAFB))),
        accent     = ObGreen,  // final slide → green = ready
        title      = "Every rupee. Every kWh.",
        subtitle   = "Know exactly what you paid and what you saved — every single time you charge.",
        highlights = listOf(
            "Live meter during every session",
            "Full history with itemised receipts",
            "CO₂ saved tracked per charge"
        )
    )
)

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun OnboardingScreen(
    onFinished: () -> Unit,
    modifier:   Modifier = Modifier
) {
    val context      = LocalContext.current
    val pagerState   = rememberPagerState(pageCount = { slides.size })
    val scope        = rememberCoroutineScope()
    val currentSlide = slides[pagerState.currentPage]
    val isLastSlide  = pagerState.currentPage == slides.lastIndex

    fun markDone() {
        context.getSharedPreferences("plugbox_prefs", android.content.Context.MODE_PRIVATE)
            .edit().putBoolean("onboarding_done", true).apply()
        onFinished()
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(currentSlide.screenBg)  // accent bg changes per slide
    ) {
        Column(Modifier.fillMaxSize()) {

            // Skip button
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .statusBarsPadding()
                    .padding(horizontal = 16.dp, vertical = 12.dp),
                horizontalArrangement = Arrangement.End
            ) {
                if (!isLastSlide) {
                    TextButton(onClick = { markDone() }) {
                        Text("Skip", fontSize = 14.sp, color = ObTextSub)
                    }
                }
            }

            // Pager
            HorizontalPager(
                state    = pagerState,
                modifier = Modifier.weight(1f)
            ) { page ->
                ObSlidePage(slide = slides[page])
            }

            // Bottom: dots + button
            Column(
                modifier            = Modifier
                    .fillMaxWidth()
                    .navigationBarsPadding()
                    .padding(horizontal = 24.dp, vertical = 24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(24.dp)
            ) {
                // Animated progress dots
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    slides.forEachIndexed { index, slide ->
                        val isSelected = index == pagerState.currentPage
                        val width by animateDpAsState(
                            targetValue   = if (isSelected) 24.dp else 8.dp,
                            animationSpec = tween(300),
                            label         = "dotWidth"
                        )
                        Box(
                            modifier = Modifier
                                .height(8.dp)
                                .width(width)
                                .clip(CircleShape)
                                .background(
                                    if (isSelected) currentSlide.accent
                                    else ObTextSub.copy(alpha = 0.25f)
                                )
                        )
                    }
                }

                Button(
                    onClick = {
                        if (isLastSlide) markDone()
                        else scope.launch {
                            pagerState.animateScrollToPage(pagerState.currentPage + 1)
                        }
                    },
                    modifier  = Modifier.fillMaxWidth().height(56.dp),
                    shape     = RoundedCornerShape(16.dp),
                    colors    = ButtonDefaults.buttonColors(
                        containerColor = currentSlide.accent,
                        contentColor   = ObWhite
                    ),
                    elevation = ButtonDefaults.buttonElevation(defaultElevation = 4.dp)
                ) {
                    Text(
                        if (isLastSlide) "Get Started" else "Next",
                        fontWeight = FontWeight.Bold, fontSize = 16.sp
                    )
                    if (isLastSlide) {
                        Spacer(Modifier.width(8.dp))
                        Icon(Icons.Outlined.ArrowForward, null,
                            modifier = Modifier.size(18.dp))
                    }
                }
            }
        }
    }
}

@Composable
private fun ObSlidePage(slide: ObSlide) {
    var visible by remember { mutableStateOf(false) }
    val iconScale by animateFloatAsState(
        targetValue   = if (visible) 1f else 0f,
        animationSpec = spring(Spring.DampingRatioMediumBouncy, Spring.StiffnessMediumLow),
        label         = "iconScale"
    )
    LaunchedEffect(slide) {
        visible = false
        kotlinx.coroutines.delay(50L)
        visible = true
    }

    Column(
        modifier            = Modifier
            .fillMaxSize()
            .padding(horizontal = 24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Box(
            modifier = Modifier
                .size(130.dp)
                .scale(iconScale)
                .clip(CircleShape)
                .background(slide.iconBg),
            contentAlignment = Alignment.Center
        ) {
            Icon(slide.icon, null, tint = slide.iconTint,
                modifier = Modifier.size(64.dp))
        }

        Spacer(Modifier.height(36.dp))

        Text(slide.title, fontSize = 26.sp, fontWeight = FontWeight.Bold,
            color = ObTextMain, textAlign = TextAlign.Center, lineHeight = 34.sp)

        Spacer(Modifier.height(14.dp))

        Text(slide.subtitle, fontSize = 15.sp, color = ObTextSub,
            textAlign = TextAlign.Center, lineHeight = 24.sp)

        Spacer(Modifier.height(28.dp))

        Column(
            modifier            = Modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            slide.highlights.forEach { point ->
                Row(
                    verticalAlignment     = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Box(
                        modifier = Modifier.size(22.dp).clip(CircleShape)
                            .background(slide.iconBg),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(Icons.Outlined.Check, null,
                            tint     = slide.iconTint,
                            modifier = Modifier.size(13.dp))
                    }
                    Text(point, fontSize = 14.sp,
                        color = ObTextMain, fontWeight = FontWeight.Medium)
                }
            }
        }
    }
}