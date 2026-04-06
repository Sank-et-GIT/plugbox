// ─────────────────────────────────────────────────────────────────────────────
// ProfileScreen.kt
//
// PURPOSE:
//   User's control panel — account info, referral, preferences, support, logout.
//   Emotion: "This app knows me and I trust it."
//
// SECTIONS:
//   1. User info card  — initials avatar, name, phone, member since
//   2. Referral card   — invite friends, copy/share code, both get ₹25
//   3. Preferences     — notifications toggle
//   4. Support         — Help, Rate on Play Store, Share feedback
//   5. About           — Terms & Privacy
//   6. Account actions — Logout (neutral) + Delete account (red, dangerous)
//   7. Footer          — version + "Made in Nagpur 🧡"
//
// DATA:
//   Phase 1 → hardcoded dummy user data
//   Phase 2 → ApiClient.api.getProfile(userId)
//
// NAVIGATION:
//   Accessed from: Bottom nav Profile tab
//   No exits except Logout → LoginScreen, Delete → LoginScreen
// ─────────────────────────────────────────────────────────────────────────────

package com.example.plugbox.ui

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1 — Colors
// ─────────────────────────────────────────────────────────────────────────────

private val PcGreen         = Color(0xFF16C784)
private val PcGreenBg       = Color(0xFFECFDF5)
private val PcGreenDark     = Color(0xFF065F46)
private val PcBlue          = Color(0xFF3B82F6)
private val PcBlueBg        = Color(0xFFEFF6FF)
private val PcOrange        = Color(0xFFF59E0B)
private val PcOrangeBg      = Color(0xFFFFF7ED)
private val PcRed           = Color(0xFFEF4444)
private val PcRedBg         = Color(0xFFFEF2F2)
private val PcTextPrimary   = Color(0xFF111827)
private val PcTextSecondary = Color(0xFF6B7280)
private val PcDivider       = Color(0xFFE5E7EB)
private val PcWhite         = Color(0xFFFFFFFF)
private val PcSurface       = Color(0xFFF9FAFB)

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2 — Dummy user data
// Phase 2: ApiClient.api.getProfile(userId)
// ─────────────────────────────────────────────────────────────────────────────

private const val DUMMY_NAME         = "Sanket Raut"
private const val DUMMY_PHONE        = "+91 98765 43210"
private const val DUMMY_MEMBER_SINCE = "Member since Oct 2024"
private const val DUMMY_REFERRAL     = "SANKET50"
private const val APP_VERSION        = "1.0.0"

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3 — Main composable
// ─────────────────────────────────────────────────────────────────────────────

