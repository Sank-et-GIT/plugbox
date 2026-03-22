package com.example.plugbox.ui

import android.Manifest
import android.annotation.SuppressLint
import android.location.Location
import kotlin.math.roundToInt
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectVerticalDragGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.google.accompanist.permissions.ExperimentalPermissionsApi
import com.google.accompanist.permissions.rememberMultiplePermissionsState
import com.google.android.gms.location.LocationServices
import com.google.android.gms.maps.model.BitmapDescriptorFactory
import com.google.android.gms.maps.model.CameraPosition
import com.google.android.gms.maps.model.LatLng
import com.google.maps.android.compose.*
import kotlinx.coroutines.delay
import kotlinx.coroutines.tasks.await
import kotlin.math.*

// ── COLORS matching the mockup ────────────────────────────────
private val MockGreen      = Color(0xFF16C784)
private val MockGreenBg    = Color(0xFFECFDF5)
private val MockBlue       = Color(0xFF3B82F6)
private val MockOrange     = Color(0xFFF59E0B)
private val MockGray       = Color(0xFF64748B)
private val MockGrayLight  = Color(0xFFF1F5F9)
private val MockRed        = Color(0xFFEF4444)
private val MockBg         = Color(0xFFF6F8FB)
private val MockHandle     = Color(0xFFCBD5E1)
private val MockTextMain   = Color(0xFF0B1220)

private enum class HsSheet { FULL_MAP, COLLAPSED, HALF, EXPANDED }

// ── GPS DISTANCE HELPER ───────────────────────────────────────
private fun haversineKm(lat1: Double, lng1: Double, lat2: Double, lng2: Double): Double {
    val r = 6371.0
    val dLat = Math.toRadians(lat2 - lat1)
    val dLng = Math.toRadians(lng2 - lng1)
    val a = sin(dLat / 2).pow(2) +
            cos(Math.toRadians(lat1)) * cos(Math.toRadians(lat2)) * sin(dLng / 2).pow(2)
    return r * 2 * atan2(sqrt(a), sqrt(1 - a))
}

private fun formatDistance(km: Double): String = when {
    km < 1.0 -> "${(km * 1000).roundToInt()} m"
    else      -> String.format("%.1f km", km)
}

