package com.example.plugbox

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.example.plugbox.network.ApiClient
import com.example.plugbox.network.Charger
import com.example.plugbox.network.HoldRequest
import com.example.plugbox.network.StartRequest
import com.example.plugbox.network.StopRequest
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                Surface(Modifier.fillMaxSize()) {
                    PlugBoxScreen()
                }
            }
        }
    }
}

@Composable
fun PlugBoxScreen() {
    val scope = rememberCoroutineScope()

    var healthText by remember { mutableStateOf("Not checked") }
    var chargers by remember { mutableStateOf<List<Charger>>(emptyList()) }
    var selected by remember { mutableStateOf<Charger?>(null) }

    var holdResult by remember { mutableStateOf("—") }
    var startResult by remember { mutableStateOf("—") }
    var stopResult by remember { mutableStateOf("—") }

    var sessionId by remember { mutableStateOf<Int?>(null) }

    val userId = "rashi"

    Column(Modifier.padding(16.dp)) {

        Text("PlugBox Android Demo", style = MaterialTheme.typography.titleLarge)
        Spacer(Modifier.height(12.dp))

        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Button(
                onClick = {
                    scope.launch {
                        try {
                            val res = ApiClient.api.health()
                            healthText = "OK (${res.status})"
                        } catch (e: Exception) {
                            healthText = "ERROR: ${e.message}"
                        }
                    }
                },
                modifier = Modifier.weight(1f)
            ) { Text("Health") }

            Button(
                onClick = {
                    scope.launch {
                        try {
                            val res = ApiClient.api.chargers()
                            chargers = res.chargers
                            selected = chargers.firstOrNull()
                        } catch (e: Exception) {
                            chargers = emptyList()
                        }
                    }
                },
                modifier = Modifier.weight(1f)
            ) { Text("Load Chargers") }
        }

        Spacer(Modifier.height(10.dp))
        Text("Server: $healthText")

        Spacer(Modifier.height(16.dp))

        Text("Chargers (tap to select)", style = MaterialTheme.typography.titleMedium)
        Spacer(Modifier.height(8.dp))

        if (chargers.isEmpty()) {
            Text("No chargers loaded yet.")
        } else {
            LazyColumn(
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(max = 240.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(chargers) { c ->
                    ChargerRow(
                        charger = c,
                        isSelected = (selected?.id == c.id),
                        onClick = { selected = c }
                    )
                }
            }
        }

        Spacer(Modifier.height(12.dp))
        Text("Selected: " + (selected?.let { "${it.name} (id=${it.id})" } ?: "None"))

        Spacer(Modifier.height(16.dp))

        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {

            Button(
                enabled = (selected != null),
                onClick = {
                    scope.launch {
                        holdResult = "Working..."
                        try {
                            val cid = selected!!.id
                            val res = ApiClient.api.hold(HoldRequest(chargerId = cid, userId = userId))
                            holdResult = "Hold OK ✅ bookingId=${res.booking.id} (expiresAt=${res.booking.expiresAt})"
                        } catch (e: Exception) {
                            holdResult = "Hold ERROR: ${e.message}"
                        }
                    }
                },
                modifier = Modifier.weight(1f)
            ) { Text("Hold") }

            Button(
                enabled = (selected != null),
                onClick = {
                    scope.launch {
                        startResult = "Working..."
                        try {
                            val cid = selected!!.id
                            val res = ApiClient.api.start(StartRequest(chargerId = cid, userId = userId))
                            sessionId = res.sessionId
                            startResult = "Start OK ✅ sessionId=${res.sessionId}"
                        } catch (e: Exception) {
                            startResult = "Start ERROR: ${e.message}"
                        }
                    }
                },
                modifier = Modifier.weight(1f)
            ) { Text("Start") }

            Button(
                enabled = (sessionId != null),
                onClick = {
                    scope.launch {
                        stopResult = "Working..."
                        try {
                            val sid = sessionId!!
                            val res = ApiClient.api.stop(StopRequest(sessionId = sid))
                            stopResult = if (res.ok) "Stop OK ✅ sessionId=$sid" else "Stop FAIL ❌"
                        } catch (e: Exception) {
                            stopResult = "Stop ERROR: ${e.message}"
                        }
                    }
                },
                modifier = Modifier.weight(1f)
            ) { Text("Stop") }
        }

        Spacer(Modifier.height(16.dp))
        Divider()
        Spacer(Modifier.height(12.dp))

        Text("Results", style = MaterialTheme.typography.titleMedium)
        Spacer(Modifier.height(8.dp))

        Text("Hold: $holdResult")
        Text("Start: $startResult")
        Text("Stop: $stopResult")

        Spacer(Modifier.height(10.dp))
        Text(
            "Tip: Hold expires in ~2 minutes. If Start says no active hold, press Hold then Start quickly.",
            style = MaterialTheme.typography.bodySmall
        )
    }
}

@Composable
private fun ChargerRow(charger: Charger, isSelected: Boolean, onClick: () -> Unit) {
    val label = "${charger.name}  •  ${charger.status.trim()}  •  id=${charger.id}"

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() },
        colors = CardDefaults.cardColors(
            containerColor = if (isSelected) MaterialTheme.colorScheme.primaryContainer
            else MaterialTheme.colorScheme.surfaceVariant
        )
    ) {
        Column(Modifier.padding(12.dp)) {
            Text(label)
            Spacer(Modifier.height(4.dp))
            Text("lat=${charger.lat}, lng=${charger.lng}", style = MaterialTheme.typography.bodySmall)
        }
    }
}
