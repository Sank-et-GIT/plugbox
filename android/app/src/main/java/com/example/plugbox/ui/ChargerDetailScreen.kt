@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package com.example.plugbox.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.material3.HorizontalDivider
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/* -------------------------------------------------------
   PlugBox Charger Detail Screen (UI-only, pixel-focused)
   Reference: https://www.genspark.ai/api/files/s/otUmnNFa
-------------------------------------------------------- */

data class UiPackageOption(
    val id: String,
    val name: String,
    val kwhText: String,   // "0.5 kWh"
    val priceText: String, // "₹20"
    val badgeText: String? = null // "Best value"
)

@Composable
fun ChargerDetailScreen(
    // Keep your existing state/params; map them here.
    title: String,
    statusText: String, // "IDLE"
    distanceText: String, // "0.8 km"
    timeText: String,     // "4 min"
    powerText: String,    // "1.5 kW"
    socketsTitle: String, // "Sockets"
    socketsValue: String, // "2/4"
    packages: List<UiPackageOption>,
    selectedPackageId: String,
    depositAmountText: String, // "₹100"
    depositNoteText: String,   // "(refundable)"
    depositCaptionText: String, // "Shown in wallet as Locked Deposit"
    tabSelected: TabSelection, // ChargeNow / BookSlot
    onBackClick: () -> Unit,
    onSelectPackage: (String) -> Unit,
    onSelectTab: (TabSelection) -> Unit,
    onNavigateClick: () -> Unit,
    onProceedToPayClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    // ===== Colors tuned to match reference =====
    val bg = Color(0xFFF9FAFB)
    val divider = Color(0xFFE5E7EB)
    val textPrimary = Color(0xFF111827)
    val textSecondary = Color(0xFF6B7280)

    val green = Color(0xFF16C784)
    val greenDark = Color(0xFF12B76A)
    val greenTint = Color(0xFFECFDF5)

    val blue = Color(0xFF3B82F6)
    val idlePillBg = Color(0xFFE0F2FE)
    val idleDot = Color(0xFF3B82F6)

    val depositBg = Color(0xFFF3F4F6)

    val cardRadius = 16.dp
    val buttonRadius = 16.dp

    Scaffold(
        modifier = modifier.fillMaxSize(),
        containerColor = bg,
        topBar = {
            TopAppBar(
                title = { /* Title is in content in the reference */ },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Outlined.ArrowBack,
                            contentDescription = "Back",
                            tint = textPrimary
                        )
                    }
                },
                actions = {
                    IdleStatusPill(
                        text = statusText,
                        background = idlePillBg,
                        dotColor = idleDot,
                        textColor = idleDot
                    )
                    Spacer(Modifier.width(16.dp))
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = bg
                )
            )
        },
        bottomBar = {
            BottomStickyButtons(
                onNavigateClick = onNavigateClick,
                onProceedToPayClick = onProceedToPayClick,
                blue = blue,
                green = green,
                greenDark = greenDark,
                radius = buttonRadius
            )
        }
    ) { padding ->
        Column(
            Modifier
                .padding(padding)
                .fillMaxWidth()
        ) {
            // Title
            Text(
                text = title,
                modifier = Modifier
                    .padding(horizontal = 16.dp)
                    .padding(top = 16.dp),
                fontSize = 22.sp,
                fontWeight = FontWeight.SemiBold,
                color = textPrimary,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
            )

            Spacer(Modifier.height(16.dp))
            HorizontalDivider(Modifier, thickness = 1.dp, color = divider)

            // Info row (4 columns)
            InfoRow4(
                distanceText = distanceText,
                timeText = timeText,
                powerText = powerText,
                socketsTitle = socketsTitle,
                socketsValue = socketsValue,
                divider = divider,
                textPrimary = textPrimary
            )

            HorizontalDivider(Modifier, thickness = 1.dp, color = divider)

            // Packages section title
            Text(
                text = "Packages",
                modifier = Modifier
                    .padding(horizontal = 16.dp)
                    .padding(top = 16.dp),
                fontSize = 18.sp,
                fontWeight = FontWeight.SemiBold,
                color = textPrimary
            )

            Spacer(Modifier.height(16.dp))

            // Package cards row
            Row(
                modifier = Modifier
                    .padding(horizontal = 16.dp)
                    .fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                packages.forEach { pkg ->
                    val selected = pkg.id == selectedPackageId
                    PackageCard(
                        modifier = Modifier.weight(1f),
                        pkg = pkg,
                        selected = selected,
                        onClick = { onSelectPackage(pkg.id) },
                        borderColor = if (selected) green else divider,
                        borderWidth = if (selected) 2.dp else 1.dp,
                        background = if (selected) greenTint else Color.White,
                        green = green,
                        textPrimary = textPrimary,
                        textSecondary = textSecondary,
                        radius = cardRadius
                    )
                }
            }

            Spacer(Modifier.height(16.dp))

            // Security deposit card
            SecurityDepositCard(
                depositAmountText = depositAmountText,
                depositNoteText = depositNoteText,
                depositCaptionText = depositCaptionText,
                background = depositBg,
                divider = divider,
                textPrimary = textPrimary,
                textSecondary = textSecondary,
                radius = cardRadius
            )

            Spacer(Modifier.height(16.dp))

            // Toggle tabs
            ToggleTabsRow(
                selected = tabSelected,
                onSelect = onSelectTab,
                green = green,
                textSecondary = textSecondary,
                divider = divider
            )

            Spacer(Modifier.height(90.dp)) // space above bottom buttons (safe)
        }
    }
}

