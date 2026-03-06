package com.example.plugbox.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import kotlin.math.roundToInt

/* -----------------------------
   UI MODELS
-------------------------------- */

enum class ChargerStatus { IDLE, IN_USE, RESERVED, OFFLINE }

data class UiPackage(
    val id: String,
    val name: String,
    val kwhLimit: Double,
    val priceInr: Int,
    val badge: String? = null
)

data class UiCharger(
    val id: String,
    val name: String,
    val address: String,
    val distanceKm: Double,
    val etaMin: Int,
    val powerKw: Double,
    val socketsAvailable: Int,
    val socketsTotal: Int,
    val status: ChargerStatus,
    val priceHint: String,  // e.g. "₹40 / 1.0 kWh"
    val depositInr: Int,
    val packages: List<UiPackage>,
    val lat: Double,
    val lng: Double
)

sealed interface UiSessionState {
    val chargerName: String
    val socketLabel: String
    val connected: Boolean

    data class Grace(
        override val chargerName: String,
        override val socketLabel: String,
        override val connected: Boolean,
        val expiryLabel: String, // "06:15"
        val penaltyInr: Int,
        val packageLimitKwh: Double,
        val packageLimitInr: Int
    ) : UiSessionState

    data class CodeGenerated(
        override val chargerName: String,
        override val socketLabel: String,
        override val connected: Boolean,
        val expiryLabel: String,
        val penaltyInr: Int,
        val unlockCode: String,
        val packageLimitKwh: Double,
        val packageLimitInr: Int
    ) : UiSessionState

    data class LidUnlockedWaitingPlug(
        override val chargerName: String,
        override val socketLabel: String,
        override val connected: Boolean,
        val packageLimitKwh: Double,
        val packageLimitInr: Int
    ) : UiSessionState

    data class Charging(
        override val chargerName: String,
        override val socketLabel: String,
        override val connected: Boolean,
        val usedKwh: Double,
        val usedInr: Int,
        val remainingKwh: Double,
        val remainingInr: Int,
        val packageLimitKwh: Double,
        val packageLimitInr: Int,
        val walletDeductedChip: String? = "₹25 deducted from wallet"
    ) : UiSessionState

    data class CloseLidRequired(
        override val chargerName: String,
        override val socketLabel: String,
        override val connected: Boolean,
        val finalUsedKwh: Double,
        val finalChargedInr: Int,
        val refundInr: Int,
        val packageLimitKwh: Double,
        val packageLimitInr: Int
    ) : UiSessionState

    data class Ended(
        override val chargerName: String,
        override val socketLabel: String,
        override val connected: Boolean,
        val totalKwh: Double,
        val chargedInr: Int,
        val refundInr: Int,
        val depositReleased: Boolean,
        val showThankYouPopup: Boolean = true
    ) : UiSessionState
}

/* -----------------------------
   THEME (LIGHT, CLEAN)
-------------------------------- */

private val PlugGreen = Color(0xFF16C784)
private val EnergyBlue = Color(0xFF3B82F6)
private val Bg = Color(0xFFF6F8FB)
private val TextMain = Color(0xFF0B1220)
private val Warning = Color(0xFFF59E0B)
private val ErrorRed = Color(0xFFEF4444)
private val SurfaceCard = Color(0xFFFFFFFF)
private val OutlineSoft = Color(0xFFE6EAF2)

@Composable
fun PlugBoxTheme(content: @Composable () -> Unit) {
    val scheme = lightColorScheme(
        primary = PlugGreen,
        onPrimary = Color.White,
        secondary = EnergyBlue,
        onSecondary = Color.White,
        background = Bg,
        onBackground = TextMain,
        surface = SurfaceCard,
        onSurface = TextMain,
        outline = OutlineSoft,
        error = ErrorRed,
        onError = Color.White
    )

    MaterialTheme(
        colorScheme = scheme,
        typography = Typography(
            titleLarge = MaterialTheme.typography.titleLarge.copy(
                fontWeight = FontWeight.SemiBold,
                color = TextMain
            ),
            titleMedium = MaterialTheme.typography.titleMedium.copy(
                fontWeight = FontWeight.SemiBold,
                color = TextMain
            ),
            bodyLarge = MaterialTheme.typography.bodyLarge.copy(color = TextMain),
            bodyMedium = MaterialTheme.typography.bodyMedium.copy(color = TextMain),
            labelLarge = MaterialTheme.typography.labelLarge.copy(fontWeight = FontWeight.SemiBold)
        ),
        shapes = Shapes(
            extraSmall = RoundedCornerShape(10.dp),
            small = RoundedCornerShape(14.dp),
            medium = RoundedCornerShape(18.dp),
            large = RoundedCornerShape(22.dp)
        ),
        content = content
    )
}