@Composable
fun ProfileScreen(
    onLogout:       () -> Unit = {},  // → LoginScreen
    onDeleteAccount:() -> Unit = {},  // → LoginScreen
    modifier:       Modifier   = Modifier
) {
    val context = LocalContext.current

    // Real user data from SharedPreferences (saved during login)
    val prefs       = remember {
        context.getSharedPreferences("plugbox_prefs", android.content.Context.MODE_PRIVATE)
    }
    val userName    = prefs.getString("user_name", "PlugBox User") ?: "PlugBox User"
    val userPhone   = prefs.getString("user_phone", "") ?: ""
    val memberSince = "Member since ${prefs.getString("member_since", "2024") ?: "2024"}"
    val referralCode = "PB${(prefs.getString("user_id", "USER") ?: "USER").take(6).uppercase()}"

    // Notifications toggle state
    // Phase 2: persist to DataStore + register/unregister FCM
    var notificationsEnabled by remember { mutableStateOf(true) }

    // Referral copy feedback
    var codeCopied by remember { mutableStateOf(false) }

    // Dialog states
    var showLogoutDialog by remember { mutableStateOf(false) }
    var showDeleteDialog by remember { mutableStateOf(false) }

    // ── Logout dialog ─────────────────────────────────────────────────────────
    if (showLogoutDialog) {
        AlertDialog(
            onDismissRequest = { showLogoutDialog = false },
            containerColor   = PcWhite,
            shape            = RoundedCornerShape(20.dp),
            icon = {
                Icon(Icons.Outlined.Logout, null,
                    tint = PcTextPrimary, modifier = Modifier.size(30.dp))
            },
            title = {
                Text("Log out?", fontWeight = FontWeight.Bold,
                    fontSize = 18.sp, color = PcTextPrimary,
                    textAlign = TextAlign.Center)
            },
            text = {
                Text("You'll need to verify your phone number to log back in.",
                    fontSize = 14.sp, color = PcTextSecondary,
                    textAlign = TextAlign.Center, lineHeight = 22.sp)
            },
            confirmButton = {
                Button(
                    onClick = { showLogoutDialog = false;
                        com.example.plugbox.network.ApiClient.logout(context)
                              onLogout()
                              },
                    colors  = ButtonDefaults.buttonColors(
                        containerColor = PcTextPrimary),
                    shape   = RoundedCornerShape(12.dp)
                ) { Text("Log out", fontWeight = FontWeight.Bold, color = PcWhite) }
            },
            dismissButton = {
                OutlinedButton(onClick = { showLogoutDialog = false },
                    shape = RoundedCornerShape(12.dp)) {
                    Text("Cancel", color = PcTextPrimary)
                }
            }
        )
    }

    // ── Delete account dialog ─────────────────────────────────────────────────
    if (showDeleteDialog) {
        AlertDialog(
            onDismissRequest = { showDeleteDialog = false },
            containerColor   = PcWhite,
            shape            = RoundedCornerShape(20.dp),
            icon = {
                Icon(Icons.Outlined.DeleteForever, null,
                    tint = PcRed, modifier = Modifier.size(30.dp))
            },
            title = {
                Text("Delete account?", fontWeight = FontWeight.Bold,
                    fontSize = 18.sp, color = PcTextPrimary,
                    textAlign = TextAlign.Center)
            },
            text = {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text("This will permanently delete your account, wallet balance, and all session history.",
                        fontSize = 14.sp, color = PcTextSecondary,
                        textAlign = TextAlign.Center, lineHeight = 22.sp)
                    Surface(
                        color  = PcRedBg,
                        shape  = RoundedCornerShape(10.dp),
                        border = androidx.compose.foundation.BorderStroke(
                            1.dp, PcRed.copy(alpha = 0.3f))
                    ) {
                        Text(
                            "Your security deposit ₹100 will be refunded to your bank account within 5 business days.",
                            fontSize  = 13.sp,
                            color     = PcRed,
                            textAlign = TextAlign.Center,
                            modifier  = Modifier.padding(10.dp),
                            lineHeight = 20.sp
                        )
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = { showDeleteDialog = false; onDeleteAccount() },
                    colors  = ButtonDefaults.buttonColors(containerColor = PcRed),
                    shape   = RoundedCornerShape(12.dp)
                ) { Text("Delete permanently", fontWeight = FontWeight.Bold,
                    color = PcWhite) }
            },
            dismissButton = {
                OutlinedButton(onClick = { showDeleteDialog = false },
                    shape = RoundedCornerShape(12.dp)) {
                    Text("Keep account", color = PcTextPrimary)
                }
            }
        )
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(PcSurface)
            .verticalScroll(rememberScrollState())
    ) {

        // Screen title
        Text(
            text       = "Profile",
            fontSize   = 26.sp,
            fontWeight = FontWeight.Bold,
            color      = PcTextPrimary,
            modifier   = Modifier
                .statusBarsPadding()
                .padding(horizontal = 16.dp, vertical = 16.dp)
        )

        // ── 1. User info card ──────────────────────────────────────────────
        PcUserCard(
            name        = userName,
            phone       = userPhone,
            memberSince = memberSince,
            modifier    = Modifier.padding(horizontal = 16.dp)
        )

        Spacer(Modifier.height(14.dp))

        // ── 2. Referral card ───────────────────────────────────────────────
        PcReferralCard(
            code      =  referralCode,
            copied    = codeCopied,
            onCopy    = {
                val clipboard = context.getSystemService(
                    Context.CLIPBOARD_SERVICE) as ClipboardManager
                clipboard.setPrimaryClip(
                    ClipData.newPlainText("Referral code", DUMMY_REFERRAL))
                codeCopied = true
            },
            onShare   = {
                val intent = Intent(Intent.ACTION_SEND).apply {
                    type = "text/plain"
                    putExtra(Intent.EXTRA_TEXT,
                        "Charge your EV with PlugBox! Use my code $DUMMY_REFERRAL " +
                                "and we both get ₹25 on your first charge. " +
                                "Download: https://plugbox.in")
                }
                context.startActivity(Intent.createChooser(intent, "Invite friends"))
            },
            modifier  = Modifier.padding(horizontal = 16.dp)
        )

        Spacer(Modifier.height(20.dp))

        // ── 3. Preferences ────────────────────────────────────────────────
        PcSectionHeader("Preferences")

        PcCard(modifier = Modifier.padding(horizontal = 16.dp)) {
            PcToggleRow(
                icon    = Icons.Outlined.Notifications,
                iconBg  = PcBlueBg,
                iconTint= PcBlue,
                label   = "Notifications",
                sub     = "Charging updates, wallet alerts",
                checked = notificationsEnabled,
                onToggle= { notificationsEnabled = it }
            )
        }

        Spacer(Modifier.height(20.dp))

        // ── 4. Support ────────────────────────────────────────────────────
        PcSectionHeader("Support")

        PcCard(modifier = Modifier.padding(horizontal = 16.dp)) {
            PcMenuRow(
                icon     = Icons.Outlined.SupportAgent,
                iconBg   = PcGreenBg,
                iconTint = PcGreen,
                label    = "Help & Support",
                sub      = "FAQs, report an issue",
                onClick  = { /* Phase 2: open support chat / webview */ }
            )
            PcDividerRow()
            PcMenuRow(
                icon     = Icons.Outlined.StarOutline,
                iconBg   = PcOrangeBg,
                iconTint = PcOrange,
                label    = "Rate PlugBox",
                sub      = "Enjoying the app? Leave a review",
                onClick  = {
                    // Phase 2: open Play Store listing
                    val intent = Intent(Intent.ACTION_VIEW).apply {
                        data = android.net.Uri.parse(
                            "market://details?id=com.example.plugbox")
                    }
                    runCatching { context.startActivity(intent) }
                }
            )
            PcDividerRow()
            PcMenuRow(
                icon     = Icons.Outlined.Feedback,
                iconBg   = PcBlueBg,
                iconTint = PcBlue,
                label    = "Share feedback",
                sub      = "Help us improve PlugBox",
                onClick  = {
                    val intent = Intent(Intent.ACTION_SEND).apply {
                        type = "text/plain"
                        putExtra(Intent.EXTRA_EMAIL, arrayOf("hello@plugbox.in"))
                        putExtra(Intent.EXTRA_SUBJECT, "PlugBox Feedback")
                    }
                    runCatching {
                        context.startActivity(
                            Intent.createChooser(intent, "Send feedback"))
                    }
                }
            )
        }

        Spacer(Modifier.height(20.dp))

        // ── 5. About ──────────────────────────────────────────────────────
        PcSectionHeader("About")

        PcCard(modifier = Modifier.padding(horizontal = 16.dp)) {
            PcMenuRow(
                icon     = Icons.Outlined.Article,
                iconBg   = PcSurface,
                iconTint = PcTextSecondary,
                label    = "Terms & Privacy Policy",
                onClick  = { /* Phase 2: open webview */ }
            )
            PcDividerRow()
            // Version — no chevron, not tappable
            Row(
                modifier          = Modifier.padding(horizontal = 16.dp, vertical = 14.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .clip(CircleShape)
                        .background(PcSurface),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Outlined.Info, null,
                        tint     = PcTextSecondary,
                        modifier = Modifier.size(18.dp))
                }
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text("App version", fontSize = 14.sp,
                        fontWeight = FontWeight.Medium, color = PcTextPrimary)
                }
                Text("v$APP_VERSION", fontSize = 13.sp, color = PcTextSecondary)
            }
        }

        Spacer(Modifier.height(20.dp))

        // ── 6. Account actions ────────────────────────────────────────────
        PcSectionHeader("Account")

        PcCard(modifier = Modifier.padding(horizontal = 16.dp)) {
            // Logout — neutral, dark
            PcMenuRow(
                icon     = Icons.Outlined.Logout,
                iconBg   = PcSurface,
                iconTint = PcTextPrimary,
                label    = "Log out",
                onClick  = { showLogoutDialog = true },
                showChevron = false
            )
        }

        Spacer(Modifier.height(10.dp))

        // Delete — separate card, red, visually isolated from Logout
        PcCard(modifier = Modifier.padding(horizontal = 16.dp)) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 14.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .clip(CircleShape)
                        .background(PcRedBg),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Outlined.DeleteForever, null,
                        tint     = PcRed,
                        modifier = Modifier.size(18.dp))
                }
                Spacer(Modifier.width(12.dp))
                TextButton(
                    onClick = { showDeleteDialog = true },
                    contentPadding = PaddingValues(0.dp)
                ) {
                    Text("Delete account", fontSize = 14.sp,
                        fontWeight = FontWeight.Medium, color = PcRed)
                }
            }
        }

        Spacer(Modifier.height(28.dp))

        // ── 7. Footer ─────────────────────────────────────────────────────
        Text(
            text      = "PlugBox v$APP_VERSION · Made in Nagpur 🧡",
            fontSize  = 12.sp,
            color     = PcTextSecondary.copy(alpha = 0.6f),
            textAlign = TextAlign.Center,
            modifier  = Modifier
                .fillMaxWidth()
                .padding(bottom = 24.dp)
        )
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4 — User info card
// Initials avatar in green circle — no camera, no permissions, clean
// ─────────────────────────────────────────────────────────────────────────────

