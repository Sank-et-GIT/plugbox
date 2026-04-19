// ─────────────────────────────────────────────────────────────────────────────
// PlugBoxAppRoot.kt
//
// ENTRY FLOW:
//   Fresh install:   Onboarding → Login → Welcome (1.5s) → Main
//   Returning user:  Main directly
//   Logged out:      Login → Welcome → Main
//
// FIX — Navigation state preservation:
//   Previously: when(tab) destroyed and recreated PlugBoxHost on every tab
//   switch, resetting screen/session/selected state back to LIST.
//   Fix: PlugBoxHost is ALWAYS in the composition tree. When tab != HOME it
//   is sized to 0dp (invisible, no touches) but never destroyed.
//   Result: session state, selected charger, screen position all survive
//   switching to Profile/Wallet/Status and back.
// ─────────────────────────────────────────────────────────────────────────────

@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
package com.example.plugbox.ui

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp

private enum class AppEntry { ONBOARDING, LOGIN, WELCOME, MAIN }
private enum class RootTab  { HOME, WALLET, STATUS, PROFILE }

private val NavGreen   = Color(0xFF16C784)
private val NavGreenBg = Color(0xFFECFDF5)
private val NavGray    = Color(0xFF64748B)

@Composable
fun PlugBoxAppRoot(modifier: Modifier = Modifier) {
    val context = LocalContext.current
    val prefs   = remember {
        context.getSharedPreferences("plugbox_prefs", android.content.Context.MODE_PRIVATE)
    }

    var entry by remember {
        mutableStateOf(
            when {
                !prefs.getBoolean("onboarding_done", false) -> AppEntry.ONBOARDING
                !prefs.getBoolean("logged_in", false)       -> AppEntry.LOGIN
                else                                        -> AppEntry.MAIN
            }
        )
    }

    when (entry) {
        AppEntry.ONBOARDING -> OnboardingScreen(
            onFinished = { entry = AppEntry.LOGIN }
        )
        AppEntry.LOGIN -> LoginScreen(
            onLoginSuccess = { entry = AppEntry.WELCOME }
        )
        AppEntry.WELCOME -> WelcomeScreen(
            onFinished = { entry = AppEntry.MAIN }
        )
        AppEntry.MAIN -> MainTabs(
            onLogout = {
                prefs.edit().putBoolean("logged_in", false).apply()
                entry = AppEntry.LOGIN
            }
        )
    }
}

@Composable
private fun MainTabs(onLogout: () -> Unit) {
    var tab by remember { mutableStateOf(RootTab.HOME) }

    Scaffold(
        containerColor = Color(0xFFF6F8FB),
        bottomBar = {
            NavigationBar(
                containerColor = Color.White,
                tonalElevation = 0.dp
            ) {
                NavigationBarItem(
                    selected = tab == RootTab.HOME,
                    onClick  = { tab = RootTab.HOME },
                    icon     = {
                        Icon(if (tab == RootTab.HOME) Icons.Filled.Home
                        else Icons.Outlined.Home, null)
                    },
                    label  = { Text("Home") },
                    colors = navItemColors()
                )
                NavigationBarItem(
                    selected = tab == RootTab.WALLET,
                    onClick  = { tab = RootTab.WALLET },
                    icon     = {
                        Icon(if (tab == RootTab.WALLET) Icons.Filled.AccountBalanceWallet
                        else Icons.Outlined.AccountBalanceWallet, null)
                    },
                    label  = { Text("Wallet") },
                    colors = navItemColors()
                )
                NavigationBarItem(
                    selected = tab == RootTab.STATUS,
                    onClick  = { tab = RootTab.STATUS },
                    icon     = {
                        Icon(if (tab == RootTab.STATUS) Icons.Filled.ElectricBolt
                        else Icons.Outlined.ElectricBolt, null)
                    },
                    label  = { Text("Status") },
                    colors = navItemColors()
                )
                NavigationBarItem(
                    selected = tab == RootTab.PROFILE,
                    onClick  = { tab = RootTab.PROFILE },
                    icon     = {
                        Icon(if (tab == RootTab.PROFILE) Icons.Filled.Person
                        else Icons.Outlined.Person, null)
                    },
                    label  = { Text("Profile") },
                    colors = navItemColors()
                )
            }
        }
    ) { padding ->
        Box(Modifier.padding(padding).fillMaxSize()) {

            // ── HOME — always in composition tree, never destroyed ─────────────
            // When another tab is selected, PlugBoxHost is shrunk to 0×0 dp so
            // it is invisible and receives no touch events, but all its internal
            // state (screen, sessionId, selected charger) is preserved.
            // When the user taps Home again it instantly reappears with the
            // exact state it had before — no API re-fetch, no session loss.
            PlugBoxHost(
                modifier = Modifier
                    .then(
                        if (tab == RootTab.HOME) Modifier.fillMaxSize()
                        else Modifier.requiredSize(0.dp)   // invisible + no touches
                    )
            )

            // ── Other tabs — created fresh on demand ───────────────────────────
            // These screens always reload their data from the API when shown,
            // so fresh-on-demand is the correct behaviour for them.
            when (tab) {
                RootTab.WALLET -> WalletScreen()

                RootTab.STATUS -> StatusScreen(
                    onIveArrived    = {
                        // Navigate home tab to session flow
                        tab = RootTab.HOME
                    },
                    onCancelBooking = {
                        tab = RootTab.HOME
                    }
                )

                RootTab.PROFILE -> ProfileScreen(
                    onLogout        = onLogout,
                    onDeleteAccount = onLogout
                )

                RootTab.HOME -> { /* handled by PlugBoxHost above */ }
            }
        }
    }
}

@Composable
private fun navItemColors() = NavigationBarItemDefaults.colors(
    selectedIconColor   = NavGreen,
    selectedTextColor   = NavGreen,
    indicatorColor      = NavGreenBg,
    unselectedIconColor = NavGray,
    unselectedTextColor = NavGray
)