/* -----------------------------
   REUSABLE COMPONENTS
-------------------------------- */

@Composable
fun StatusChip(
    status: ChargerStatus,
    modifier: Modifier = Modifier
) {
    val (bg, fg, label) = when (status) {
        ChargerStatus.IDLE -> Triple(PlugGreen.copy(alpha = 0.12f), PlugGreen, "IDLE")
        ChargerStatus.IN_USE -> Triple(Warning.copy(alpha = 0.14f), Warning, "IN USE")
        ChargerStatus.RESERVED -> Triple(EnergyBlue.copy(alpha = 0.12f), EnergyBlue, "RESERVED")
        ChargerStatus.OFFLINE -> Triple(Color(0xFF64748B).copy(alpha = 0.12f), Color(0xFF64748B), "OFFLINE")
    }

    Surface(
        modifier = modifier,
        color = bg,
        contentColor = fg,
        shape = RoundedCornerShape(999.dp)
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelMedium,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
            fontWeight = FontWeight.SemiBold
        )
    }
}

@Composable
fun PrimaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    leadingIcon: @Composable (() -> Unit)? = null,
    tone: ButtonTone = ButtonTone.Primary
) {
    val colors = when (tone) {
        ButtonTone.Primary -> ButtonDefaults.buttonColors()
        ButtonTone.Danger -> ButtonDefaults.buttonColors(
            containerColor = MaterialTheme.colorScheme.error,
            contentColor = MaterialTheme.colorScheme.onError
        )
        ButtonTone.Neutral -> ButtonDefaults.buttonColors(
            containerColor = Color(0xFFF0F3F8),
            contentColor = TextMain
        )
    }

    Button(
        onClick = onClick,
        enabled = enabled,
        colors = colors,
        shape = RoundedCornerShape(999.dp),
        modifier = modifier
            .height(54.dp)
            .fillMaxWidth()
    ) {
        if (leadingIcon != null) {
            leadingIcon()
            Spacer(Modifier.width(8.dp))
        }
        Text(text = text, style = MaterialTheme.typography.labelLarge)
    }
}

enum class ButtonTone { Primary, Danger, Neutral }

@Composable
fun InfoRow(
    icon: @Composable () -> Unit,
    title: String,
    value: String,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Surface(
            color = MaterialTheme.colorScheme.primary.copy(alpha = 0.10f),
            shape = CircleShape
        ) {
            Box(Modifier.padding(8.dp), contentAlignment = Alignment.Center) {
                CompositionLocalProvider(LocalContentColor provides MaterialTheme.colorScheme.primary) {
                    icon()
                }
            }
        }
        Spacer(Modifier.width(10.dp))
        Column(Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.labelMedium, color = Color(0xFF64748B))
            Text(value, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
        }
    }
}

@Composable
fun CardSurface(
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit
) {
    Surface(
        modifier = modifier,
        shape = MaterialTheme.shapes.medium,
        color = MaterialTheme.colorScheme.surface,
        tonalElevation = 0.dp,
        shadowElevation = 6.dp,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.6f))
    ) {
        Column(Modifier.padding(16.dp), content = content)
    }
}

/* -----------------------------
   SCREEN 1: ChargerListScreen
-------------------------------- */

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChargerListScreen(
    chargers: List<UiCharger>,
    onChargerClick: (UiCharger) -> Unit,
    onFilterClick: () -> Unit,
    onSearchChanged: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    var search by remember { mutableStateOf("") }

    Scaffold(
        modifier = modifier,
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = { Text("PlugBox") },
                actions = {
                    IconButton(onClick = onFilterClick) {
                        Icon(Icons.Outlined.Tune, contentDescription = "Filters")
                    }
                }
            )
        }
    ) { padding ->
        Column(
            Modifier
                .padding(padding)
                .padding(horizontal = 16.dp)
        ) {
            OutlinedTextField(
                value = search,
                onValueChange = {
                    search = it
                    onSearchChanged(it)
                },
                placeholder = { Text("Search charger / area") },
                leadingIcon = { Icon(Icons.Outlined.Search, contentDescription = null) },
                singleLine = true,
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier.fillMaxWidth(),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.6f),
                    unfocusedBorderColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.7f),
                    focusedContainerColor = Color.White,
                    unfocusedContainerColor = Color.White
                )
            )

            Spacer(Modifier.height(12.dp))

            Text(
                text = "Nearby chargers",
                style = MaterialTheme.typography.titleMedium
            )

            Spacer(Modifier.height(10.dp))

            LazyColumn(
                contentPadding = PaddingValues(bottom = 20.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(chargers) { charger ->
                    ChargerCard(
                        charger = charger,
                        onClick = { onChargerClick(charger) }
                    )
                }
            }
        }
    }
}