/* ---------------- Top-right Status Pill ---------------- */

@Composable
private fun IdleStatusPill(
    text: String,
    background: Color,
    dotColor: Color,
    textColor: Color
) {
    Surface(
        color = background,
        shape = RoundedCornerShape(999.dp),
        tonalElevation = 0.dp,
        shadowElevation = 0.dp
    ) {
        Row(
            modifier = Modifier
                .height(32.dp)
                .padding(horizontal = 12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(8.dp)
                    .clip(RoundedCornerShape(999.dp))
                    .background(dotColor)
            )
            Spacer(Modifier.width(8.dp))
            Text(
                text = text,
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                color = textColor,
                letterSpacing = 0.4.sp
            )
        }
    }
}

/* ---------------- Info Row (4 columns) ---------------- */

@Composable
private fun InfoRow4(
    distanceText: String,
    timeText: String,
    powerText: String,
    socketsTitle: String,
    socketsValue: String,
    divider: Color,
    textPrimary: Color
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp)
            .heightIn(min = 64.dp)
            .padding(vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        InfoMetricItem(
            modifier = Modifier.weight(1f),
            icon = Icons.Outlined.Place,
            line1 = distanceText,
            line2 = null,
            textPrimary = textPrimary
        )

        VerticalDivider(divider)

        InfoMetricItem(
            modifier = Modifier.weight(1f),
            icon = Icons.Outlined.Schedule,
            line1 = timeText,
            line2 = null,
            textPrimary = textPrimary
        )

        VerticalDivider(divider)

        InfoMetricItem(
            modifier = Modifier.weight(1f),
            icon = Icons.Outlined.Bolt,
            line1 = powerText,
            line2 = null,
            textPrimary = textPrimary
        )

        VerticalDivider(divider)

        InfoMetricItem(
            modifier = Modifier.weight(1f),
            icon = Icons.Outlined.ElectricalServices,
            line1 = socketsTitle,
            line2 = socketsValue,
            textPrimary = textPrimary
        )
    }
}

@Composable
private fun VerticalDivider(color: Color) {
    Box(
        modifier = Modifier
            .width(1.dp)
            .fillMaxHeight()
            .background(color)
    )
}