@Composable
private fun PcUserCard(
    name:        String,
    phone:       String,
    memberSince: String,
    modifier:    Modifier = Modifier
) {
    // Generate initials — "Sanket Raut" → "SR"
    val initials = name.split(" ")
        .take(2)
        .mapNotNull { it.firstOrNull()?.uppercaseChar() }
        .joinToString("")

    Surface(
        modifier        = modifier.fillMaxWidth(),
        shape           = RoundedCornerShape(20.dp),
        color           = PcWhite,
        shadowElevation = 3.dp,
        border          = androidx.compose.foundation.BorderStroke(1.dp, PcDivider)
    ) {
        Row(
            modifier          = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Initials avatar
            Box(
                modifier = Modifier
                    .size(60.dp)
                    .clip(CircleShape)
                    .background(PcGreen),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text       = initials,
                    fontSize   = 22.sp,
                    fontWeight = FontWeight.Bold,
                    color      = PcWhite
                )
            }

            Column {
                Text(name, fontSize = 18.sp,
                    fontWeight = FontWeight.Bold, color = PcTextPrimary)
                Spacer(Modifier.height(3.dp))
                Text(phone, fontSize = 14.sp, color = PcTextSecondary)
                Spacer(Modifier.height(3.dp))
                // Member since — small trust signal
                Row(
                    verticalAlignment     = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    Icon(Icons.Outlined.Verified, null,
                        tint     = PcGreen,
                        modifier = Modifier.size(13.dp))
                    Text(memberSince, fontSize = 12.sp, color = PcGreen)
                }
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5 — Referral card
// PlugBox's primary growth tool — EV owners know other EV owners
// Phase 2: real referral tracking + credits
// ─────────────────────────────────────────────────────────────────────────────

@Composable
private fun PcReferralCard(
    code:     String,
    copied:   Boolean,
    onCopy:   () -> Unit,
    onShare:  () -> Unit,
    modifier: Modifier = Modifier
) {
    Surface(
        modifier = modifier.fillMaxWidth(),
        shape    = RoundedCornerShape(16.dp),
        color    = PcGreenBg,
        border   = androidx.compose.foundation.BorderStroke(
            1.dp, PcGreen.copy(alpha = 0.25f))
    ) {
        Column(Modifier.padding(16.dp)) {

            Row(
                verticalAlignment     = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Text("🎁", fontSize = 18.sp)
                Column {
                    Text("Invite & Earn", fontSize = 15.sp,
                        fontWeight = FontWeight.Bold, color = PcGreenDark)
                    Text("Both get ₹25 on their first charge",
                        fontSize = 12.sp, color = PcTextSecondary)
                }
            }

            Spacer(Modifier.height(12.dp))

            // Referral code pill
            Row(
                modifier          = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                // Code display
                Surface(
                    modifier = Modifier.weight(1f),
                    shape    = RoundedCornerShape(10.dp),
                    color    = PcWhite,
                    border   = androidx.compose.foundation.BorderStroke(
                        1.dp, PcGreen.copy(alpha = 0.3f))
                ) {
                    Text(
                        text       = code,
                        fontSize   = 18.sp,
                        fontWeight = FontWeight.Bold,
                        color      = PcGreen,
                        letterSpacing = 3.sp,
                        modifier   = Modifier.padding(
                            horizontal = 14.dp, vertical = 10.dp)
                    )
                }

                // Copy button
                OutlinedButton(
                    onClick  = onCopy,
                    shape    = RoundedCornerShape(10.dp),
                    border   = androidx.compose.foundation.BorderStroke(
                        1.dp, PcGreen),
                    colors   = ButtonDefaults.outlinedButtonColors(
                        contentColor = PcGreen),
                    contentPadding = PaddingValues(horizontal = 14.dp, vertical = 10.dp)
                ) {
                    Icon(
                        if (copied) Icons.Outlined.Check else Icons.Outlined.ContentCopy,
                        null, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(4.dp))
                    Text(if (copied) "Copied!" else "Copy",
                        fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                }

                // Share button
                Button(
                    onClick  = onShare,
                    shape    = RoundedCornerShape(10.dp),
                    colors   = ButtonDefaults.buttonColors(
                        containerColor = PcGreen, contentColor = PcWhite),
                    contentPadding = PaddingValues(horizontal = 14.dp, vertical = 10.dp)
                ) {
                    Icon(Icons.Outlined.Share, null, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(4.dp))
                    Text("Share", fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                }
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 6 — Reusable helpers
// ─────────────────────────────────────────────────────────────────────────────

// Section header — small gray label above each card group
@Composable
private fun PcSectionHeader(title: String) {
    Text(
        text       = title,
        fontSize   = 12.sp,
        fontWeight = FontWeight.SemiBold,
        color      = PcTextSecondary,
        modifier   = Modifier.padding(
            horizontal = 20.dp, vertical = 6.dp)
    )
}

// White rounded card container
@Composable
private fun PcCard(
    modifier:  Modifier = Modifier,
    content:   @Composable ColumnScope.() -> Unit
) {
    Surface(
        modifier        = modifier.fillMaxWidth(),
        shape           = RoundedCornerShape(16.dp),
        color           = PcWhite,
        shadowElevation = 2.dp,
        border          = androidx.compose.foundation.BorderStroke(1.dp, PcDivider)
    ) {
        Column(content = content)
    }
}

// Menu row with icon, label, optional subtitle, optional chevron
@Composable
private fun PcMenuRow(
    icon:        ImageVector,
    iconBg:      Color,
    iconTint:    Color,
    label:       String,
    sub:         String?  = null,
    showChevron: Boolean  = true,
    onClick:     () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(36.dp)
                .clip(CircleShape)
                .background(iconBg),
            contentAlignment = Alignment.Center
        ) {
            Icon(icon, null, tint = iconTint, modifier = Modifier.size(18.dp))
        }

        Spacer(Modifier.width(12.dp))

        Column(Modifier.weight(1f)) {
            Text(label, fontSize = 14.sp,
                fontWeight = FontWeight.Medium, color = PcTextPrimary)
            if (sub != null) {
                Spacer(Modifier.height(2.dp))
                Text(sub, fontSize = 12.sp, color = PcTextSecondary)
            }
        }

        if (showChevron) {
            Icon(Icons.Outlined.ChevronRight, null,
                tint     = PcTextSecondary,
                modifier = Modifier.size(20.dp))
        }
    }
}

// Toggle row — for settings with a Switch
@Composable
private fun PcToggleRow(
    icon:     ImageVector,
    iconBg:   Color,
    iconTint: Color,
    label:    String,
    sub:      String?  = null,
    checked:  Boolean,
    onToggle: (Boolean) -> Unit
) {
    Row(
        modifier          = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(36.dp)
                .clip(CircleShape)
                .background(iconBg),
            contentAlignment = Alignment.Center
        ) {
            Icon(icon, null, tint = iconTint, modifier = Modifier.size(18.dp))
        }

        Spacer(Modifier.width(12.dp))

        Column(Modifier.weight(1f)) {
            Text(label, fontSize = 14.sp,
                fontWeight = FontWeight.Medium, color = PcTextPrimary)
            if (sub != null) {
                Spacer(Modifier.height(2.dp))
                Text(sub, fontSize = 12.sp, color = PcTextSecondary)
            }
        }

        Switch(
            checked         = checked,
            onCheckedChange = onToggle,
            colors          = SwitchDefaults.colors(
                checkedThumbColor   = PcWhite,
                checkedTrackColor   = PcGreen,
                uncheckedThumbColor = PcWhite,
                uncheckedTrackColor = PcDivider
            )
        )
    }
}

// Thin divider between rows inside a card
@Composable
private fun PcDividerRow() {
    HorizontalDivider(
        modifier = Modifier.padding(start = 64.dp),
        color    = PcDivider
    )
}