@Composable
private fun ChargerCard(
    charger: UiCharger,
    onClick: () -> Unit
) {
    CardSurface(
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = charger.name,
                        style = MaterialTheme.typography.titleMedium,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    Spacer(Modifier.width(8.dp))
                    StatusChip(status = charger.status)
                }
                Spacer(Modifier.height(6.dp))
                Text(
                    text = charger.address,
                    style = MaterialTheme.typography.bodyMedium,
                    color = Color(0xFF64748B),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
            Spacer(Modifier.width(10.dp))
            IconButton(onClick = onClick) {
                Icon(Icons.Outlined.ChevronRight, contentDescription = "Open")
            }
        }

        Spacer(Modifier.height(12.dp))

        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            InfoRow(
                icon = { Icon(Icons.Outlined.NearMe, contentDescription = null) },
                title = "Distance",
                value = "${charger.distanceKm} km",
                modifier = Modifier.weight(1f)
            )
            InfoRow(
                icon = { Icon(Icons.Outlined.Schedule, contentDescription = null) },
                title = "ETA",
                value = "${charger.etaMin} min",
                modifier = Modifier.weight(1f)
            )
        }

        Spacer(Modifier.height(12.dp))

        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                text = charger.priceHint,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.SemiBold
            )
            Spacer(Modifier.weight(1f))
            PrimaryButton(
                text = if (charger.status == ChargerStatus.IDLE) "Book now" else "View",
                onClick = onClick,
                modifier = Modifier.widthIn(min = 140.dp),
            )
        }
    }
}

/* -----------------------------
   SCREEN 2: ChargerDetailScreen
-------------------------------- */

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChargerDetailScreen(
    charger: UiCharger,
    selectedPackageId: String?,
    onSelectPackage: (UiPackage) -> Unit,
    onNavigateClick: () -> Unit,
    onProceedToPay: () -> Unit,
    modifier: Modifier = Modifier
) {
    Scaffold(
        modifier = modifier,
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = { Text("Charger details") },
                navigationIcon = {
                    IconButton(onClick = { /* host handles back */ }) {
                        Icon(Icons.Outlined.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        },
        bottomBar = {
            Surface(
                shadowElevation = 10.dp,
                color = MaterialTheme.colorScheme.background
            ) {
                Row(
                    Modifier
                        .padding(16.dp)
                        .fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    OutlinedButton(
                        onClick = onNavigateClick,
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(999.dp)
                    ) {
                        Icon(Icons.Outlined.Navigation, contentDescription = null)
                        Spacer(Modifier.width(8.dp))
                        Text("Navigate")
                    }
                    Button(
                        onClick = onProceedToPay,
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(999.dp)
                    ) {
                        Text("Proceed to pay")
                    }
                }
            }
        }
    ) { padding ->
        Column(
            Modifier
                .padding(padding)
                .padding(16.dp)
        ) {
            CardSurface(Modifier.fillMaxWidth()) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(charger.name, style = MaterialTheme.typography.titleLarge)
                        Spacer(Modifier.height(6.dp))
                        Text(charger.address, color = Color(0xFF64748B))
                    }
                    StatusChip(charger.status)
                }

                Spacer(Modifier.height(14.dp))

                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    InfoRow(
                        icon = { Icon(Icons.Outlined.NearMe, contentDescription = null) },
                        title = "Distance",
                        value = "${charger.distanceKm} km",
                        modifier = Modifier.weight(1f)
                    )
                    InfoRow(
                        icon = { Icon(Icons.Outlined.Bolt, contentDescription = null) },
                        title = "Power",
                        value = "${charger.powerKw} kW",
                        modifier = Modifier.weight(1f)
                    )
                    InfoRow(
                        icon = { Icon(Icons.Outlined.ElectricalServices, contentDescription = null) },
                        title = "Sockets",
                        value = "${charger.socketsAvailable}/${charger.socketsTotal}",
                        modifier = Modifier.weight(1f)
                    )
                }
            }

            Spacer(Modifier.height(14.dp))

            Text("Packages", style = MaterialTheme.typography.titleMedium)
            Spacer(Modifier.height(10.dp))

            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                charger.packages.forEach { pkg ->
                    PackageCard(
                        pkg = pkg,
                        selected = pkg.id == selectedPackageId,
                        onClick = { onSelectPackage(pkg) }
                    )
                }
            }

            Spacer(Modifier.height(14.dp))

            CardSurface(Modifier.fillMaxWidth()) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        Icons.Outlined.AccountBalanceWallet,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary
                    )
                    Spacer(Modifier.width(10.dp))
                    Column(Modifier.weight(1f)) {
                        Text("Security deposit", fontWeight = FontWeight.SemiBold)
                        Text(
                            "₹${charger.depositInr} (refundable) • Shown in wallet as Locked Deposit",
                            color = Color(0xFF64748B),
                            style = MaterialTheme.typography.bodyMedium
                        )
                    }
                }
            }

            Spacer(Modifier.height(100.dp)) // room for bottom bar
        }
    }
}

