@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
package com.example.plugbox.ui

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.layout.*
import androidx.compose.ui.Alignment

private enum class RootTab { HOME, WALLET, STATUS, PROFILE }

private val NavBlue    = Color(0xFF3B82F6)
private val NavBlueBg  = Color(0xFFE0E7FF)
private val NavGray    = Color(0xFF64748B)

@Composable
fun PlugBoxAppRoot(modifier: Modifier = Modifier) {
    var tab by remember { mutableStateOf(RootTab.HOME) }

    Scaffold(
        modifier = modifier,
        containerColor = Color(0xFFF6F8FB),
        bottomBar = {
            NavigationBar(
                containerColor = Color.White,
                tonalElevation = 0.dp
            ) {
                NavigationBarItem(
                    selected = tab == RootTab.HOME,
                    onClick = { tab = RootTab.HOME },
                    icon = {
                        Icon(
                            if (tab == RootTab.HOME) Icons.Filled.Home
                            else Icons.Outlined.Home,
                            contentDescription = null
                        )
                    },
                    label = { Text("Home") },
                    colors = navItemColors()
                )
                NavigationBarItem(
                    selected = tab == RootTab.WALLET,
                    onClick = { tab = RootTab.WALLET },
                    icon = {
                        Icon(
                            if (tab == RootTab.WALLET) Icons.Filled.AccountBalanceWallet
                            else Icons.Outlined.AccountBalanceWallet,
                            contentDescription = null
                        )
                    },
                    label = { Text("Wallet") },
                    colors = navItemColors()
                )
                NavigationBarItem(
                    selected = tab == RootTab.STATUS,
                    onClick = { tab = RootTab.STATUS },
                    icon = {
                        Icon(
                            if (tab == RootTab.STATUS) Icons.Filled.ElectricBolt
                            else Icons.Outlined.ElectricBolt,
                            contentDescription = null
                        )
                    },
                    label = { Text("Status") },
                    colors = navItemColors()
                )
                NavigationBarItem(
                    selected = tab == RootTab.PROFILE,
                    onClick = { tab = RootTab.PROFILE },
                    icon = {
                        Icon(
                            if (tab == RootTab.PROFILE) Icons.Filled.Person
                            else Icons.Outlined.Person,
                            contentDescription = null
                        )
                    },
                    label = { Text("Profile") },
                    colors = navItemColors()
                )
            }
        }
    ) { padding ->
        Box(modifier = Modifier.padding(padding)) {
            when (tab) {
                RootTab.HOME    -> PlugBoxHost(modifier = Modifier)
                RootTab.WALLET  -> WalletPlaceholder()
                RootTab.STATUS  -> StatusPlaceholder()
                RootTab.PROFILE -> ProfilePlaceholder()
            }
        }
    }
}

@Composable
private fun navItemColors() = NavigationBarItemDefaults.colors(
    selectedIconColor   = NavBlue,
    selectedTextColor   = NavBlue,
    indicatorColor      = NavBlueBg,
    unselectedIconColor = NavGray,
    unselectedTextColor = NavGray
)

@Composable
private fun WalletPlaceholder() {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text("💳", style = MaterialTheme.typography.displayMedium)
            Text("Wallet", style = MaterialTheme.typography.titleLarge)
            Text(
                "Your balance and transactions\nwill appear here",
                color = NavGray,
                textAlign = TextAlign.Center,
                modifier = androidx.compose.ui.Modifier.padding(horizontal = 40.dp)
            )
        }
    }
}

@Composable
private fun StatusPlaceholder() {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text("⚡", style = MaterialTheme.typography.displayMedium)
            Text("Charging Status", style = MaterialTheme.typography.titleLarge)
            Text(
                "Live charging time, kWh used\nand remaining will show here",
                color = NavGray,
                textAlign = TextAlign.Center,
                modifier = androidx.compose.ui.Modifier.padding(horizontal = 40.dp)
            )
        }
    }
}

@Composable
private fun ProfilePlaceholder() {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text("👤", style = MaterialTheme.typography.displayMedium)
            Text("Profile", style = MaterialTheme.typography.titleLarge)
            Text(
                "Your account and settings",
                color = NavGray,
                textAlign = TextAlign.Center
            )
        }
    }
}