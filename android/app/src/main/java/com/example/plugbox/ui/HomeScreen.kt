package com.example.plugbox.ui

import android.Manifest
import android.annotation.SuppressLint
import android.content.IntentSender
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RadialGradient
import android.graphics.Shader
import android.location.Location
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.IntentSenderRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectVerticalDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material.icons.filled.MyLocation
import androidx.compose.material.icons.filled.Power
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Tune
import androidx.compose.material.icons.filled.WifiOff
import androidx.compose.material.icons.outlined.LocationOn
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.FloatingActionButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.google.accompanist.permissions.ExperimentalPermissionsApi
import com.google.accompanist.permissions.rememberMultiplePermissionsState
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.LocationSettingsRequest
import com.google.android.gms.maps.CameraUpdateFactory
import com.google.android.gms.maps.model.BitmapDescriptor
import com.google.android.gms.maps.model.BitmapDescriptorFactory
import com.google.android.gms.maps.model.CameraPosition
import com.google.android.gms.maps.model.LatLng
import com.google.maps.android.compose.GoogleMap
import com.google.maps.android.compose.MapProperties
import com.google.maps.android.compose.MapUiSettings
import com.google.maps.android.compose.Marker
import com.google.maps.android.compose.MarkerState
import com.google.maps.android.compose.Polyline
import com.google.maps.android.compose.rememberCameraPositionState
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.pow
import kotlin.math.roundToInt
import kotlin.math.sin
import kotlin.math.sqrt

// ──────────────────────────────────────────────────────────────
// Theme colors used across this screen
// ──────────────────────────────────────────────────────────────
private val MockGreen = Color(0xFF16C784)
private val MockGreenBg = Color(0xFFECFDF5)
private val MockBlue = Color(0xFF3B82F6)
private val MockOrange = Color(0xFFF59E0B)
private val MockGray = Color(0xFF64748B)
private val MockRed = Color(0xFFEF4444)
private val MockHandle = Color(0xFFCBD5E1)
private val MockTextMain = Color(0xFF0B1220)

// Bottom-sheet states
private enum class HsSheet { FULL_MAP, COLLAPSED, HALF, EXPANDED }

// Marker colors by charger status
private const val COLOR_IDLE = 0xFF16C384.toInt()
private const val COLOR_IN_USE = 0xFFF4941C.toInt()
private const val COLOR_OFFLINE = 0xFF95989F.toInt()
private const val COLOR_RESERVED = 0xFF3B82F6.toInt()

// Small delay so parent callbacks/API work do not fire on every keystroke instantly.
private const val SEARCH_DEBOUNCE_MS = 250L

// Max number of visible suggestions in overlay.
private const val MAX_SUGGESTIONS = 8

// ──────────────────────────────────────────────────────────────
// Distance helpers
// ──────────────────────────────────────────────────────────────
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
    else -> String.format(java.util.Locale.getDefault(), "%.1f km", km)
}