@Composable
private fun PackageCard(
    pkg: UiPackage,
    selected: Boolean,
    onClick: () -> Unit
) {
    val borderColor = if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outline.copy(alpha = 0.7f)
    val badgeBg = MaterialTheme.colorScheme.primary.copy(alpha = 0.12f)

    Surface(
        onClick = onClick,
        shape = MaterialTheme.shapes.medium,
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, borderColor),
        shadowElevation = if (selected) 10.dp else 4.dp,
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            Modifier.padding(14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            RadioButton(
                selected = selected,
                onClick = onClick
            )
            Spacer(Modifier.width(8.dp))
            Column(Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(pkg.name, fontWeight = FontWeight.SemiBold)
                    if (pkg.badge != null) {
                        Spacer(Modifier.width(8.dp))
                        Surface(color = badgeBg, shape = RoundedCornerShape(999.dp)) {
                            Text(
                                pkg.badge,
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp),
                                color = MaterialTheme.colorScheme.primary,
                                style = MaterialTheme.typography.labelMedium,
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                    }
                }
                Spacer(Modifier.height(2.dp))
                Text("${pkg.kwhLimit} kWh", color = Color(0xFF64748B))
            }
            Text(
                text = "₹${pkg.priceInr}",
                fontWeight = FontWeight.SemiBold
            )
        }
    }
}

