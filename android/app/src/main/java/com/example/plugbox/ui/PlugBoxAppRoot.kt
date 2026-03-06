@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
package com.example.plugbox.ui

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AccountBalanceWallet
import androidx.compose.material.icons.outlined.Map
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

private enum class RootTab { HOME, WALLET, PROFILE }

@Composable
fun PlugBoxAppRoot(modifier: Modifier = Modifier) {
    var tab by remember { mutableStateOf(RootTab.HOME) }

    Scaffold(
        modifier = modifier,
        bottomBar = {
            NavigationBar(
                containerColor = Color.White,
                tonalElevation = 8.dp
            ) {
                NavigationBarItem(
                    selected = tab == RootTab.HOME,
                    onClick = { tab = RootTab.HOME },
                    icon = { Icon(Icons.Outlined.Map, contentDescription = null) },
                    label = { Text("Home") },
                    colors = NavigationBarItemDefaults.colors(
                        selectedIconColor = Color(0xFF2563EB),
                        selectedTextColor = Color(0xFF2563EB),
                        indicatorColor = Color(0xFFE0E7FF),
                        unselectedIconColor = Color(0xFF64748B),
                        unselectedTextColor = Color(0xFF64748B)
                    )
                )
                NavigationBarItem(
                    selected = tab == RootTab.WALLET,
                    onClick = { tab = RootTab.WALLET },
                    icon = { Icon(Icons.Outlined.AccountBalanceWallet, contentDescription = null) },
                    label = { Text("Wallet") },
                    colors = NavigationBarItemDefaults.colors(
                        selectedIconColor = Color(0xFF2563EB),
                        selectedTextColor = Color(0xFF2563EB),
                        indicatorColor = Color(0xFFE0E7FF),
                        unselectedIconColor = Color(0xFF64748B),
                        unselectedTextColor = Color(0xFF64748B)
                    )
                )
                NavigationBarItem(
                    selected = tab == RootTab.PROFILE,
                    onClick = { tab = RootTab.PROFILE },
                    icon = { Icon(Icons.Outlined.Person, contentDescription = null) },
                    label = { Text("Profile") },
                    colors = NavigationBarItemDefaults.colors(
                        selectedIconColor = Color(0xFF2563EB),
                        selectedTextColor = Color(0xFF2563EB),
                        indicatorColor = Color(0xFFE0E7FF),
                        unselectedIconColor = Color(0xFF64748B),
                        unselectedTextColor = Color(0xFF64748B)
                    )
                )
            }
        }
    ) { padding ->
        when (tab) {
            RootTab.HOME -> PlugBoxHost(modifier = Modifier)
            RootTab.WALLET -> WalletScreen()
            RootTab.PROFILE -> ProfileScreen()
        }
    }
}

@Composable
private fun WalletScreen() {
    // TODO: replace later with real wallet UI
    Surface { Text("Wallet (coming soon)") }
}

@Composable
private fun ProfileScreen() {
    // TODO: replace later with real profile UI
    Surface { Text("Profile (coming soon)") }
}