// ──────────────────────────────────────────────────────────────
// Custom marker for chargers
// ──────────────────────────────────────────────────────────────
private fun plugboxMarkerBitmap(fillColor: Int): BitmapDescriptor {
    val width = 120
    val height = 160
    val bmp = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bmp)

    val cx = width / 2f
    val r = width / 2f - 6f
    val tipY = height.toFloat() - 4f

    val shadowPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = 0x33000000.toInt()
        maskFilter = android.graphics.BlurMaskFilter(
            10f,
            android.graphics.BlurMaskFilter.Blur.NORMAL
        )
    }

    val shadowPath = android.graphics.Path().apply {
        addCircle(cx + 2f, r + 8f, r, android.graphics.Path.Direction.CW)
        moveTo(cx - 8f + 2f, r + r * 0.6f + 8f)
        lineTo(cx + 2f, tipY + 4f)
        lineTo(cx + 8f + 2f, r + r * 0.6f + 8f)
        close()
    }
    canvas.drawPath(shadowPath, shadowPaint)

    val path = android.graphics.Path().apply {
        addCircle(cx, r + 6f, r, android.graphics.Path.Direction.CW)
        moveTo(cx - r * 0.55f, r + r * 0.55f + 6f)
        lineTo(cx, tipY)
        lineTo(cx + r * 0.55f, r + r * 0.55f + 6f)
        close()
    }

    val fillPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = fillColor }
    canvas.drawPath(path, fillPaint)

    val borderPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = android.graphics.Color.WHITE
        style = Paint.Style.STROKE
        strokeWidth = 5f
    }
    canvas.drawPath(path, borderPaint)

    val innerPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = android.graphics.Color.WHITE
        alpha = 40
    }
    canvas.drawCircle(cx, r + 6f, r * 0.58f, innerPaint)

    val boltPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = android.graphics.Color.WHITE
        style = Paint.Style.FILL
    }

    val cy = r + 6f
    val bw = r * 0.38f
    val bh = r * 0.65f
    val boltPath = android.graphics.Path().apply {
        moveTo(cx + bw * 0.1f, cy - bh)
        lineTo(cx + bw * 0.55f, cy - bh * 0.05f)
        lineTo(cx + bw * 0.1f, cy + bh * 0.05f)
        lineTo(cx + bw * 0.5f, cy + bh)
        lineTo(cx - bw * 0.1f, cy + bh * 0.1f)
        lineTo(cx - bw * 0.45f, cy + bh * 0.1f)
        lineTo(cx - bw * 0.05f, cy - bh * 0.05f)
        lineTo(cx - bw * 0.5f, cy - bh * 0.05f)
        close()
    }
    canvas.drawPath(boltPath, boltPaint)

    return BitmapDescriptorFactory.fromBitmap(bmp)
}

// ──────────────────────────────────────────────────────────────
// Custom user-location marker
// ──────────────────────────────────────────────────────────────
private fun userMarkerBitmap(): BitmapDescriptor {
    val size = 160
    val bmp = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bmp)
    val cx = size / 2f

    val glowPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        shader = RadialGradient(
            cx,
            cx,
            cx,
            intArrayOf(
                0x553B82F6.toInt(),
                0x113B82F6.toInt(),
                android.graphics.Color.TRANSPARENT
            ),
            floatArrayOf(0.3f, 0.6f, 1f),
            Shader.TileMode.CLAMP
        )
    }
    canvas.drawCircle(cx, cx, cx, glowPaint)

    val whitePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = android.graphics.Color.WHITE
        setShadowLayer(8f, 0f, 2f, 0x44000000.toInt())
    }
    canvas.drawCircle(cx, cx, 36f, whitePaint)

    val bluePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = 0xFF3B82F6.toInt()
    }
    canvas.drawCircle(cx, cx, 26f, bluePaint)

    val highlightPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = 0x88FFFFFF.toInt()
    }
    canvas.drawCircle(cx - 7f, cx - 7f, 8f, highlightPaint)

    return BitmapDescriptorFactory.fromBitmap(bmp)
}