// ═══════════════════════════════════════════════════════════════
// HomeMapScreen
// ═══════════════════════════════════════════════════════════════
@OptIn(ExperimentalPermissionsApi::class)
@SuppressLint("MissingPermission")
@Composable
fun HomeMapScreen(
    chargers: List<UiCharger>,
    selected: UiCharger?,
    onSelect: (UiCharger) -> Unit,
    onBookNow: (UiCharger) -> Unit,
    onFilterClick: () -> Unit,
    onSearchChanged: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    var userLocation by remember { mutableStateOf<Location?>(null) }
    var sheet        by remember { mutableStateOf(HsSheet.HALF) }
    var dragOff      by remember { mutableFloatStateOf(0f) }
    var timedOut     by remember { mutableStateOf(false) }

    // ── LOCATION PERMISSION ───────────────────────────────────
    val locationPermissions = rememberMultiplePermissionsState(
        listOf(
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION
        )
    )

    LaunchedEffect(Unit) {
        if (!locationPermissions.allPermissionsGranted) {
            locationPermissions.launchMultiplePermissionRequest()
        }
    }

    // ── GET GPS LOCATION ──────────────────────────────────────
    LaunchedEffect(locationPermissions.allPermissionsGranted) {
        if (locationPermissions.allPermissionsGranted) {
            val fusedClient = LocationServices.getFusedLocationProviderClient(context)
            // Keep trying every 3s until we get a location
            repeat(10) {
                if (userLocation != null) return@repeat
                try {
                    val cts = com.google.android.gms.tasks.CancellationTokenSource()
                    val loc = fusedClient.getCurrentLocation(
                        com.google.android.gms.location.Priority.PRIORITY_HIGH_ACCURACY,
                        cts.token
                    ).await()
                    if (loc != null) { userLocation = loc; return@repeat }
                } catch (_: Exception) { }
                delay(3000L)
            }
        }
    }

    // ── SORT CHARGERS BY DISTANCE ─────────────────────────────
    val sortedChargers = remember(chargers, userLocation) {
        if (userLocation != null) {
            chargers.map { c ->
                val dist = haversineKm(userLocation!!.latitude, userLocation!!.longitude, c.lat, c.lng)
                c.copy(distanceKm = dist)
            }.sortedBy { it.distanceKm }
        } else chargers
    }

    // ── TIMEOUT for loading ───────────────────────────────────
    LaunchedEffect(chargers) {
        if (chargers.isEmpty()) {
            timedOut = false
            delay(8000L)
            if (chargers.isEmpty()) timedOut = true
        } else timedOut = false
    }

    val sheetFrac by animateFloatAsState(
        targetValue = when (sheet) {
            HsSheet.FULL_MAP  -> 0f
            HsSheet.COLLAPSED -> 0.13f
            HsSheet.HALF      -> 0.50f
            HsSheet.EXPANDED  -> 0.82f
        },
        animationSpec = spring(dampingRatio = 0.75f, stiffness = 300f),
        label = "sheetFrac"
    )

    // ── MAP CAMERA ────────────────────────────────────────────
    val mapCenter = remember(userLocation, sortedChargers) {
        userLocation?.let { LatLng(it.latitude, it.longitude) }
            ?: sortedChargers.firstOrNull()?.let { LatLng(it.lat, it.lng) }
            ?: LatLng(21.1458, 79.0882)
    }
    val cam = rememberCameraPositionState {
        position = CameraPosition.fromLatLngZoom(mapCenter, 12f)
    }

    // ═════════════════════════════════════════════════════════
    // UI
    // ═════════════════════════════════════════════════════════
    Box(modifier = modifier.fillMaxSize()) {

        // ── MAP ───────────────────────────────────────────────
        GoogleMap(
            modifier = Modifier.fillMaxSize(),
            cameraPositionState = cam,
            uiSettings = MapUiSettings(
                zoomControlsEnabled = false,
                myLocationButtonEnabled = false
            ),
            properties = MapProperties(
                isMyLocationEnabled = locationPermissions.allPermissionsGranted
            )
        ) {
            sortedChargers.forEach { c ->
                val hue = when (c.status) {
                    ChargerStatus.IDLE     -> BitmapDescriptorFactory.HUE_GREEN
                    ChargerStatus.IN_USE   -> BitmapDescriptorFactory.HUE_ORANGE
                    ChargerStatus.RESERVED -> BitmapDescriptorFactory.HUE_ROSE
                    ChargerStatus.OFFLINE  -> BitmapDescriptorFactory.HUE_YELLOW
                }
                Marker(
                    state = MarkerState(position = LatLng(c.lat, c.lng)),
                    title = c.name,
                    snippet = c.status.name,
                    icon = BitmapDescriptorFactory.defaultMarker(hue),
                    onClick = {
                        onSelect(c)
                        false
                    }
                )
            }
        }

        // ── SEARCH BAR ────────────────────────────────────────
        HsSearchBar(
            onFilterClick = onFilterClick,
            modifier = Modifier
                .fillMaxWidth()
                .statusBarsPadding()
                .padding(horizontal = 16.dp, vertical = 12.dp)
                .align(Alignment.TopCenter)
        )

        // ── DRAGGABLE BOTTOM SHEET ────────────────────────────
        if (sheetFrac > 0f) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .fillMaxHeight(sheetFrac)
                    .align(Alignment.BottomCenter)
                    .clip(RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp))
                    .background(Color.White)
                    .pointerInput(sheet) {
                        detectVerticalDragGestures(
                            onDragEnd = {
                                sheet = hsResolveSheet(sheet, dragOff)
                                dragOff = 0f
                            },
                            onDragCancel = { dragOff = 0f },
                            onVerticalDrag = { _, delta -> dragOff += delta }
                        )
                    }
            ) {
                HsDragPill()
                when {
                    sortedChargers.isNotEmpty() -> HsChargerList(
                        chargers = sortedChargers,
                        userLocation = userLocation,
                        selected = selected,
                        onSelect = onSelect,
                        onBookNow = onBookNow
                    )
                    timedOut -> HsErrorView(onRetry = {
                        timedOut = false
                        onSearchChanged("")
                    })
                    else -> HsLoadingView()
                }
            }
        }

        // ── MY LOCATION FAB ───────────────────────────────────
        if (sheet != HsSheet.FULL_MAP && locationPermissions.allPermissionsGranted) {
            FloatingActionButton(
                onClick = {
                    userLocation?.let {
                        cam.move(
                            com.google.android.gms.maps.CameraUpdateFactory
                                .newLatLngZoom(LatLng(it.latitude, it.longitude), 15f)
                        )
                    }
                },
                modifier = Modifier
                    .align(Alignment.BottomEnd)
                    .padding(end = 16.dp, bottom = (sheetFrac * 900 + 16).dp.coerceAtLeast(80.dp)),
                containerColor = Color.White,
                contentColor = MockBlue,
                elevation = FloatingActionButtonDefaults.elevation(4.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.MyLocation,
                    contentDescription = "My location",
                    modifier = Modifier.size(20.dp)
                )
            }
        }

        // ── SHOW LIST FAB when map is full screen ─────────────
        if (sheet == HsSheet.FULL_MAP) {
            ExtendedFloatingActionButton(
                onClick = { sheet = HsSheet.HALF },
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .padding(bottom = 24.dp),
                containerColor = MockGreen,
                contentColor = Color.White,
                shape = RoundedCornerShape(16.dp)
            ) {
                Icon(Icons.Default.KeyboardArrowUp, contentDescription = null)
                Spacer(modifier = Modifier.width(6.dp))
                Text(text = "Show chargers", fontWeight = FontWeight.Bold)
            }
        }
    }
}