/* -----------------------------
   SCREEN 3: SessionScreen (6 states)
-------------------------------- */

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SessionScreen(
    state: UiSessionState,
    onSwipeGenerateCode: () -> Unit,
    onConfirmEnteredCode: () -> Unit,
    onStartCharging: () -> Unit,
    onStopCharging: () -> Unit,
    onCloseLidCheck: () -> Unit,
    onCancelSession: () -> Unit,
    onViewReceipt: () -> Unit,
    onDone: () -> Unit,
    modifier: Modifier = Modifier
) {
    Scaffold(
        modifier = modifier,
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = { Text("PlugBox") },
                actions = {
                    val connected = state.connected
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Outlined.Wifi,
                            contentDescription = null,
                            tint = if (connected) PlugGreen else Color(0xFF64748B)
                        )
                        Spacer(Modifier.width(6.dp))
                        Text(
                            text = if (connected) "Connected" else "Not connected",
                            color = if (connected) PlugGreen else Color(0xFF64748B),
                            style = MaterialTheme.typography.labelMedium,
                            fontWeight = FontWeight.SemiBold
                        )
                        Spacer(Modifier.width(12.dp))
                    }
                }
            )
        }
    ) { padding ->
        Column(
            Modifier
                .padding(padding)
                .padding(16.dp)
        ) {
            Text(
                text = "${state.chargerName}  •  ${state.socketLabel}",
                color = Color(0xFF64748B),
                style = MaterialTheme.typography.bodyMedium
            )
            Spacer(Modifier.height(12.dp))

            when (state) {
                is UiSessionState.Grace -> {
                    BannerExpiry(expiryLabel = state.expiryLabel, penaltyInr = state.penaltyInr)
                    Spacer(Modifier.height(12.dp))

                    SwipeToGenerateCode(
                        text = "Swipe to generate unlock code",
                        onSwiped = onSwipeGenerateCode
                    )

                    Spacer(Modifier.height(10.dp))
                    PrimaryButton(
                        text = "Cancel session",
                        tone = ButtonTone.Neutral,
                        onClick = onCancelSession
                    )

                    Spacer(Modifier.height(12.dp))
                    LiveMeterCard(
                        usedKwh = 0.00,
                        usedInr = 0,
                        remainingKwh = state.packageLimitKwh,
                        remainingInr = state.packageLimitInr,
                        packageLimitKwh = state.packageLimitKwh,
                        progress = 0f
                    )
                    Spacer(Modifier.height(12.dp))
                    SessionStepper(current = SessionStep.SWIPE_CODE, moneyDeductedChecked = false, closeLidRequired = true)
                }

                is UiSessionState.CodeGenerated -> {
                    BannerExpiry(expiryLabel = state.expiryLabel, penaltyInr = state.penaltyInr)
                    Spacer(Modifier.height(12.dp))

                    CodeTile(
                        code = state.unlockCode,
                        helper = "Enter this code on the charger keypad to unlock lid"
                    )

                    Spacer(Modifier.height(10.dp))
                    PrimaryButton(
                        text = "I've entered the code",
                        onClick = onConfirmEnteredCode,
                        leadingIcon = { Icon(Icons.Outlined.CheckCircleOutline, contentDescription = null) }
                    )

                    Spacer(Modifier.height(10.dp))
                    PrimaryButton(
                        text = "Cancel session",
                        tone = ButtonTone.Neutral,
                        onClick = onCancelSession
                    )

                    Spacer(Modifier.height(12.dp))
                    LiveMeterCard(
                        usedKwh = 0.00,
                        usedInr = 0,
                        remainingKwh = state.packageLimitKwh,
                        remainingInr = state.packageLimitInr,
                        packageLimitKwh = state.packageLimitKwh,
                        progress = 0f
                    )
                    Spacer(Modifier.height(12.dp))
                    SessionStepper(current = SessionStep.LID_UNLOCKED_PENDING, moneyDeductedChecked = false, closeLidRequired = true)
                }

                is UiSessionState.LidUnlockedWaitingPlug -> {
                    BannerInfo(text = "Plug in cable to continue")
                    Spacer(Modifier.height(12.dp))

                    CardSurface(Modifier.fillMaxWidth()) {
                        InfoRow(
                            icon = { Icon(Icons.Outlined.LockOpen, contentDescription = null) },
                            title = "Lid status",
                            value = "Unlocked"
                        )
                        Spacer(Modifier.height(12.dp))
                        PrimaryButton(
                            text = "Start charging",
                            enabled = false,
                            onClick = onStartCharging,
                            leadingIcon = { Icon(Icons.Outlined.Bolt, contentDescription = null) }
                        )
                        Spacer(Modifier.height(8.dp))
                        Text(
                            "Waiting for plug-in",
                            color = Color(0xFF64748B),
                            style = MaterialTheme.typography.bodyMedium
                        )
                    }

                    Spacer(Modifier.height(12.dp))
                    LiveMeterCard(
                        usedKwh = 0.00,
                        usedInr = 0,
                        remainingKwh = state.packageLimitKwh,
                        remainingInr = state.packageLimitInr,
                        packageLimitKwh = state.packageLimitKwh,
                        progress = 0f
                    )
                    Spacer(Modifier.height(12.dp))
                    SessionStepper(current = SessionStep.PLUG_IN, moneyDeductedChecked = false, closeLidRequired = true)
                }

                is UiSessionState.Charging -> {
                    BannerInfo(text = "Charging in progress")
                    Spacer(Modifier.height(12.dp))

                    if (state.walletDeductedChip != null) {
                        AssistChip(
                            onClick = { },
                            label = { Text(state.walletDeductedChip) },
                            leadingIcon = {
                                Icon(Icons.Outlined.AccountBalanceWallet, contentDescription = null)
                            },
                            colors = AssistChipDefaults.assistChipColors(
                                containerColor = PlugGreen.copy(alpha = 0.10f),
                                labelColor = PlugGreen,
                                leadingIconContentColor = PlugGreen
                            )
                        )
                        Spacer(Modifier.height(8.dp))
                    }

                    PrimaryButton(
                        text = "Stop charging",
                        tone = ButtonTone.Danger,
                        onClick = onStopCharging,
                        leadingIcon = { Icon(Icons.Outlined.StopCircle, contentDescription = null) }
                    )

                    Spacer(Modifier.height(12.dp))
                    val progress = (state.usedKwh / state.packageLimitKwh).coerceIn(0.0, 1.0).toFloat()
                    LiveMeterCard(
                        usedKwh = state.usedKwh,
                        usedInr = state.usedInr,
                        remainingKwh = state.remainingKwh,
                        remainingInr = state.remainingInr,
                        packageLimitKwh = state.packageLimitKwh,
                        progress = progress
                    )
                    Spacer(Modifier.height(12.dp))
                    SessionStepper(current = SessionStep.CHARGING, moneyDeductedChecked = true, closeLidRequired = true)
                }

                is UiSessionState.CloseLidRequired -> {
                    BannerWarning(text = "Close the lid to make charger available")
                    Spacer(Modifier.height(12.dp))

                    CardSurface(Modifier.fillMaxWidth()) {
                        Text("Final summary", fontWeight = FontWeight.SemiBold)
                        Spacer(Modifier.height(10.dp))

                        SummaryRow("Energy used", "${state.finalUsedKwh} kWh")
                        SummaryRow("Charged", "₹${state.finalChargedInr}")
                        SummaryRow("Refund", "₹${state.refundInr}")

                        Spacer(Modifier.height(12.dp))
                        Text(
                            "Charger will not be available until lid is closed.",
                            color = Color(0xFF64748B)
                        )

                        Spacer(Modifier.height(12.dp))
                        PrimaryButton(
                            text = "Check lid status",
                            onClick = onCloseLidCheck,
                            leadingIcon = { Icon(Icons.Outlined.Sensors, contentDescription = null) }
                        )
                        Spacer(Modifier.height(10.dp))
                        OutlinedButton(
                            onClick = { /* support callback if you add */ },
                            shape = RoundedCornerShape(999.dp),
                            modifier = Modifier.fillMaxWidth().height(54.dp)
                        ) {
                            Icon(Icons.Outlined.SupportAgent, contentDescription = null)
                            Spacer(Modifier.width(8.dp))
                            Text("Support")
                        }
                    }

                    Spacer(Modifier.height(12.dp))
                    SessionStepper(current = SessionStep.CLOSE_LID, moneyDeductedChecked = true, closeLidRequired = true)
                }

                is UiSessionState.Ended -> {
                    BannerSuccess(text = "Session ended")
                    Spacer(Modifier.height(12.dp))

                    CardSurface(Modifier.fillMaxWidth()) {
                        Text("Receipt", fontWeight = FontWeight.SemiBold)
                        Spacer(Modifier.height(10.dp))

                        SummaryRow("Energy", "${state.totalKwh} kWh")
                        SummaryRow("Charged", "₹${state.chargedInr}")
                        SummaryRow("Refund", "₹${state.refundInr}")
                        SummaryRow("Deposit", if (state.depositReleased) "Released" else "Pending")

                        Spacer(Modifier.height(12.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            OutlinedButton(
                                onClick = onViewReceipt,
                                shape = RoundedCornerShape(999.dp),
                                modifier = Modifier.weight(1f).height(54.dp)
                            ) {
                                Text("View receipt")
                            }
                            Button(
                                onClick = onDone,
                                shape = RoundedCornerShape(999.dp),
                                modifier = Modifier.weight(1f).height(54.dp)
                            ) {
                                Text("Done")
                            }
                        }
                    }

                    Spacer(Modifier.height(12.dp))
                    SessionStepper(current = SessionStep.ENDED, moneyDeductedChecked = true, closeLidRequired = true)

                    if (state.showThankYouPopup) {
                        ThankYouDialog(
                            onViewReceipt = onViewReceipt,
                            onDone = onDone
                        )
                    }
                }
            }
        }
    }
}