// ──────────────────────────────────────────────────────────────
// Main screen
// ──────────────────────────────────────────────────────────────
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
    val scope = rememberCoroutineScope()
    val focusManager = LocalFocusManager.current

    // Persist search query across recompositions / simple config changes.
    var searchQuery by rememberSaveable { mutableStateOf("") }
    var isSearchFocused by remember { mutableStateOf(false) }

    var userLocation by remember { mutableStateOf<Location?>(null) }
    var sheet by remember { mutableStateOf(HsSheet.HALF) }
    var dragOff by remember { mutableFloatStateOf(0f) }
    var timedOut by remember { mutableStateOf(false) }

    val locationPermissions = rememberMultiplePermissionsState(
        listOf(
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION
        )
    )

    // Request permissions once on first load.
    LaunchedEffect(Unit) {
        if (!locationPermissions.allPermissionsGranted) {
            locationPermissions.launchMultiplePermissionRequest()
        }
    }

    // Fetch current device location.
    // Retry a few times because location can often be null on first call.
    LaunchedEffect(locationPermissions.allPermissionsGranted) {
        if (!locationPermissions.allPermissionsGranted) return@LaunchedEffect

        val fusedClient = LocationServices.getFusedLocationProviderClient(context)
        repeat(10) {
            if (userLocation != null) return@repeat
            try {
                val cts = com.google.android.gms.tasks.CancellationTokenSource()
                val loc = fusedClient.getCurrentLocation(
                    com.google.android.gms.location.Priority.PRIORITY_HIGH_ACCURACY,
                    cts.token
                ).await()

                if (loc != null) {
                    userLocation = loc
                    return@repeat
                }
            } catch (_: Exception) {
                // Intentionally ignored.
                // If location fails once, retry without crashing the UI.
            }
            delay(3000L)
        }
    }

    // Sort chargers by nearest distance when location is available.
    val sortedChargers by remember(chargers, userLocation) {
        derivedStateOf {
            userLocation?.let { loc ->
                chargers.map { charger ->
                    charger.copy(
                        distanceKm = haversineKm(
                            loc.latitude,
                            loc.longitude,
                            charger.lat,
                            charger.lng
                        )
                    )
                }.sortedBy { it.distanceKm }
            } ?: chargers
        }
    }

    // Fast local suggestions for instant UX.
    // This is intentionally local and immediate, even before any parent/API search finishes.
    val searchSuggestions by remember(searchQuery, sortedChargers) {
        derivedStateOf {
            val q = searchQuery.trim()
            if (q.isBlank()) {
                emptyList()
            } else {
                sortedChargers.filter { charger ->
                    charger.name.contains(q, ignoreCase = true) ||
                            charger.address.contains(q, ignoreCase = true)
                }.take(MAX_SUGGESTIONS)
            }
        }
    }

    val showSearchSuggestions by remember(isSearchFocused, searchQuery) {
        derivedStateOf { isSearchFocused && searchQuery.isNotBlank() }
    }

    // Debounce parent search callback so heavy work / API calls do not fire on every key press.
    LaunchedEffect(searchQuery) {
        delay(SEARCH_DEBOUNCE_MS)
        onSearchChanged(searchQuery)
    }

    // Simple timeout state for empty charger response.
    LaunchedEffect(chargers) {
        if (chargers.isEmpty()) {
            timedOut = false
            delay(8000L)
            if (chargers.isEmpty()) timedOut = true
        } else {
            timedOut = false
        }
    }

    val sheetFrac by animateFloatAsState(
        targetValue = when (sheet) {
            HsSheet.FULL_MAP -> 0f
            HsSheet.COLLAPSED -> 0.13f
            HsSheet.HALF -> 0.50f
            HsSheet.EXPANDED -> 0.82f
        },
        animationSpec = spring(dampingRatio = 0.75f, stiffness = 300f),
        label = "sheetFrac"
    )

    val cam = rememberCameraPositionState {
        position = CameraPosition.fromLatLngZoom(LatLng(21.1458, 79.0882), 13f)
    }

    // Ask user to enable GPS if needed.
    val settingsLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.StartIntentSenderForResult()
    ) { }

    LaunchedEffect(locationPermissions.allPermissionsGranted) {
        if (!locationPermissions.allPermissionsGranted) return@LaunchedEffect
        try {
            val request = LocationRequest.Builder(
                com.google.android.gms.location.Priority.PRIORITY_HIGH_ACCURACY,
                5000L
            ).build()

            val settingsRequest = LocationSettingsRequest.Builder()
                .addLocationRequest(request)
                .setAlwaysShow(true)
                .build()

            LocationServices.getSettingsClient(context)
                .checkLocationSettings(settingsRequest)
                .addOnFailureListener { ex ->
                    if (ex is com.google.android.gms.common.api.ResolvableApiException) {
                        try {
                            settingsLauncher.launch(
                                IntentSenderRequest.Builder(ex.resolution.intentSender).build()
                            )
                        } catch (_: IntentSender.SendIntentException) {
                            // Ignore if dialog launch fails.
                        }
                    }
                }
        } catch (_: Exception) {
            // Ignore settings errors to avoid UI crash.
        }
    }

    // Initial camera animation to user location when available.
    LaunchedEffect(userLocation) {
        userLocation?.let { loc ->
            safeAnimateCamera(
                scope = scope,
                cameraAction = {
                    cam.animate(
                        CameraUpdateFactory.newLatLngZoom(
                            LatLng(loc.latitude, loc.longitude),
                            14f
                        ),
                        durationMs = 900
                    )
                }
            )
        }
    }

    val nearestIdle = remember(sortedChargers) {
        sortedChargers.firstOrNull { it.status == ChargerStatus.IDLE }
    }

    val infiniteTransition = rememberInfiniteTransition(label = "pulse")
    val pulseScale by infiniteTransition.animateFloat(
        initialValue = 0.92f,
        targetValue = 1.08f,
        animationSpec = infiniteRepeatable(
            animation = tween(900, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "pulseScale"
    )

    // Map content padding is what keeps the "current location" visually above the bottom sheet.
    val mapBottomPadding = (sheetFrac * 900 + 24).dp

    Box(modifier = modifier.fillMaxSize()) {

        GoogleMap(
            modifier = Modifier.fillMaxSize(),
            cameraPositionState = cam,
            contentPadding = PaddingValues(
                top = 96.dp,
                bottom = mapBottomPadding
            ),
            uiSettings = MapUiSettings(
                zoomControlsEnabled = false,
                myLocationButtonEnabled = false
            ),
            properties = MapProperties(isMyLocationEnabled = false)
        ) {
            val idleIcon = remember { plugboxMarkerBitmap(COLOR_IDLE) }
            val inUseIcon = remember { plugboxMarkerBitmap(COLOR_IN_USE) }
            val offlineIcon = remember { plugboxMarkerBitmap(COLOR_OFFLINE) }
            val reservedIcon = remember { plugboxMarkerBitmap(COLOR_RESERVED) }
            val userIcon = remember { userMarkerBitmap() }

            val loc = userLocation
            if (loc != null && nearestIdle != null) {
                Polyline(
                    points = listOf(
                        LatLng(loc.latitude, loc.longitude),
                        LatLng(nearestIdle.lat, nearestIdle.lng)
                    ),
                    color = MockBlue,
                    width = 8f,
                    pattern = listOf(
                        com.google.android.gms.maps.model.Dash(30f),
                        com.google.android.gms.maps.model.Gap(15f)
                    )
                )
            }

            sortedChargers.forEach { charger ->
                val icon = when (charger.status) {
                    ChargerStatus.IDLE -> idleIcon
                    ChargerStatus.IN_USE -> inUseIcon
                    ChargerStatus.RESERVED -> reservedIcon
                    ChargerStatus.OFFLINE -> offlineIcon
                }

                val markerState = remember(charger.id) {
                    MarkerState(LatLng(charger.lat, charger.lng))
                }

                Marker(
                    state = markerState,
                    title = charger.name,
                    snippet = charger.status.name,
                    icon = icon,
                    alpha = if (charger.status == ChargerStatus.IDLE) pulseScale else 1f,
                    zIndex = if (charger.status == ChargerStatus.IDLE) 2f else 1f,
                    onClick = {
                        onSelect(charger)
                        false
                    }
                )
            }

            if (loc != null) {
                val userMarkerState = remember(loc.latitude, loc.longitude) {
                    MarkerState(LatLng(loc.latitude, loc.longitude))
                }

                Marker(
                    state = userMarkerState,
                    title = "You are here",
                    icon = userIcon,
                    anchor = Offset(0.5f, 0.5f),
                    zIndex = 5f
                )
            }
        }

        HsSearchBar(
            query = searchQuery,
            onQueryChange = { searchQuery = it },
            onFocusChanged = { isSearchFocused = it },
            onFilterClick = onFilterClick,
            onClearClick = {
                searchQuery = ""
                isSearchFocused = false
                focusManager.clearFocus()
            },
            modifier = Modifier
                .fillMaxWidth()
                .statusBarsPadding()
                .padding(horizontal = 16.dp, vertical = 12.dp)
                .align(Alignment.TopCenter)
        )

        // Search overlay sits above the map and above the bottom sheet.
        // This gives the "product app" autocomplete behavior the user expects.
        if (showSearchSuggestions) {
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp)
                    .padding(top = 86.dp)
                    .align(Alignment.TopCenter),
                shape = RoundedCornerShape(18.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                elevation = CardDefaults.cardElevation(defaultElevation = 10.dp)
            ) {
                LazyColumn(
                    modifier = Modifier.heightIn(max = 320.dp),
                    contentPadding = PaddingValues(vertical = 8.dp)
                ) {
                    if (searchSuggestions.isEmpty()) {
                        item {
                            Text(
                                text = "No matching charging points",
                                modifier = Modifier.padding(horizontal = 16.dp, vertical = 16.dp),
                                color = MockGray,
                                fontSize = 14.sp
                            )
                        }
                    } else {
                        items(searchSuggestions, key = { it.id }) { charger ->
                            SearchSuggestionRow(
                                charger = charger,
                                onClick = {
                                    onSelect(charger)
                                    searchQuery = charger.name
                                    isSearchFocused = false
                                    focusManager.clearFocus()

                                    safeAnimateCamera(
                                        scope = scope,
                                        cameraAction = {
                                            cam.animate(
                                                CameraUpdateFactory.newLatLngZoom(
                                                    LatLng(charger.lat, charger.lng),
                                                    15f
                                                ),
                                                durationMs = 700
                                            )
                                        }
                                    )
                                }
                            )
                        }
                    }
                }
            }
        }

        // Hide the bottom sheet during suggestion mode.
        // This avoids keyboard + sheet + dropdown competing for the same space.
        if (!showSearchSuggestions && sheetFrac > 0f) {
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
                        selected = selected,
                        onSelect = onSelect,
                        onBookNow = onBookNow
                    )

                    timedOut -> HsErrorView(
                        onRetry = {
                            timedOut = false
                            searchQuery = ""
                            onSearchChanged("")
                        }
                    )

                    else -> HsLoadingView()
                }
            }
        }

        if (!showSearchSuggestions &&
            sheet != HsSheet.FULL_MAP &&
            locationPermissions.allPermissionsGranted
        ) {
            FloatingActionButton(
                onClick = {
                    userLocation?.let { loc ->
                        safeAnimateCamera(
                            scope = scope,
                            cameraAction = {
                                cam.animate(
                                    CameraUpdateFactory.newLatLngZoom(
                                        LatLng(loc.latitude, loc.longitude),
                                        15f
                                    ),
                                    durationMs = 700
                                )
                            }
                        )
                    }
                },
                modifier = Modifier
                    .align(Alignment.BottomEnd)
                    .padding(
                        end = 16.dp,
                        bottom = (sheetFrac * 900 + 16).dp.coerceAtLeast(80.dp)
                    ),
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

        if (!showSearchSuggestions && sheet == HsSheet.FULL_MAP) {
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

// ──────────────────────────────────────────────────────────────
// Safe camera launcher
// Prevents direct suspend-call misuse from click handlers.
// Also swallows animation cancellation without crashing UI.
// ──────────────────────────────────────────────────────────────
private fun safeAnimateCamera(
    scope: kotlinx.coroutines.CoroutineScope,
    cameraAction: suspend () -> Unit
) {
    scope.launch {
        try {
            cameraAction()
        } catch (_: Exception) {
            // Camera animation may be cancelled if user moves the map.
            // That should not crash the app.
        }
    }
}

// ──────────────────────────────────────────────────────────────
// Search suggestion row
// ──────────────────────────────────────────────────────────────
@Composable
private fun SearchSuggestionRow(
    charger: UiCharger,
    onClick: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 12.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(
                imageVector = Icons.Outlined.LocationOn,
                contentDescription = null,
                tint = MockBlue,
                modifier = Modifier.size(18.dp)
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                text = charger.name,
                color = MockTextMain,
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }

        Spacer(modifier = Modifier.height(4.dp))

        Text(
            text = charger.address,
            color = MockGray,
            fontSize = 13.sp,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(start = 26.dp)
        )
    }
}

// ──────────────────────────────────────────────────────────────
// Bottom-sheet charger list
// ──────────────────────────────────────────────────────────────
@Composable
private fun HsChargerList(
    chargers: List<UiCharger>,
    selected: UiCharger?,
    onSelect: (UiCharger) -> Unit,
    onBookNow: (UiCharger) -> Unit
) {
    val idle = remember(chargers) { chargers.filter { it.status == ChargerStatus.IDLE } }
    val rest = remember(chargers) { chargers.filter { it.status != ChargerStatus.IDLE } }

    LazyColumn(
        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 4.dp, bottom = 32.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        idle.firstOrNull()?.let { nearest ->
            item {
                HsNearestCard(
                    charger = nearest,
                    isSelected = selected?.id == nearest.id,
                    onBookNow = { onBookNow(nearest) }
                )
            }

            items(idle.drop(1), key = { it.id }) { charger ->
                HsChargerRow(
                    charger = charger,
                    isSelected = selected?.id == charger.id,
                    onClick = {
                        onSelect(charger)
                        onBookNow(charger)
                    }
                )
            }
        }

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

        items(rest, key = { it.id }) { charger ->
            HsChargerRow(
                charger = charger,
                isSelected = false,
                onClick = null
            )
        }
    }
}

// ──────────────────────────────────────────────────────────────
// Highlighted nearest available charger card
// ──────────────────────────────────────────────────────────────
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

            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = Icons.Outlined.LocationOn,
                    contentDescription = null,
                    tint = MockGray,
                    modifier = Modifier.size(14.dp)
                )
                Spacer(modifier = Modifier.width(3.dp))
                Text(
                    text = if (charger.distanceKm > 0.01) formatDistance(charger.distanceKm) else "Locating...",
                    fontSize = 13.sp,
                    color = MockGray
                )
            }

            Spacer(modifier = Modifier.height(10.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Surface(
                    color = MockGreen.copy(alpha = 0.12f),
                    shape = RoundedCornerShape(999.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(5.dp)
                    ) {
                        val inf = rememberInfiniteTransition(label = "nearestDot")
                        val alpha by inf.animateFloat(
                            initialValue = 0.25f,
                            targetValue = 1f,
                            animationSpec = infiniteRepeatable(
                                tween(700, easing = FastOutSlowInEasing),
                                RepeatMode.Reverse
                            ),
                            label = "nearestDotAlpha"
                        )

                        Box(
                            modifier = Modifier
                                .size(7.dp)
                                .clip(CircleShape)
                                .background(MockGreen.copy(alpha = alpha))
                        )

                        Text(
                            text = "Available Now",
                            color = MockGreen,
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 12.sp
                        )
                    }
                }

                Text(
                    text = charger.priceHint,
                    color = MockBlue,
                    fontWeight = FontWeight.Bold,
                    fontSize = 18.sp
                )
            }

            Spacer(modifier = Modifier.height(14.dp))

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

// ──────────────────────────────────────────────────────────────
// Standard charger row
// ──────────────────────────────────────────────────────────────
@Composable
private fun HsChargerRow(
    charger: UiCharger,
    isSelected: Boolean,
    onClick: (() -> Unit)?
) {
    val isIdle = charger.status == ChargerStatus.IDLE

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        border = androidx.compose.foundation.BorderStroke(
            width = if (isSelected) 1.4.dp else 1.dp,
            color = if (isSelected) MockBlue.copy(alpha = 0.30f) else Color(0xFFF1F5F9)
        ),
        onClick = { onClick?.invoke() }
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = charger.name,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 15.sp,
                    color = if (isIdle) MockTextMain else MockTextMain.copy(alpha = 0.45f),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )

                Spacer(modifier = Modifier.height(5.dp))

                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Outlined.LocationOn,
                        contentDescription = null,
                        tint = MockGray.copy(alpha = if (isIdle) 0.7f else 0.35f),
                        modifier = Modifier.size(13.dp)
                    )
                    Spacer(modifier = Modifier.width(3.dp))
                    Text(
                        text = if (charger.distanceKm > 0) formatDistance(charger.distanceKm) else charger.address,
                        fontSize = 12.sp,
                        color = MockGray.copy(alpha = if (isIdle) 0.7f else 0.35f)
                    )
                }
            }

            Spacer(modifier = Modifier.width(12.dp))
            HsStatusBadge(status = charger.status)
        }
    }
}