// ═══════════════════════════════════════════════════════════════
// CHARGER LIST
// ═══════════════════════════════════════════════════════════════
@Composable
private fun HsChargerList(
    chargers: List<UiCharger>,
    userLocation: Location?,
    selected: UiCharger?,
    onSelect: (UiCharger) -> Unit,
    onBookNow: (UiCharger) -> Unit
) {
    val idle = chargers.filter { it.status == ChargerStatus.IDLE }
    val rest = chargers.filter { it.status != ChargerStatus.IDLE }

    LazyColumn(
        contentPadding = PaddingValues(
            start = 16.dp, end = 16.dp, top = 4.dp, bottom = 32.dp
        ),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        // ── NEAREST IDLE CARD ──────────────────────────────
        idle.firstOrNull()?.let { nearest ->
            item {
                HsNearestCard(
                    charger = nearest,
                    isSelected = selected?.id == nearest.id,
                    onBookNow = { onBookNow(nearest) }
                )
            }
            // Other idle chargers
            items(idle.drop(1)) { c ->
                HsChargerRow(
                    charger = c,
                    isSelected = selected?.id == c.id,
                    onClick = { onSelect(c); onBookNow(c) }
                )
            }
        }

        // "No chargers available" only if ALL are non-idle
        if (idle.isEmpty() && rest.isNotEmpty()) {
            item {
                Text(
                    text = "No chargers available right now",
                    color = MockGray,
                    fontSize = 14.sp,
                    modifier = Modifier.padding(vertical = 4.dp)
                )
            }
        }

        // Non-idle chargers
        items(rest) { c ->
            HsChargerRow(charger = c, isSelected = false, onClick = null)
        }
    }
}

