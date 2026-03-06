@file:OptIn(
    androidx.compose.material3.ExperimentalMaterial3Api::class
)

package com.example.plugbox.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Place
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material.icons.outlined.Tune
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.google.android.gms.maps.model.CameraPosition
import com.google.android.gms.maps.model.LatLng
import com.google.android.gms.maps.model.BitmapDescriptorFactory
import com.google.maps.android.compose.*


/**
Ye Compose UI screen banati hai jisme:
1] Background me Google Map dikh raha hai
2] Map pe chargers ke markers (pins) dikh rahe hain
3] Upar floating Search bar hai
4] Neeche Bottom Sheet hai (half open panel) jisme:
5] ek “Hero / Nearest charger” card aur chargers ki list

Matlab : Map + List + Search, sab ek screen me, Ye file sirf UI + “events” (click/type) ko callbacks se bahar bhejti hai bss

Surface               = card-like background
Row/Column            = layout
Modifier              = size/padding/alignment/style
Spacer                = gap
TextField             = input
IconButton            = clickable icon
TextOverflow.Ellipsis = text lamba ho to “...” laga do

Super-short mental model (is screen ko dimaag me kaise rakho):
Input (data)              : chargers list aati hai (ViewModel/backend se), selected optional aata hai.
State (screen ke andar)   : sirf search text local state hai (mutableStateOf("")).
Layout (UI structure)     : BottomSheetScaffold use karke 2 cheezein stack hoti hain:
Main layer                = Google Map (full screen)
Bottom sheet              = upar hero card + neeche chargers list
Map logic                 : har charger ke liye Marker lagta hai, status ke hisab se color change. Marker click → onSelect(c) + camera us marker pe zoom.
List logic                : LazyColumn me same chargers dikhte hain. Row click → onSelect(c).
User actions              :
                          Search type → search update + onSearchChanged(text)
                          Filter icon → onFilterClick()
                          “Book now” → onBookNow(charger)
Important point           : is file me booking/search/filter ka actual logic nahi hai. Ye sirf UI banata hai aur events callbacks se bahar bhejta hai (ViewModel/parent handle karega).
*/


/**
 * Requires:
 * - UiCharger has: id, name, address, lat, lng, status, distanceKm, priceHint
 * - ChargerStatus enum: IDLE, IN_USE, RESERVED, OFFLINE
 */