/* -----------------------------
   Session UI pieces
-------------------------------- */

private enum class SessionStep {
    BOOKED,
    SWIPE_CODE,
    LID_UNLOCKED_PENDING,
    PLUG_IN,
    CHARGING,
    MONEY_DEDUCTED,
    CLOSE_LID,
    ENDED
}

@Composable
private fun SessionStepper(
    current: SessionStep,
    moneyDeductedChecked: Boolean,
    closeLidRequired: Boolean
) {
    CardSurface(Modifier.fillMaxWidth()) {
        Text("Session progress", fontWeight = FontWeight.SemiBold)
        Spacer(Modifier.height(12.dp))

        StepRow("Session booked", done = true, highlight = current == SessionStep.BOOKED)
        StepRow("Swipe to generate code", done = current.ordinal > SessionStep.SWIPE_CODE.ordinal, highlight = current == SessionStep.SWIPE_CODE)
        StepRow("Lid unlocked", done = current.ordinal > SessionStep.LID_UNLOCKED_PENDING.ordinal, highlight = current == SessionStep.LID_UNLOCKED_PENDING)
        StepRow("Plug in charging cable", done = current.ordinal > SessionStep.PLUG_IN.ordinal, highlight = current == SessionStep.PLUG_IN)
        StepRow("Charging started", done = current.ordinal > SessionStep.CHARGING.ordinal, highlight = current == SessionStep.CHARGING)
        StepRow("Money deducted (auto)", done = moneyDeductedChecked, highlight = current == SessionStep.MONEY_DEDUCTED)

        val closeLabel = if (closeLidRequired) "Close the lid (required)" else "Close the lid (optional)"
        StepRow(closeLabel, done = current.ordinal > SessionStep.CLOSE_LID.ordinal, highlight = current == SessionStep.CLOSE_LID)

        StepRow("Session ended", done = current == SessionStep.ENDED, highlight = current == SessionStep.ENDED)
    }
}