// ── NEAREST AVAILABLE CARD (green, matches mockup) ────────────
@Composable
private fun HsNearestCard(
    charger: UiCharger,
    isSelected: Boolean,
    onBookNow: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MockGreenBg),
        border = androidx.compose.foundation.BorderStroke(
            width = if (isSelected) 2.dp else 1.5.dp,
            color = MockGreen
        )
    ) {
        Column(modifier = Modifier.padding(16.dp)) {

            // "Nearest available now" label
            Row(verticalAlignment = Alignment.CenterVertically) {
                Spacer(modifier = Modifier.width(1.dp))
                Text(
                    text = "Nearest available now",
                    color = MockBlue,
                    fontWeight = FontWeight.Bold,
                    fontSize = 22.sp
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Charger name
            Row(verticalAlignment = Alignment.CenterVertically) {

                Icon(
                    imageVector = Icons.Default.Power,
                    contentDescription = null,
                    tint = MockGreen,
                    modifier = Modifier.size(30.dp)
                )

                Spacer(modifier = Modifier.width(2.dp))

                Text(
                    text = charger.name,
                    fontWeight = FontWeight.Bold,
                    fontSize = 17.sp,
                    color = MockTextMain,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }

            Spacer(modifier = Modifier.height(4.dp))

            // Distance row
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = Icons.Outlined.LocationOn,
                    contentDescription = null,
                    tint = MockGray,
                    modifier = Modifier.size(14.dp)
                )
                Spacer(modifier = Modifier.width(3.dp))
                Text(
                    text = if (charger.distanceKm > 0.01)
                        formatDistance(charger.distanceKm)
                    else "Locating...",
                    fontSize = 13.sp,
                    color = MockGray
                )
            }

            Spacer(modifier = Modifier.height(10.dp))

            // Status + price row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // IDLE pill
                Surface(
                    color = MockGreen.copy(alpha = 0.12f),
                    shape = RoundedCornerShape(999.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(5.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(7.dp)
                                .clip(CircleShape)
                                .background(MockGreen)
                        )
                        Text(
                            text = "IDLE",
                            color = MockGreen,
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 15.sp
                        )
                    }
                }

                // Price
                Text(
                    text = charger.priceHint,
                    color = MockBlue,
                    fontWeight = FontWeight.Bold,
                    fontSize = 18.sp
                )
            }

            Spacer(modifier = Modifier.height(14.dp))

            // Book now button
            Button(
                onClick = onBookNow,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(50.dp),
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(containerColor = MockGreen)
            ) {
                Text(
                    text = "Book now",
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp,
                    color = Color.White
                )
            }
        }
    }
}

// ── CHARGER ROW (non-nearest) ──────────────────────────────────
@Composable
private fun HsChargerRow(
    charger: UiCharger,
    isSelected: Boolean,
    onClick: (() -> Unit)?
) {
    val isIdle = charger.status == ChargerStatus.IDLE
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (isSelected) MockGreenBg else Color.White
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
        border = androidx.compose.foundation.BorderStroke(
            1.dp, Color(0xFFE2E8F0)
        ),
        onClick = { onClick?.invoke() }
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 14.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = charger.name,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 15.sp,
                    color = MockTextMain,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Spacer(modifier = Modifier.height(4.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Outlined.LocationOn,
                        contentDescription = null,
                        tint = MockGray,
                        modifier = Modifier.size(13.dp)
                    )
                    Spacer(modifier = Modifier.width(3.dp))
                    Text(
                        text = if (charger.distanceKm > 0)
                            formatDistance(charger.distanceKm)
                        else charger.address,
                        fontSize = 12.sp,
                        color = MockGray
                    )
                }
            }
            HsStatusBadge(status = charger.status)
        }
    }
}