@Composable  // Compose me UI “function” se banti hai. Iska matlab: Ye function screen draw karega. Android XML ki jagah Compose me UI aise likhte hain.
fun HomeMapScreen(
    chargers: List<UiCharger>,               // data list (ViewModel/backend se aata hai)
    selected: UiCharger?,                   // currently selected charger (nullable ? means null ho sakta)
    onSelect: (UiCharger) -> Unit,         // jab user marker ya list row click kare, parent ko batana
    onBookNow: (UiCharger) -> Unit,
    onFilterClick: () -> Unit,
    onSearchChanged: (String) -> Unit,   // search type kare toh parent ko text dena
    modifier: Modifier = Modifier
) {

/** Map ka center kaise decide ho raha?

    agar chargers list me kuch hai → first charger ki location center nhi toh → Nagpur fallback
    remember(chargers) = chargers list change hogi tabhi center dobara calculate hoga
    Syntax samjho:
    firstOrNull() = first item ya null
    ?.let { ... } = agar null nahi hai tab run
    ?: = else (fallback)
 */

    val defaultCenter = remember(chargers) {
        chargers.firstOrNull()?.let { LatLng(it.lat, it.lng) } ?: LatLng(21.1458, 79.0882) // Nagpur fallback
    }

/**    Compose me UI bar-bar redraw hoti hai.
       Agar tum kisi value ko “yaad” rakhna chahte ho, remember use hota hai.
 */

    val cameraPositionState = rememberCameraPositionState {
        position = CameraPosition.fromLatLngZoom(defaultCenter, 13f)
    }

    val sheetState = rememberBottomSheetScaffoldState(
        bottomSheetState = rememberStandardBottomSheetState(
            initialValue = SheetValue.PartiallyExpanded,
            skipHiddenState = true
        )
    )

    var search by remember { mutableStateOf("") }

/**    search         = TextField me jo user type karta hai
       mutableStateOf = state (value change hote hi UI refresh)
       by             = Kotlin syntax jisse .value likhna nahi padta
 */

    BottomSheetScaffold(
        modifier = modifier.fillMaxSize(),
        scaffoldState = sheetState,
        sheetPeekHeight = 360.dp,
        sheetContainerColor = Color(0xFFF8FAFC),
        sheetShape = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp),
        sheetShadowElevation = 10.dp,
        sheetDragHandle = {
            // drag handle pill
            Box(
                Modifier
                    .fillMaxWidth()
                    .padding(top = 10.dp, bottom = 6.dp),
                contentAlignment = Alignment.Center
            ) {
                Box(
                    Modifier
                        .size(width = 44.dp, height = 5.dp)
                        .clip(RoundedCornerShape(999.dp))
                        .background(Color(0xFFCBD5E1))
                )
            }
        },
        sheetContent = {
            val hero = selected ?: chargers.firstOrNull()

            Column(
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp)
                    .padding(bottom = 18.dp)
            ) {
                Spacer(Modifier.height(6.dp))

                if (hero != null) {
                    HeroNearestCard(
                        charger = hero,
                        onPrimary = { onBookNow(hero) }
                    )
                    Spacer(Modifier.height(16.dp))
                }

                Text(
                    text = "Nearby chargers",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    color = Color(0xFF1E293B)
                )
                Spacer(Modifier.height(10.dp))

                // LazyColumn = list show karne ke liye (scrollable list)
                LazyColumn(
                    contentPadding = PaddingValues(bottom = 30.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    items(chargers, key = { it.id }) { c ->
                        NearbyRow(
                            charger = c,
                            onClick = { onSelect(c) }
                        )
                    }
                }
            }
        }
    ) { padding ->
        Box(Modifier.fillMaxSize().padding(padding)) {

           /*
           Map pe markers kaise lag rahe?
            GoogleMap(...) {
            chargers.forEach { c ->
                Marker(...)
            }
        }
            Har charger ke liye marker, Color status ke hisab se
            val hue = when (c.status) { ... }
            when = switch-case jaisa
                    status ke hisab se marker ka color set

           Marker click pe kya hota?
            onClick = {
                onSelect(c)
                cameraPositionState.position = CameraPosition.fromLatLngZoom(LatLng(c.lat,c.lng), 15f)
                true
            }
            selected update karne ke liye callback
                    camera zoom karke us marker pe focus
            true ka matlab: click event consume ho gaya
            */

            GoogleMap(
                modifier = Modifier.fillMaxSize(),
                cameraPositionState = cameraPositionState,
                uiSettings = MapUiSettings(
                    zoomControlsEnabled = false,
                    myLocationButtonEnabled = false
                ),
                properties = MapProperties(isMyLocationEnabled = false)
            ) {
                chargers.forEach { c ->
                    val hue = when (c.status) {
                        ChargerStatus.IDLE -> BitmapDescriptorFactory.HUE_GREEN
                        ChargerStatus.IN_USE -> BitmapDescriptorFactory.HUE_ORANGE
                        ChargerStatus.RESERVED -> BitmapDescriptorFactory.HUE_AZURE
                        ChargerStatus.OFFLINE -> BitmapDescriptorFactory.HUE_ROSE
                    }

                    Marker(
                        state = MarkerState(position = LatLng(c.lat, c.lng)),
                        title = c.name,
                        snippet = c.address,
                        icon = BitmapDescriptorFactory.defaultMarker(hue),
                        onClick = {
                            onSelect(c)
                            // gently move camera
                            cameraPositionState.position = CameraPosition.fromLatLngZoom(
                                LatLng(c.lat, c.lng),
                                15f
                            )
                            true
                        }
                    )
                }
            }

            // TOP SEARCH BAR OVER MAP (floating pill)
            TopSearchBar(
                value = search,
                onValueChange = {
                    search = it
                    onSearchChanged(it)
                },
                onFilterClick = onFilterClick,
                modifier = Modifier
                    .align(Alignment.TopCenter)
                    .padding(top = 14.dp)
                    .padding(horizontal = 14.dp)
            )
        }
    }
}

/* ---------------- UI pieces ---------------- */

@Composable
private fun TopSearchBar(
    value: String,
    onValueChange: (String) -> Unit,
    onFilterClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Surface(
        modifier = modifier
            .fillMaxWidth()
            .shadow(
                elevation = 12.dp,
                shape = RoundedCornerShape(14.dp),
                clip = false
            ),
        shape = RoundedCornerShape(14.dp),
        shadowElevation = 0.dp,
        tonalElevation = 0.dp,
        color = Color.White
    ) {
        Row(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(Icons.Outlined.Search, contentDescription = null, tint = Color(0xFF64748B), modifier = Modifier.size(20.dp))
            Spacer(Modifier.width(10.dp))

            TextField(
                value = value,
                onValueChange = onValueChange,
                placeholder = { Text("Search charger / area", color = Color(0xFFAEB9C8), style = MaterialTheme.typography.bodySmall) },
                singleLine = true,
                colors = TextFieldDefaults.colors(
                    focusedContainerColor = Color.Transparent,
                    unfocusedContainerColor = Color.Transparent,
                    disabledContainerColor = Color.Transparent,
                    focusedIndicatorColor = Color.Transparent,
                    unfocusedIndicatorColor = Color.Transparent,
                ),
                modifier = Modifier.weight(1f),
                textStyle = MaterialTheme.typography.bodySmall
            )

            Spacer(Modifier.width(8.dp))
            Box(
                Modifier
                    .height(28.dp)
                    .width(1.dp)
                    .background(Color(0xFFE2E8F0))
            )
            IconButton(onClick = onFilterClick, modifier = Modifier.size(40.dp)) {
                Icon(Icons.Outlined.Tune, contentDescription = "Filters", tint = Color(0xFF64748B))
            }
        }
    }
}