// ──────────────────────────────────────────────────────────────
// Availability badge
// ──────────────────────────────────────────────────────────────
@Composable
private fun HsStatusBadge(status: ChargerStatus) {
    val (label, color) = when (status) {
        ChargerStatus.IDLE -> "Available" to MockGreen
        ChargerStatus.IN_USE -> "In use" to MockOrange
        ChargerStatus.RESERVED -> "Reserved" to MockBlue
        ChargerStatus.OFFLINE -> "Offline" to MockGray
    }

    val dotAlpha = if (status == ChargerStatus.IDLE) {
        val inf = rememberInfiniteTransition(label = "idleDot")
        inf.animateFloat(
            initialValue = 0.25f,
            targetValue = 1f,
            animationSpec = infiniteRepeatable(
                tween(700, easing = FastOutSlowInEasing),
                RepeatMode.Reverse
            ),
            label = "dotAlpha"
        ).value
    } else {
        1f
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
                .background(color.copy(alpha = dotAlpha))
        )
    }
}

// ──────────────────────────────────────────────────────────────
// Loading state
// ──────────────────────────────────────────────────────────────
@Composable
private fun HsLoadingView() {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            CircularProgressIndicator(color = MockGreen)
            Text(
                text = "Finding chargers near you...",
                color = MockGray,
                fontSize = 14.sp
            )
        }
    }
}