// ── STATUS BADGE ──────────────────────────────────────────────
@Composable
private fun HsStatusBadge(status: ChargerStatus) {
    val (label, color) = when (status) {
        ChargerStatus.IDLE     -> "Idle"     to MockGreen
        ChargerStatus.IN_USE   -> "In use"   to MockOrange
        ChargerStatus.RESERVED -> "Reserved" to MockBlue
        ChargerStatus.OFFLINE  -> "Offline"  to MockGray
    }
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(5.dp)
    ) {
        Text(
            text = label,
            color = color,
            fontWeight = FontWeight.SemiBold,
            fontSize = 13.sp
        )
        Box(
            modifier = Modifier
                .size(8.dp)
                .clip(CircleShape)
                .background(color)
        )
    }
}

// ── LOADING ───────────────────────────────────────────────────
@Composable
private fun HsLoadingView() {
    Box(
        modifier = Modifier.fillMaxSize().padding(32.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            CircularProgressIndicator(color = MockGreen)
            Text(text = "Finding chargers near you...", color = MockGray, fontSize = 14.sp)
        }
    }
}

// ── ERROR / RETRY ─────────────────────────────────────────────
@Composable
private fun HsErrorView(onRetry: () -> Unit) {
    Box(
        modifier = Modifier.fillMaxSize().padding(32.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Icon(
                imageVector = Icons.Default.WifiOff,
                contentDescription = null,
                tint = MockRed,
                modifier = Modifier.size(44.dp)
            )
            Text(
                text = "Could not load chargers",
                fontWeight = FontWeight.Bold,
                color = MockTextMain,
                fontSize = 16.sp
            )
            Text(
                text = "Check your internet connection",
                color = MockGray,
                fontSize = 13.sp,
                textAlign = TextAlign.Center
            )
            Button(
                onClick = onRetry,
                colors = ButtonDefaults.buttonColors(containerColor = MockGreen),
                shape = RoundedCornerShape(12.dp)
            ) {
                Text(text = "Retry", fontWeight = FontWeight.Bold)
            }
        }
    }
}

// ── DRAG PILL ─────────────────────────────────────────────────
@Composable
private fun HsDragPill() {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 10.dp, bottom = 6.dp),
        contentAlignment = Alignment.Center
    ) {
        Box(
            modifier = Modifier
                .width(36.dp)
                .height(4.dp)
                .clip(CircleShape)
                .background(MockHandle)
        )
    }
}

// ── SEARCH BAR ────────────────────────────────────────────────
@Composable
private fun HsSearchBar(
    onFilterClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Surface(
        modifier = modifier,
        shape = RoundedCornerShape(14.dp),
        color = Color.White,
        shadowElevation = 8.dp
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 13.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = Icons.Default.Search,
                contentDescription = null,
                tint = MockGray,
                modifier = Modifier.size(20.dp)
            )
            Spacer(modifier = Modifier.width(10.dp))
            Text(
                text = "Search charger / area",
                color = MockGray,
                fontSize = 15.sp,
                modifier = Modifier.weight(1f)
            )
            IconButton(
                onClick = onFilterClick,
                modifier = Modifier.size(24.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.Tune,
                    contentDescription = "Filter",
                    tint = MockTextMain
                )
            }
        }
    }
}

// ── SHEET STATE RESOLVER ──────────────────────────────────────
private fun hsResolveSheet(current: HsSheet, drag: Float): HsSheet = when {
    drag < -80 -> when (current) {
        HsSheet.FULL_MAP, HsSheet.COLLAPSED -> HsSheet.HALF
        HsSheet.HALF                        -> HsSheet.EXPANDED
        HsSheet.EXPANDED                    -> HsSheet.EXPANDED
    }
    drag > 80 -> when (current) {
        HsSheet.EXPANDED                    -> HsSheet.HALF
        HsSheet.HALF                        -> HsSheet.COLLAPSED
        HsSheet.COLLAPSED, HsSheet.FULL_MAP -> HsSheet.FULL_MAP
    }
    else -> current
}
