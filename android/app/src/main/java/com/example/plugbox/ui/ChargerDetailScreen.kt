// ─────────────────────────────────────────────────────────────────────────────
// ChargerDetailScreen.kt
//
// PURPOSE:
//   Shows full details of a selected charger — info row, package selection,
//   wallet status, payment breakdown, and action buttons.
//
// CHANGES FROM PREVIOUS VERSION:
//   • Security deposit card REMOVED — deposit is one-time at account opening,
//     shown on Wallet screen instead. Not relevant at booking time.
//   • Package cards: fixed height removed → content never clips
//   • ₹/kWh rate replaced with short descriptions per package
//   • "--km / --min" replaced with "Locating..." italic hint
//   • Badge: green when selected, gray/muted when unselected
//   • Wallet totalCost now only includes package price (no deposit)
//   • Payment breakdown bottom spacer increased → never cuts off
//
// NAVIGATION:
//   Entered from : HomeScreen (Book Now tap)
//   Exits to     : HomeScreen (back), BookingConfirmedScreen (Proceed to pay)
//
// DATA:
//   Phase 1 → UiCharger with hardcoded packages from UiAdapter, wallet ₹245 dummy
//   Phase 2 → packages from API, wallet balance from user profile API
//
// ANIMATIONS:
//   • Package card    → scale bounce on tap
//   • Proceed to pay  → continuous subtle pulse
//   • IDLE dot        → blinks green
//
// BACK:  Back arrow / swipe-from-left / hardware back → onBack()
// ─────────────────────────────────────────────────────────────────────────────

package com.example.plugbox.ui

import android.content.Intent
import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.compose.animation.core.*
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
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
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlin.math.roundToInt

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1 — Color palette
// ─────────────────────────────────────────────────────────────────────────────

private val CdBg            = Color(0xFFF9FAFB)
private val CdWhite         = Color(0xFFFFFFFF)
private val CdGreen         = Color(0xFF16C784)
private val CdGreenDark     = Color(0xFF12B76A)
private val CdGreenTint     = Color(0xFFECFDF5)
private val CdBlue          = Color(0xFF3B82F6)
private val CdOrange        = Color(0xFFF59E0B)
private val CdOrangeTint    = Color(0xFFFFF7ED)
private val CdTextPrimary   = Color(0xFF111827)
private val CdTextSecondary = Color(0xFF6B7280)
private val CdDivider       = Color(0xFFE5E7EB)
private val CdIdleBg        = Color(0xFFDCFCE7)
private val CdInUseBg       = Color(0xFFFFF7ED)
private val CdOfflineBg     = Color(0xFFF3F4F6)

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3 — Main screen composable
// ─────────────────────────────────────────────────────────────────────────────

