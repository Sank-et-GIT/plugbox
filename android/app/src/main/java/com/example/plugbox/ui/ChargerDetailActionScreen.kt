/*
package com.example.plugbox.ui

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.shape.RoundedCornerShape

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChargerDetailActionScreen(
    charger: UiCharger,
    connected: Boolean,
    holdOk: Boolean,
    chargingActive: Boolean,
    onBack: () -> Unit,
    onHold: () -> Unit,
    onStart: () -> Unit,
    onStop: () -> Unit
) {
    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = { Text("Charger details") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Outlined.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        },
        bottomBar = {
            Surface(shadowElevation = 10.dp, color = MaterialTheme.colorScheme.background) {
                Column(Modifier.padding(16.dp)) {
                    val holdEnabled = connected && !holdOk && !chargingActive
                    val startEnabled = connected && holdOk && !chargingActive
                    val stopEnabled = connected && chargingActive

                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        OutlinedButton(
                            onClick = onHold,
                            enabled = holdEnabled,
                            modifier = Modifier.weight(1f).height(54.dp),
                            shape = RoundedCornerShape(999.dp)
                        ) { Text("Hold") }

                        Button(
                            onClick = onStart,
                            enabled = startEnabled,
                            modifier = Modifier.weight(1f).height(54.dp),
                            shape = RoundedCornerShape(999.dp)
                        ) { Text("Start") }
                    }

                    Spacer(Modifier.height(10.dp))

                    PrimaryButton(
                        text = "Stop",
                        tone = ButtonTone.Danger,
                        enabled = stopEnabled,
                        onClick = onStop
                    )
                }
            }
        }
    ) { padding ->
        Column(Modifier.padding(padding).padding(16.dp)) {
            CardSurface(Modifier.fillMaxWidth()) {
                Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(charger.name, style = MaterialTheme.typography.titleLarge)
                        Spacer(Modifier.height(6.dp))
                        Text(charger.address, color = androidx.compose.ui.graphics.Color(0xFF64748B))
                    }
                    StatusChip(charger.status)
                }
            }
        }
    }
}*/