@Composable
private fun InfoMetricItem(
    modifier: Modifier,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    line1: String,
    line2: String?,
    textPrimary: Color
) {
    Column(
        modifier = modifier,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = textPrimary,
            modifier = Modifier.size(20.dp)
        )
        Spacer(Modifier.height(4.dp))
        Text(
            text = line1,
            fontSize = 14.sp,
            color = textPrimary,
            textAlign = TextAlign.Center,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )
        if (line2 != null) {
            Spacer(Modifier.height(4.dp))
            Text(
                text = line2,
                fontSize = 14.sp,
                color = textPrimary,
                textAlign = TextAlign.Center,
                maxLines = 1
            )
        }
    }
}

/* ---------------- Packages Cards ---------------- */

@Composable
private fun PackageCard(
    modifier: Modifier,
    pkg: UiPackageOption,
    selected: Boolean,
    onClick: () -> Unit,
    borderColor: Color,
    borderWidth: Dp,
    background: Color,
    green: Color,
    textPrimary: Color,
    textSecondary: Color,
    radius: Dp
) {
    Surface(
        modifier = modifier
            .heightIn(min = 142.dp)
            .clickable(onClick = onClick),
        color = background,
        shape = RoundedCornerShape(radius),
        shadowElevation = 6.dp,
        border = BorderStroke(borderWidth, borderColor)
    ) {
        Box(Modifier.fillMaxSize()) {
            // Badge (top-right) for selected "Best value"
            if (pkg.badgeText != null && selected) {
                Surface(
                    color = green,
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(top = 10.dp, end = 10.dp)
                ) {
                    Text(
                        text = pkg.badgeText,
                        color = Color.White,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                    )
                }
            }

            Column(
                modifier = Modifier
                    .padding(16.dp)
                    .fillMaxWidth()
            ) {
                // Custom radio indicator
                PackageRadio(selected = selected, green = green)

                Spacer(Modifier.height(12.dp))

                Text(
                    text = pkg.name,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = textPrimary
                )

                Spacer(Modifier.height(6.dp))

                Text(
                    text = pkg.kwhText,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Medium,
                    color = textSecondary
                )

                Spacer(Modifier.height(10.dp))

                Text(
                    text = pkg.priceText,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    color = textPrimary
                )
            }
        }
    }
}

@Composable
private fun PackageRadio(selected: Boolean, green: Color) {
    val border = if (selected) green else Color(0xFFD1D5DB)
    Box(
        modifier = Modifier
            .size(22.dp)
            .clip(RoundedCornerShape(999.dp))
            .border(2.dp, border, RoundedCornerShape(999.dp)),
        contentAlignment = Alignment.Center
    ) {
        if (selected) {
            Box(
                modifier = Modifier
                    .size(10.dp)
                    .clip(RoundedCornerShape(999.dp))
                    .background(green)
            )
        }
    }
}

/* ---------------- Security Deposit Card ---------------- */

@Composable
private fun SecurityDepositCard(
    depositAmountText: String,
    depositNoteText: String,
    depositCaptionText: String,
    background: Color,
    divider: Color,
    textPrimary: Color,
    textSecondary: Color,
    radius: Dp
) {
    Surface(
        modifier = Modifier
            .padding(horizontal = 16.dp)
            .fillMaxWidth(),
        color = background,
        shape = RoundedCornerShape(radius),
        shadowElevation = 6.dp,
        border = BorderStroke(1.dp, divider)
    ) {
        Column(Modifier.padding(16.dp)) {
            Text(
                text = "Security deposit",
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                color = textPrimary
            )

            Spacer(Modifier.height(12.dp))

            Row(verticalAlignment = Alignment.Bottom) {
                Text(
                    text = depositAmountText,
                    fontSize = 30.sp,
                    fontWeight = FontWeight.Bold,
                    color = textPrimary
                )
                Spacer(Modifier.width(8.dp))
                Text(
                    text = depositNoteText,
                    fontSize = 14.sp,
                    color = textSecondary
                )
            }

            Spacer(Modifier.height(12.dp))
            HorizontalDivider(Modifier, thickness = 1.dp, color = divider)
            Spacer(Modifier.height(12.dp))

            Text(
                text = depositCaptionText,
                fontSize = 13.sp,
                color = textSecondary
            )
        }
    }
}