@Composable
fun ChargerDetailScreen(
    charger:        UiCharger,
    onBack:         () -> Unit,
    onNavigate:     () -> Unit,
    onProceedToPay: (UiPackage) -> Unit,
    modifier:       Modifier = Modifier
) {
    val context = LocalContext.current

    // Auto-select "Best value" package on open
    var selectedPkgId by remember(charger.id) {
        mutableStateOf(
            charger.packages.firstOrNull { it.badge != null }?.id
                ?: charger.packages.firstOrNull()?.id
                ?: ""
        )
    }

    val selectedPkg = charger.packages.firstOrNull { it.id == selectedPkgId }

    // Wallet: Phase 1 dummy, Phase 2 replace with real API value
    // Deposit NOT included in cost shown here — it's charged once at account opening
    val walletBalance = 245
    val totalCost     = selectedPkg?.priceInr ?: 0
    val hasSufficient = walletBalance >= totalCost

    BackHandler { onBack() }

    Scaffold(
        modifier       = modifier.fillMaxSize(),
        containerColor = CdBg,

        // Compact top bar — no wasted space
        topBar = {
            Row(
                modifier              = Modifier
                    .fillMaxWidth()
                    .statusBarsPadding()
                    .padding(horizontal = 8.dp, vertical = 8.dp),
                verticalAlignment     = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                IconButton(onClick = onBack) {
                    Icon(Icons.AutoMirrored.Outlined.ArrowBack, "Go back", tint = CdTextPrimary)
                }
                CdStatusPill(status = charger.status)
            }
        },

        bottomBar = {
            CdBottomButtons(
                selectedPackage     = selectedPkg,
                onNavigateClick     = {
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
                    onNavigate()
                },
                onProceedToPayClick = { pkg -> onProceedToPay(pkg) }
            )
        }

    ) { scaffoldPadding ->

        Column(
            modifier = Modifier
                .padding(scaffoldPadding)
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
        ) {

            // Charger name — top = 0 because topBar Row already has vertical padding
            Text(
                text       = charger.name,
                modifier   = Modifier.padding(horizontal = 16.dp).padding(top = 0.dp),
                fontSize   = 22.sp,
                fontWeight = FontWeight.Bold,
                color      = CdTextPrimary,
                maxLines   = 2,
                overflow   = TextOverflow.Ellipsis
            )

            Spacer(Modifier.height(16.dp))
            HorizontalDivider(color = CdDivider)

            // Info row
            CdInfoRow(charger = charger)

            HorizontalDivider(color = CdDivider)
            Spacer(Modifier.height(16.dp))

            // Packages heading
            Text(
                text       = "Packages",
                modifier   = Modifier.padding(horizontal = 16.dp),
                fontSize   = 18.sp,
                fontWeight = FontWeight.SemiBold,
                color      = CdTextPrimary
            )

            Spacer(Modifier.height(14.dp))

            // Package cards — wrapContentHeight so price is NEVER clipped
            Row(
                modifier              = Modifier.padding(horizontal = 16.dp).fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                charger.packages.forEach { pkg ->
                    CdPackageCard(
                        modifier   = Modifier.weight(1f),
                        pkg        = pkg,
                        isSelected = pkg.id == selectedPkgId,
                        onClick    = { selectedPkgId = pkg.id }
                    )
                }
            }

            Spacer(Modifier.height(16.dp))

            // ── Merged summary card (just above pay button) ───────────────
            // Package total + wallet status in one card — user sees everything
            // in one glance before tapping Proceed to pay
            if (selectedPkg != null) {
                CdSummaryCard(
                    pkg           = selectedPkg,
                    walletBalance = walletBalance,
                    hasSufficient = hasSufficient
                )
            }

            // Space so card clears the sticky bottom bar
            Spacer(Modifier.height(100.dp))
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4 — Status pill (IDLE dot blinks, others static)
// ─────────────────────────────────────────────────────────────────────────────

@Composable
private fun CdStatusPill(status: ChargerStatus) {
    val (bg, dotColor, label) = when (status) {
        ChargerStatus.IDLE     -> Triple(CdIdleBg,    CdGreen,          "Available Now")
        ChargerStatus.IN_USE   -> Triple(CdInUseBg,   CdOrange,         "IN USE")
        ChargerStatus.RESERVED -> Triple(CdInUseBg,   CdBlue,           "RESERVED")
        ChargerStatus.OFFLINE  -> Triple(CdOfflineBg, CdTextSecondary,  "OFFLINE")
    }

    Surface(color = bg, shape = RoundedCornerShape(999.dp),
        tonalElevation = 0.dp, shadowElevation = 0.dp) {
        Row(Modifier.height(32.dp).padding(horizontal = 12.dp),
            verticalAlignment = Alignment.CenterVertically) {

            if (status == ChargerStatus.IDLE) {
                val inf   = rememberInfiniteTransition(label = "idleBlink")
                val alpha by inf.animateFloat(
                    0.2f, 1.0f,
                    infiniteRepeatable(tween(600, easing = FastOutSlowInEasing), RepeatMode.Reverse),
                    "dotAlpha"
                )
                Box(Modifier.size(8.dp).clip(RoundedCornerShape(999.dp))
                    .background(dotColor.copy(alpha = alpha)))
            } else {
                Box(Modifier.size(8.dp).clip(RoundedCornerShape(999.dp)).background(dotColor))
            }

            Spacer(Modifier.width(6.dp))
            Text(label, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = dotColor)
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5 — Info row (Distance | ETA | Power | Sockets)
//
// "Locating..." shown in italic when GPS hasn't loaded yet (distanceKm = 0)
// ─────────────────────────────────────────────────────────────────────────────

@Composable
private fun CdInfoRow(charger: UiCharger) {
    val locating = charger.distanceKm <= 0.0

    val distanceLabel = when {
        locating                 -> "Locating..."
        charger.distanceKm < 1.0 -> "${(charger.distanceKm * 1000).roundToInt()} m"
        else                     -> "${"%.1f".format(charger.distanceKm)} km"
    }
    val etaLabel = when {
        locating           -> "Locating..."
        charger.etaMin > 0 -> "${charger.etaMin} min"
        else -> "${((charger.distanceKm / 25.0) * 60).roundToInt().coerceAtLeast(1)} min"
    }

    Row(
        modifier          = Modifier.fillMaxWidth().padding(horizontal = 16.dp).height(80.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Distance — italic when locating
        CdInfoColumn(
            modifier   = Modifier.weight(1f),
            icon       = Icons.Outlined.Place,
            value      = distanceLabel,
            label      = "Distance",
            isLocating = locating
        )
        CdVerticalDivider()
        // ETA — italic when locating
        CdInfoColumn(
            modifier   = Modifier.weight(1f),
            icon       = Icons.Outlined.Schedule,
            value      = etaLabel,
            label      = "ETA",
            isLocating = locating
        )
        CdVerticalDivider()
        CdInfoColumn(Modifier.weight(1f), Icons.Outlined.Bolt,
            "${charger.powerKw} kW", "Power")
        CdVerticalDivider()
        CdInfoColumn(Modifier.weight(1f), Icons.Outlined.ElectricalServices,
            "${charger.socketsAvailable}/${charger.socketsTotal}", "Sockets")
    }
}

@Composable
private fun CdInfoColumn(
    modifier:   Modifier,
    icon:       ImageVector,
    value:      String,
    label:      String,
    isLocating: Boolean = false
) {
    Column(modifier = modifier, horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center) {
        Icon(icon, null, tint = CdTextSecondary, modifier = Modifier.size(22.dp))
        Spacer(Modifier.height(6.dp))
        Text(
            text       = value,
            fontSize   = 14.sp,
            fontWeight = FontWeight.SemiBold,
            fontStyle  = if (isLocating) FontStyle.Italic else FontStyle.Normal,
            color      = if (isLocating) CdTextSecondary else CdTextPrimary,
            textAlign  = TextAlign.Center,
            maxLines   = 1
        )
        Text(
            text      = label,
            fontSize  = 12.sp,
            color     = CdTextSecondary,
            textAlign = TextAlign.Center
        )
    }
}

@Composable
private fun CdVerticalDivider() {
    Box(Modifier.fillMaxHeight().width(1.dp).background(CdDivider))
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 6 — Package card
//
// KEY CHANGES:
//   • heightIn(min=150.dp) instead of fixed height(160.dp) → price never clips
//   • Short description instead of ₹/kWh
//   • Badge: green bg when SELECTED, muted gray when UNSELECTED
// ─────────────────────────────────────────────────────────────────────────────

@Composable
private fun CdPackageCard(
    modifier:   Modifier,
    pkg:        UiPackage,
    isSelected: Boolean,
    onClick:    () -> Unit
) {
    var pressed by remember { mutableStateOf(false) }
    val scale by animateFloatAsState(
        targetValue   = if (pressed) 0.96f else 1.0f,
        animationSpec = spring(Spring.DampingRatioMediumBouncy, Spring.StiffnessHigh),
        label         = "pkgScale"
    )

    Surface(
        modifier = modifier
            .scale(scale)
            .heightIn(min = 150.dp)   // min height, never fixed — content drives actual height
            .clickable { pressed = true; onClick(); pressed = false },
        color           = if (isSelected) CdGreenTint else CdWhite,
        shape           = RoundedCornerShape(14.dp),
        shadowElevation = if (isSelected) 14.dp else 2.dp,
        border          = BorderStroke(
            if (isSelected) 2.dp else 1.dp,
            if (isSelected) CdGreen else CdDivider
        )
    ) {
        Box(Modifier.fillMaxWidth()) {

            // Badge — always green regardless of selection
            // "Best value" should always stand out — it's factual info, not selection state
            if (pkg.badge != null) {
                Surface(
                    color    = CdGreen,
                    shape    = RoundedCornerShape(8.dp),
                    modifier = Modifier.align(Alignment.TopEnd).padding(top = 8.dp, end = 8.dp)
                ) {
                    Text(
                        text       = pkg.badge,
                        color      = Color.White,
                        fontSize   = 10.sp,
                        fontWeight = FontWeight.SemiBold,
                        modifier   = Modifier.padding(horizontal = 7.dp, vertical = 3.dp)
                    )
                }
            }

            Column(Modifier.padding(14.dp).fillMaxWidth()) {

                // Radio indicator
                CdRadioIndicator(isSelected)

                Spacer(Modifier.height(12.dp))

                // Package name
                Text(pkg.name, fontSize = 15.sp, fontWeight = FontWeight.SemiBold,
                    color = CdTextPrimary)

                Spacer(Modifier.height(4.dp))

                // kWh amount — simple, no rate
                Text("${pkg.kwhLimit} kWh", fontSize = 13.sp, color = CdTextSecondary)

                Spacer(Modifier.height(10.dp))

                // Price — green when selected, dark otherwise
                Text(
                    "₹${pkg.priceInr}",
                    fontSize   = 20.sp,
                    fontWeight = FontWeight.Bold,
                    color      = if (isSelected) CdGreen else CdTextPrimary
                )
            }
        }
    }
}

@Composable
private fun CdRadioIndicator(isSelected: Boolean) {
    Box(
        modifier = Modifier
            .size(22.dp)
            .clip(RoundedCornerShape(999.dp))
            .border(2.dp,
                if (isSelected) CdGreen else Color(0xFFD1D5DB),
                RoundedCornerShape(999.dp)),
        contentAlignment = Alignment.Center
    ) {
        if (isSelected) {
            Box(Modifier.size(10.dp).clip(RoundedCornerShape(999.dp)).background(CdGreen))
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 7 — Summary card (merged payment + wallet)
//
// Sits just above the Proceed to pay button.
// User sees: package, total, wallet status — one card, one decision.
//
// Layout:
//   Package name · kWh          ₹XX
//   ────────────────────────────────
//   Total payable               ₹XX   ← bold green
//   ────────────────────────────────
//   💳 Wallet ₹245    ✓ Ready to pay  ← or orange "Add ₹X"
//
// Phase 1: walletBalance hardcoded
// Phase 2: pass real balance from user profile API
// ─────────────────────────────────────────────────────────────────────────────

@Composable
private fun CdSummaryCard(
    pkg:           UiPackage,
    walletBalance: Int,
    hasSufficient: Boolean
) {
    val total       = pkg.priceInr
    val shortfall   = total - walletBalance
    val accentColor = if (hasSufficient) CdGreen else CdOrange

    Surface(
        modifier        = Modifier.padding(horizontal = 16.dp).fillMaxWidth(),
        color           = CdWhite,
        shape           = RoundedCornerShape(16.dp),
        border          = BorderStroke(1.dp, CdDivider),
        shadowElevation = 3.dp
    ) {
        Column(Modifier.padding(16.dp)) {

            // Package line
            Row(
                Modifier.fillMaxWidth(),
                Arrangement.SpaceBetween,
                Alignment.CenterVertically
            ) {
                Text(
                    text     = "${pkg.name}  ·  ${pkg.kwhLimit} kWh",
                    fontSize = 13.sp,
                    color    = CdTextSecondary
                )
                Text(
                    text       = "₹${pkg.priceInr}",
                    fontSize   = 13.sp,
                    fontWeight = FontWeight.Medium,
                    color      = CdTextPrimary
                )
            }

            HorizontalDivider(Modifier.padding(vertical = 10.dp), color = CdDivider)

            // Total payable — bold, green
            Row(
                Modifier.fillMaxWidth(),
                Arrangement.SpaceBetween,
                Alignment.CenterVertically
            ) {
                Text(
                    text       = "Total payable",
                    fontSize   = 15.sp,
                    fontWeight = FontWeight.Bold,
                    color      = CdTextPrimary
                )
                Text(
                    text       = "₹$total",
                    fontSize   = 15.sp,
                    fontWeight = FontWeight.Bold,
                    color      = CdGreen
                )
            }

            HorizontalDivider(Modifier.padding(vertical = 10.dp), color = CdDivider)

            // Wallet status row
            Row(
                modifier          = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Wallet icon + balance
                Icon(
                    Icons.Outlined.AccountBalanceWallet,
                    contentDescription = null,
                    tint     = CdTextSecondary,
                    modifier = Modifier.size(16.dp)
                )
                Spacer(Modifier.width(6.dp))
                Text(
                    text     = "Wallet  ₹$walletBalance",
                    fontSize = 13.sp,
                    color    = CdTextSecondary
                )

                Spacer(Modifier.weight(1f))

                // Status pill — green or orange
                Surface(
                    color = accentColor.copy(alpha = 0.1f),
                    shape = RoundedCornerShape(999.dp)
                ) {
                    Row(
                        modifier          = Modifier.padding(horizontal = 10.dp, vertical = 5.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Icon(
                            imageVector = if (hasSufficient)
                                Icons.Outlined.CheckCircle
                            else
                                Icons.Outlined.AddCircle,
                            contentDescription = null,
                            tint     = accentColor,
                            modifier = Modifier.size(14.dp)
                        )
                        Text(
                            text       = if (hasSufficient) "Ready to pay" else "Add ₹$shortfall",
                            fontSize   = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                            color      = accentColor
                        )
                    }
                }
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 9 — Sticky bottom buttons
//
// Navigate    → OutlinedButton blue (secondary)
// Proceed pay → Gradient green + pulse (only primary CTA)
// ─────────────────────────────────────────────────────────────────────────────

@Composable
private fun CdBottomButtons(
    selectedPackage:     UiPackage?,
    onNavigateClick:     () -> Unit,
    onProceedToPayClick: (UiPackage) -> Unit
) {
    val canPay = selectedPackage != null

    val inf      = rememberInfiniteTransition(label = "payPulse")
    val payScale by inf.animateFloat(
        1.0f, 1.03f,
        infiniteRepeatable(tween(900, easing = FastOutSlowInEasing), RepeatMode.Reverse),
        "payScale"
    )

    Surface(color = CdBg, shadowElevation = 10.dp) {
        Row(
            modifier = Modifier
                .navigationBarsPadding()
                .padding(horizontal = 16.dp)
                .padding(top = 12.dp, bottom = 16.dp)
                .fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {

            // Navigate — outlined blue
            OutlinedButton(
                onClick  = onNavigateClick,
                modifier = Modifier.weight(1f).height(56.dp),
                shape    = RoundedCornerShape(14.dp),
                border   = BorderStroke(1.5.dp, CdBlue),
                colors   = ButtonDefaults.outlinedButtonColors(contentColor = CdBlue)
            ) {
                Icon(Icons.Outlined.Navigation, null, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(6.dp))
                Text("Navigate", fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
            }

            // Proceed to pay — gradient + pulse
            Box(
                modifier = Modifier
                    .weight(1.6f)
                    .height(56.dp)
                    .scale(if (canPay) payScale else 1f)
            ) {
                Button(
                    onClick        = { selectedPackage?.let { onProceedToPayClick(it) } },
                    enabled        = canPay,
                    modifier       = Modifier.fillMaxSize(),
                    shape          = RoundedCornerShape(14.dp),
                    contentPadding = PaddingValues(0.dp),
                    colors         = ButtonDefaults.buttonColors(
                        containerColor         = Color.Transparent,
                        contentColor           = Color.White,
                        disabledContainerColor = Color(0xFFCBD5E1),
                        disabledContentColor   = Color.White
                    ),
                    elevation = ButtonDefaults.buttonElevation(defaultElevation = 6.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .clip(RoundedCornerShape(14.dp))
                            .background(
                                if (canPay)
                                    Brush.horizontalGradient(listOf(CdGreen, CdGreenDark))
                                else
                                    Brush.horizontalGradient(
                                        listOf(Color(0xFFCBD5E1), Color(0xFFCBD5E1)))
                            ),
                        contentAlignment = Alignment.Center
                    ) {
                        Text("Proceed to pay", fontSize = 15.sp,
                            fontWeight = FontWeight.SemiBold, color = Color.White)
                    }
                }
            }
        }
    }
}