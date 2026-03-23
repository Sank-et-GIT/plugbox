package com.example.plugbox.network

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import androidx.compose.runtime.Composable
import androidx.compose.runtime.State
import androidx.compose.runtime.produceState
import androidx.compose.ui.platform.LocalContext
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.distinctUntilChanged

// ─────────────────────────────────────────────────────────────
//  NETWORK STATUS
//  Checking     = startup, real state not yet known
//  Connected    = internet available and validated
//  Disconnected = no internet
// ─────────────────────────────────────────────────────────────
sealed class NetworkStatus {
    object Checking      : NetworkStatus()
    object Connected     : NetworkStatus()
    object Disconnected  : NetworkStatus()
}

// ─────────────────────────────────────────────────────────────
//  FLOW  (internal — used by rememberNetworkStatus below)
// ─────────────────────────────────────────────────────────────
fun Context.observeNetworkStatus() = callbackFlow<NetworkStatus> {

    val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager

    // Read real state synchronously right now — this prevents the
    // "Checking → Disconnected flash" seen with async-only approaches
    trySend(
        if (cm.isConnectedNow()) NetworkStatus.Connected
        else NetworkStatus.Disconnected
    )

    val callback = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) {
            trySend(NetworkStatus.Connected)
        }
        override fun onLost(network: Network) {
            if (!cm.isConnectedNow()) trySend(NetworkStatus.Disconnected)
        }
        override fun onUnavailable() {
            trySend(NetworkStatus.Disconnected)
        }
    }

    cm.registerNetworkCallback(
        NetworkRequest.Builder()
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .addCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
            .build(),
        callback
    )

    awaitClose { cm.unregisterNetworkCallback(callback) }

}.distinctUntilChanged()

// ─────────────────────────────────────────────────────────────
//  SYNCHRONOUS CHECK HELPER
// ─────────────────────────────────────────────────────────────
fun ConnectivityManager.isConnectedNow(): Boolean {
    val caps = getNetworkCapabilities(activeNetwork ?: return false) ?: return false
    return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
            caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
}

// ─────────────────────────────────────────────────────────────
//  COMPOSE HELPER
//  initialValue = Checking prevents the offline flash.
//  No ViewModel, no extra Gradle dependency needed.
// ─────────────────────────────────────────────────────────────
@Composable
fun rememberNetworkStatus(): State<NetworkStatus> {
    val context = LocalContext.current
    return produceState<NetworkStatus>(initialValue = NetworkStatus.Checking) {
        context.observeNetworkStatus().collect { value = it }
    }
}