@Composable
private fun HeroNearestCard(
    charger: UiCharger,
    onPrimary: () -> Unit
) {
    val green = Color(0xFF16C784)
    val tintBg = Color(0xFFEBF9F4)

    Surface(
        shape = RoundedCornerShape(18.dp),
        color = tintBg,
        shadowElevation = 4.dp,
        tonalElevation = 0.dp,
        modifier = Modifier
            .fillMaxWidth()
            .border(1.5.dp, green, RoundedCornerShape(18.dp))
    ) {
        Column(Modifier.padding(16.dp)) {
            Text(
                "Nearest available now",
                color = Color(0xFF2563EB),
                fontWeight = FontWeight.SemiBold,
                style = MaterialTheme.typography.labelLarge,
                fontSize = androidx.compose.ui.unit.TextUnit(13f, androidx.compose.ui.unit.TextUnitType.Sp)
            )
            Spacer(Modifier.height(8.dp))

            Text(
                charger.name,
                fontWeight = FontWeight.Bold,
                style = MaterialTheme.typography.titleMedium,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                color = Color(0xFF1E293B)
            )

            Spacer(Modifier.height(10.dp))

            Row(
                Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    Modifier
                        .size(8.dp)
                        .clip(CircleShape)
                        .background(statusColor(charger.status))
                )
                Spacer(Modifier.width(6.dp))
                Text(
                    charger.status.name.replace('_', ' '),
                    fontWeight = FontWeight.Medium,
                    color = statusColor(charger.status),
                    style = MaterialTheme.typography.labelSmall
                )
                Spacer(Modifier.weight(1f))
                Text(
                    charger.priceHint,
                    fontWeight = FontWeight.SemiBold,
                    color = Color(0xFF2563EB),
                    style = MaterialTheme.typography.labelMedium
                )
            }

            Spacer(Modifier.height(12.dp))

            Button(
                onClick = onPrimary,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp),
                shape = RoundedCornerShape(999.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = green,
                    contentColor = Color.White
                ),
                contentPadding = PaddingValues(horizontal = 24.dp, vertical = 12.dp)
            ) {
                Text(
                    text = if (charger.status == ChargerStatus.IDLE) "Book now" else "View",
                    fontWeight = FontWeight.SemiBold,
                    style = MaterialTheme.typography.labelLarge
                )
            }
        }
    }
}

@Composable
private fun NearbyRow(
    charger: UiCharger,
    onClick: () -> Unit
) {
    Surface(
        onClick = onClick,
        shape = RoundedCornerShape(14.dp),
        color = Color.White,
        shadowElevation = 3.dp,
        tonalElevation = 0.dp,
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(Modifier.weight(1f)) {
                Text(
                    charger.name,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    style = MaterialTheme.typography.labelLarge,
                    color = Color(0xFF1E293B)
                )
                Spacer(Modifier.height(4.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        Icons.Outlined.Place,
                        contentDescription = null,
                        tint = Color(0xFF64748B),
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(Modifier.width(4.dp))
                    Text(
                        text = "${charger.distanceKm} km",
                        color = Color(0xFF64748B),
                        style = MaterialTheme.typography.labelSmall
                    )
                }
            }

            Spacer(Modifier.width(10.dp))

            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.weight(0.4f)
            ) {
                Box(
                    Modifier
                        .size(8.dp)
                        .clip(CircleShape)
                        .background(statusColor(charger.status))
                )
                Spacer(Modifier.width(6.dp))
                Text(
                    charger.status.name.replace('_', ' '),
                    color = statusColor(charger.status),
                    fontWeight = FontWeight.Medium,
                    style = MaterialTheme.typography.labelSmall,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }
    }
}

@Composable
private fun StatusDot(status: ChargerStatus) {
    Box(
        Modifier
            .size(8.dp)
            .clip(CircleShape)
            .background(statusColor(status))
    )
}

private fun statusColor(status: ChargerStatus): Color {
    return when (status) {
        ChargerStatus.IDLE -> Color(0xFF16C784)
        ChargerStatus.IN_USE -> Color(0xFFF59E0B)
        ChargerStatus.RESERVED -> Color(0xFF3B82F6)
        ChargerStatus.OFFLINE -> Color(0xFF94A3B8)
    }
}