@Composable
private fun StepRow(
    text: String,
    done: Boolean,
    highlight: Boolean
) {
    val iconTint = when {
        done -> PlugGreen
        highlight -> EnergyBlue
        else -> Color(0xFF94A3B8)
    }
    val labelColor = when {
        done -> TextMain
        highlight -> TextMain
        else -> Color(0xFF64748B)
    }

    Row(
        Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Surface(
            shape = CircleShape,
            color = iconTint.copy(alpha = 0.12f)
        ) {
            Box(Modifier.size(28.dp), contentAlignment = Alignment.Center) {
                Icon(
                    imageVector = if (done) Icons.Outlined.CheckCircle else Icons.Outlined.RadioButtonUnchecked,
                    contentDescription = null,
                    tint = iconTint
                )
            }
        }
        Spacer(Modifier.width(10.dp))
        Text(text, color = labelColor, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
    Spacer(Modifier.height(10.dp))
}

@Composable
private fun BannerExpiry(expiryLabel: String, penaltyInr: Int) {
    BannerBase(
        icon = Icons.Outlined.Timer,
        title = "Reach & unlock before expiry $expiryLabel",
        subtitle = "Session expires + ₹$penaltyInr penalty",
        accent = EnergyBlue
    )
}

@Composable
private fun BannerInfo(text: String) {
    BannerBase(
        icon = Icons.Outlined.Info,
        title = text,
        subtitle = null,
        accent = EnergyBlue
    )
}

@Composable
private fun BannerWarning(text: String) {
    BannerBase(
        icon = Icons.Outlined.WarningAmber,
        title = text,
        subtitle = "Charger won’t become IDLE until lid is closed",
        accent = Warning
    )
}

@Composable
private fun BannerSuccess(text: String) {
    BannerBase(
        icon = Icons.Outlined.CheckCircleOutline,
        title = text,
        subtitle = null,
        accent = PlugGreen
    )
}

@Composable
private fun BannerBase(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    title: String,
    subtitle: String?,
    accent: Color
) {
    Surface(
        color = accent.copy(alpha = 0.10f),
        shape = MaterialTheme.shapes.medium,
        border = BorderStroke(1.dp, accent.copy(alpha = 0.25f))
    ) {
        Row(
            Modifier
                .fillMaxWidth()
                .padding(14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(icon, contentDescription = null, tint = accent)
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f)) {
                Text(title, fontWeight = FontWeight.SemiBold)
                if (subtitle != null) {
                    Spacer(Modifier.height(2.dp))
                    Text(subtitle, color = Color(0xFF64748B))
                }
            }
        }
    }
}

@Composable
private fun CodeTile(code: String, helper: String) {
    CardSurface(Modifier.fillMaxWidth()) {
        Text("Unlock code", color = Color(0xFF64748B), style = MaterialTheme.typography.labelMedium)
        Spacer(Modifier.height(8.dp))
        Text(
            text = code,
            fontFamily = FontFamily.Monospace,
            fontWeight = FontWeight.Bold,
            style = MaterialTheme.typography.titleLarge
        )
        Spacer(Modifier.height(8.dp))
        Text(helper, color = Color(0xFF64748B))
    }
}

@Composable
private fun LiveMeterCard(
    usedKwh: Double,
    usedInr: Int,
    remainingKwh: Double,
    remainingInr: Int,
    packageLimitKwh: Double,
    progress: Float
) {
    CardSurface(Modifier.fillMaxWidth()) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("Live meter", fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.weight(1f))
            Icon(Icons.Outlined.Refresh, contentDescription = null, tint = Color(0xFF94A3B8))
        }

        Spacer(Modifier.height(10.dp))

        Row(verticalAlignment = Alignment.Bottom) {
            Column(Modifier.weight(1f)) {
                Text(
                    text = String.format("%.2f", usedKwh),
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold
                )
                Text("kWh used", color = Color(0xFF64748B))
                Spacer(Modifier.height(6.dp))
                Text("₹$usedInr", fontWeight = FontWeight.Bold)
                Text("Amount used", color = Color(0xFF64748B))
            }
            Column(horizontalAlignment = Alignment.End) {
                Text("Remaining", color = Color(0xFF64748B))
                Text(
                    "${String.format("%.2f", remainingKwh)} kWh / ₹$remainingInr",
                    fontWeight = FontWeight.SemiBold
                )
            }
        }

        Spacer(Modifier.height(10.dp))

        LinearProgressIndicator(
            progress = progress.coerceIn(0f, 1f),
            color = EnergyBlue,
            trackColor = EnergyBlue.copy(alpha = 0.16f),
            modifier = Modifier
                .fillMaxWidth()
                .height(10.dp)
                .clip(RoundedCornerShape(999.dp))
        )

        Spacer(Modifier.height(8.dp))

        Row {
            Text("${(progress * 100).roundToInt()}%", color = Color(0xFF64748B))
            Spacer(Modifier.weight(1f))
            Text("${String.format("%.0f", packageLimitKwh)} kWh", color = Color(0xFF64748B))
            Spacer(Modifier.width(6.dp))
            Text("Package limit", color = Color(0xFF64748B))
        }
    }
}

@Composable
private fun SummaryRow(label: String, value: String) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text(label, color = Color(0xFF64748B))
        Spacer(Modifier.weight(1f))
        Text(value, fontWeight = FontWeight.SemiBold)
    }
    Spacer(Modifier.height(8.dp))
}