// ──────────────────────────────────────────────────────────────
// Error state
// ──────────────────────────────────────────────────────────────
@Composable
private fun HsErrorView(onRetry: () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
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

// ──────────────────────────────────────────────────────────────
// Bottom-sheet drag handle
// ──────────────────────────────────────────────────────────────
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

// ──────────────────────────────────────────────────────────────
// Search bar
// Notes:
// - local UI focus state is used only for border styling
// - actual query state is hoisted to parent
// - clear button resets text and focus
// ──────────────────────────────────────────────────────────────
@Composable
private fun HsSearchBar(
    query: String,
    onQueryChange: (String) -> Unit,
    onFocusChanged: (Boolean) -> Unit,
    onFilterClick: () -> Unit,
    onClearClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    var isFocused by remember { mutableStateOf(false) }
    val focusManager = LocalFocusManager.current

    Surface(
        modifier = modifier,
        shape = RoundedCornerShape(18.dp),
        color = Color.White,
        shadowElevation = 10.dp
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(56.dp)
                .then(
                    if (isFocused) {
                        Modifier.border(
                            width = 1.dp,
                            color = MockBlue.copy(alpha = 0.28f),
                            shape = RoundedCornerShape(18.dp)
                        )
                    } else {
                        Modifier
                    }
                )
                .padding(horizontal = 16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = Icons.Default.Search,
                contentDescription = null,
                tint = MockGray,
                modifier = Modifier.size(20.dp)
            )

            Spacer(modifier = Modifier.width(10.dp))

            BasicTextField(
                value = query,
                onValueChange = onQueryChange,
                modifier = Modifier
                    .weight(1f)
                    .padding(vertical = 2.dp)
                    .onFocusChanged {
                        isFocused = it.isFocused
                        onFocusChanged(it.isFocused)
                    },
                singleLine = true,
                textStyle = TextStyle(
                    color = MockTextMain,
                    fontSize = 15.sp
                ),
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                keyboardActions = KeyboardActions(
                    onSearch = {
                        focusManager.clearFocus()
                    }
                ),
                decorationBox = { inner ->
                    Box(
                        modifier = Modifier.fillMaxWidth(),
                        contentAlignment = Alignment.CenterStart
                    ) {
                        if (query.isEmpty()) {
                            Text(
                                text = "Search charger / area",
                                color = MockGray,
                                fontSize = 15.sp
                            )
                        }
                        inner()
                    }
                }
            )

            if (query.isNotEmpty()) {
                IconButton(
                    onClick = {
                        onClearClick()
                        focusManager.clearFocus()
                    },
                    modifier = Modifier.size(32.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Close,
                        contentDescription = "Clear",
                        tint = MockGray,
                        modifier = Modifier.size(18.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.width(4.dp))

            IconButton(
                onClick = onFilterClick,
                modifier = Modifier.size(36.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.Tune,
                    contentDescription = "Filter",
                    tint = MockTextMain,
                    modifier = Modifier.size(20.dp)
                )
            }
        }
    }
}

// ──────────────────────────────────────────────────────────────
// Bottom-sheet snap logic
// ──────────────────────────────────────────────────────────────
private fun hsResolveSheet(current: HsSheet, drag: Float): HsSheet = when {
    drag < -80 -> when (current) {
        HsSheet.FULL_MAP, HsSheet.COLLAPSED -> HsSheet.HALF
        HsSheet.HALF -> HsSheet.EXPANDED
        HsSheet.EXPANDED -> HsSheet.EXPANDED
    }

    drag > 80 -> when (current) {
        HsSheet.EXPANDED -> HsSheet.HALF
        HsSheet.HALF -> HsSheet.COLLAPSED
        HsSheet.COLLAPSED, HsSheet.FULL_MAP -> HsSheet.FULL_MAP
    }

    else -> current
}