/* ---------------- Toggle Tabs ---------------- */

enum class TabSelection { ChargeNow, BookSlot }

@Composable
private fun ToggleTabsRow(
    selected: TabSelection,
    onSelect: (TabSelection) -> Unit,
    green: Color,
    textSecondary: Color,
    divider: Color
) {
    Column(Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier
                .padding(horizontal = 16.dp)
                .fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            TabText(
                text = "Charge now",
                selected = selected == TabSelection.ChargeNow,
                onClick = { onSelect(TabSelection.ChargeNow) },
                selectedColor = green,
                unselectedColor = textSecondary,
                modifier = Modifier.weight(1f)
            )
            TabText(
                text = "Book slot",
                selected = selected == TabSelection.BookSlot,
                onClick = { onSelect(TabSelection.BookSlot) },
                selectedColor = green,
                unselectedColor = textSecondary,
                modifier = Modifier.weight(1f)
            )
        }

        // Indicator line (2dp) under selected tab; matches reference
        Box(
            modifier = Modifier
                .padding(horizontal = 16.dp)
                .fillMaxWidth()
                .height(2.dp)
        ) {
            Box(
                modifier = Modifier
                    .fillMaxHeight()
                    .fillMaxWidth(0.5f)
                    .align(if (selected == TabSelection.ChargeNow) Alignment.CenterStart else Alignment.CenterEnd)
                    .background(green)
            )
        }

        HorizontalDivider(Modifier, thickness = 1.dp, color = divider)
    }
}

@Composable
private fun TabText(
    text: String,
    selected: Boolean,
    onClick: () -> Unit,
    selectedColor: Color,
    unselectedColor: Color,
    modifier: Modifier
) {
    Text(
        text = text,
        modifier = modifier
            .padding(vertical = 12.dp)
            .clickable(onClick = onClick),
        textAlign = TextAlign.Center,
        fontSize = 15.sp,
        fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Medium,
        color = if (selected) selectedColor else unselectedColor
    )
}

/* ---------------- Bottom Sticky Buttons ---------------- */

@Composable
private fun BottomStickyButtons(
    onNavigateClick: () -> Unit,
    onProceedToPayClick: () -> Unit,
    blue: Color,
    green: Color,
    greenDark: Color,
    radius: Dp
) {
    Surface(
        color = Color(0xFFF9FAFB),
        shadowElevation = 8.dp
    ) {
        Row(
            modifier = Modifier
                .navigationBarsPadding()
                .padding(horizontal = 16.dp)
                .padding(top = 12.dp, bottom = 16.dp)
                .fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            GradientButton(
                text = "Navigate",
                brush = Brush.linearGradient(listOf(blue, blue)),
                onClick = onNavigateClick,
                modifier = Modifier
                    .weight(1f)
                    .height(56.dp),
                radius = radius
            )

            GradientButton(
                text = "Proceed to pay",
                brush = Brush.linearGradient(listOf(green, greenDark)),
                onClick = onProceedToPayClick,
                modifier = Modifier
                    .weight(1.6f)
                    .height(56.dp),
                radius = radius
            )
        }
    }
}

@Composable
private fun GradientButton(
    text: String,
    brush: Brush,
    onClick: () -> Unit,
    modifier: Modifier,
    radius: Dp
) {
    // Material3 button semantics + gradient background.
    Button(
        onClick = onClick,
        modifier = modifier,
        shape = RoundedCornerShape(radius),
        elevation = ButtonDefaults.buttonElevation(defaultElevation = 8.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = Color.Transparent,
            contentColor = Color.White
        ),
        contentPadding = PaddingValues(0.dp)
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .clip(RoundedCornerShape(radius))
                .background(brush),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = text,
                fontSize = 16.sp,
                fontWeight = FontWeight.SemiBold,
                color = Color.White
            )
        }
    }
}