@Composable
private fun ThankYouDialog(
    onViewReceipt: () -> Unit,
    onDone: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDone,
        confirmButton = {
            Button(
                onClick = onDone,
                shape = RoundedCornerShape(999.dp)
            ) { Text("Done") }
        },
        dismissButton = {
            OutlinedButton(
                onClick = onViewReceipt,
                shape = RoundedCornerShape(999.dp)
            ) { Text("View receipt") }
        },
        title = { Text("Thank you") },
        text = { Text("Session complete. Ride safe!") }
    )
}

/* -----------------------------
   Swipe-to-generate control (UI-only)
-------------------------------- */

@Composable
private fun SwipeToGenerateCode(
    text: String,
    onSwiped: () -> Unit,
    modifier: Modifier = Modifier,
    height: Dp = 56.dp
) {
    CardSurface(modifier.fillMaxWidth()) {
        Text("Unlock", fontWeight = FontWeight.SemiBold)
        Spacer(Modifier.height(10.dp))
        PrimaryButton(
            text = "Generate Code",
            onClick = onSwiped
        )
        Spacer(Modifier.height(8.dp))
        Text(text, color = Color(0xFF64748B), style = MaterialTheme.typography.bodyMedium)
    }
}

/* -----------------------------
   PREVIEWS (Dummy data)
-------------------------------- */

private fun sampleCharger(): UiCharger = UiCharger(
    id = "c1",
    name = "PlugBox Point - Central Market",
    address = "Central Market Rd, Near Gate 2",
    lat = 28.4595,
    lng = 77.0266,
    distanceKm = 0.8,
    etaMin = 4,
    powerKw = 1.5,
    socketsAvailable = 2,
    socketsTotal = 4,
    status = ChargerStatus.IDLE,
    priceHint = "₹40 / 1.0 kWh",
    depositInr = 100,
    packages = listOf(
        UiPackage("p1", "Mini", 0.5, 20),
        UiPackage("p2", "Standard", 1.0, 40, badge = "Best value"),
        UiPackage("p3", "Plus", 1.5, 55)
    )
)

@Preview(showBackground = true)
@Composable
private fun Preview_ChargerList() {
    PlugBoxTheme {
        ChargerListScreen(
            chargers = listOf(
                sampleCharger(),
                sampleCharger().copy(
                    id = "c2",
                    name = "PlugBox Point - Metro Station",
                    status = ChargerStatus.IN_USE,
                    distanceKm = 1.4,
                    etaMin = 7,
                    socketsAvailable = 0
                ),
                sampleCharger().copy(
                    id = "c3",
                    name = "PlugBox Point - City Mall",
                    status = ChargerStatus.OFFLINE,
                    distanceKm = 2.2,
                    etaMin = 11,
                    socketsAvailable = 0
                )
            ),
            onChargerClick = {},
            onFilterClick = {},
            onSearchChanged = {}
        )
    }
}

@Preview(showBackground = true)
@Composable
private fun Preview_ChargerDetail() {
    PlugBoxTheme {
        ChargerDetailScreen(
            charger = sampleCharger(),
            selectedPackageId = "p2",
            onSelectPackage = {},
            onNavigateClick = {},
            onProceedToPay = {}
        )
    }
}

@Preview(showBackground = true)
@Composable
private fun Preview_Session_Grace() {
    PlugBoxTheme {
        SessionScreen(
            state = UiSessionState.Grace(
                chargerName = "Charger A",
                socketLabel = "Socket 1",
                connected = true,
                expiryLabel = "06:15",
                penaltyInr = 10,
                packageLimitKwh = 1.0,
                packageLimitInr = 40
            ),
            onSwipeGenerateCode = {},
            onConfirmEnteredCode = {},
            onStartCharging = {},
            onStopCharging = {},
            onCloseLidCheck = {},
            onCancelSession = {},
            onViewReceipt = {},
            onDone = {}
        )
    }
}

@Preview(showBackground = true)
@Composable
private fun Preview_Session_Charging() {
    PlugBoxTheme {
        SessionScreen(
            state = UiSessionState.Charging(
                chargerName = "Charger A",
                socketLabel = "Socket 1",
                connected = true,
                usedKwh = 0.62,
                usedInr = 25,
                remainingKwh = 0.38,
                remainingInr = 15,
                packageLimitKwh = 1.0,
                packageLimitInr = 40
            ),
            onSwipeGenerateCode = {},
            onConfirmEnteredCode = {},
            onStartCharging = {},
            onStopCharging = {},
            onCloseLidCheck = {},
            onCancelSession = {},
            onViewReceipt = {},
            onDone = {}
        )
    }
}
