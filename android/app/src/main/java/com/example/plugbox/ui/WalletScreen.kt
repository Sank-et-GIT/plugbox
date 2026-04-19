// ─────────────────────────────────────────────────────────────────────────────
// WalletScreen.kt
//
// PURPOSE:
//   User's financial hub — balance, deposit info, quick top-up, transaction history.
//
// DESIGN DECISIONS:
//   • Green gradient balance card — feels like energy credit, not a bank statement
//   • Add Money is the only primary button — full width, dominant
//   • Withdraw is a tiny secondary text link — correct 90/2% usage ratio
//   • Deposit explained once, clearly, inside the balance card
//   • Transactions grouped by date: Today / Yesterday / Earlier
//   • Section break between action zone and history zone
//
// DATA:
//   Phase 1 → hardcoded dummy data
//   Phase 2 → ApiClient.api.getWallet(userId) + ApiClient.api.getTransactions(userId)
//
// INSUFFICIENT BALANCE SHEET:
//   Public composable WcInsufficientSheet — also called from ChargerDetailScreen
// ─────────────────────────────────────────────────────────────────────────────

package com.example.plugbox.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.platform.LocalContext
import com.example.plugbox.network.ApiClient
import kotlinx.coroutines.launch
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1 — Colors
// ─────────────────────────────────────────────────────────────────────────────

private val WcGreen         = Color(0xFF16C784)
private val WcGreenMid      = Color(0xFF0FA96D)  // gradient middle
private val WcGreenDark     = Color(0xFF065F46)  // gradient end + text on green
private val WcGreenBg       = Color(0xFFECFDF5)
private val WcBlue          = Color(0xFF3B82F6)
private val WcBlueBg        = Color(0xFFEFF6FF)
private val WcOrange        = Color(0xFFF59E0B)
private val WcOrangeBg      = Color(0xFFFFF7ED)
private val WcRed           = Color(0xFFEF4444)
private val WcRedBg         = Color(0xFFFEF2F2)
private val WcTextPrimary   = Color(0xFF111827)
private val WcTextSecondary = Color(0xFF6B7280)
private val WcDivider       = Color(0xFFE5E7EB)
private val WcWhite         = Color(0xFFFFFFFF)
private val WcSurface       = Color(0xFFF9FAFB)

// Gradient for balance card
private val WcBalanceGradient = Brush.linearGradient(
    colors = listOf(Color(0xFF16C784), Color(0xFF0D9166), Color(0xFF065F46))
)

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2 — Transaction model + dummy data
// ─────────────────────────────────────────────────────────────────────────────

enum class WcTxnType {
    TOP_UP,            // + green  wallet arrow up
    SESSION_CHARGE,    // - red    bolt
    DEPOSIT_LOCKED,    // - orange lock
    DEPOSIT_RELEASED,  // + green  lock open
    REFUND,            // + green  refresh
    WITHDRAWAL         // - blue   arrow outward
}

data class WcTransaction(
    val id:        String,
    val type:      WcTxnType,
    val title:     String,
    val subtitle:  String,   // human-readable timestamp
    val dateGroup: String,   // "Today" / "Yesterday" / "Earlier" — for grouping
    val amountInr: Int
)

// Phase 1: dummy data
// Phase 2: ApiClient.api.getTransactions(userId)
private val transactions = listOf(
    WcTransaction("t1", WcTxnType.TOP_UP,           "Top-up",                 "Today, 9:45 AM",      "Today",     50),
    WcTransaction("t2", WcTxnType.DEPOSIT_LOCKED,   "Security deposit locked","Yesterday, 6:30 PM",  "Yesterday", 100),
    WcTransaction("t3", WcTxnType.SESSION_CHARGE,   "Charging session",       "Yesterday, 5:15 PM",  "Yesterday", 22),
    WcTransaction("t4", WcTxnType.REFUND,           "Refund from booking",    "Oct 25, 2:00 PM",     "Earlier",   15),
    WcTransaction("t5", WcTxnType.TOP_UP,           "Top-up",                 "Oct 24, 11:30 AM",    "Earlier",   100),
    WcTransaction("t6", WcTxnType.SESSION_CHARGE,   "Charging session",       "Oct 23, 7:10 PM",     "Earlier",   40),
    WcTransaction("t7", WcTxnType.DEPOSIT_RELEASED, "Deposit released",       "Oct 20, 3:00 PM",     "Earlier",   100),
)

// Phase 1: hardcoded
private const val walletBalance = 245
private const val walletDeposit = 100

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3 — Main composable
// ─────────────────────────────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WalletScreen(
    showInsufficientSheet: Boolean    = false,
    shortfallInr:          Int        = 0,
    onAddMoney:            () -> Unit = {},
    onWithdraw:            () -> Unit = {},
    onChooseSmallerPkg:    () -> Unit = {},
    modifier:              Modifier   = Modifier
) {
    val context    = androidx.compose.ui.platform.LocalContext.current
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var showSheet  by remember { mutableStateOf(showInsufficientSheet) }

    // Real wallet state
    var walletBalance  by remember { mutableIntStateOf(0) }
    var walletDeposit  by remember { mutableIntStateOf(100) }
    var transactions   by remember { mutableStateOf<List<WcTransaction>>(emptyList()) }

    // Load real wallet on launch
    LaunchedEffect(Unit) {
        try {
            val userId = com.example.plugbox.network.ApiClient.getUserId(context)
                ?: return@LaunchedEffect
            val res = com.example.plugbox.network.ApiClient.api.getWallet(userId)
            if (res.ok) {
                walletBalance = res.balanceInr.toInt()
                walletDeposit = res.depositInr.toInt()
                val sdfDisplay = java.text.SimpleDateFormat("d MMM, h:mm a", java.util.Locale.getDefault())
                val sdfDate    = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.getDefault())
                val todayStr     = sdfDate.format(java.util.Date())
                val cal          = java.util.Calendar.getInstance()
                cal.add(java.util.Calendar.DAY_OF_YEAR, -1)
                val yesterdayStr = sdfDate.format(cal.time)

                transactions = res.transactions.map { t ->
                    // Parse UTC ISO timestamp and convert to local time (IST)
                    val isoParser = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.getDefault())
                    isoParser.timeZone = java.util.TimeZone.getTimeZone("UTC")
                    val date = try { isoParser.parse(t.createdAt.toString()) } catch (_: Exception) { java.util.Date() }
                    val localSubtitle  = sdfDisplay.format(date ?: java.util.Date())
                    val localDateStr   = sdfDate.format(date ?: java.util.Date())

                    WcTransaction(
                        id        = t.id,
                        type      = when (t.type) {
                            "TOPUP"           -> WcTxnType.TOP_UP
                            "PACKAGE_DEBIT"   -> WcTxnType.SESSION_CHARGE
                            "REFUND"          -> WcTxnType.REFUND
                            "DEPOSIT_COLLECT" -> WcTxnType.DEPOSIT_LOCKED
                            "DEPOSIT_REFUND"  -> WcTxnType.DEPOSIT_RELEASED
                            else              -> WcTxnType.TOP_UP
                        },
                        title     = t.note ?: when (t.type) {
                            "TOPUP"           -> "Top-up"
                            "PACKAGE_DEBIT"   -> "Charging session"
                            "REFUND"          -> "Refund"
                            "DEPOSIT_COLLECT" -> "Security deposit"
                            "DEPOSIT_REFUND"  -> "Deposit released"
                            else              -> t.type
                        },
                        subtitle  = localSubtitle,   // "19 Apr, 2:22 PM" in IST
                        dateGroup = when (localDateStr) {
                            todayStr     -> "Today"
                            yesterdayStr -> "Yesterday"
                            else         -> "Earlier"
                        },
                        amountInr = t.amountInr.toInt()
                    )
                }
            }
        } catch (e: Exception) {
            android.util.Log.e("WalletScreen", "Load wallet failed: ${e.message}")
        }
    }

    var showWithdrawDialog by remember { mutableStateOf(false) }

    if (showWithdrawDialog) {
        AlertDialog(
            onDismissRequest = { showWithdrawDialog = false },
            containerColor   = WcWhite,
            shape            = RoundedCornerShape(20.dp),
            icon = {
                Icon(Icons.Outlined.AccountBalanceWallet, null,
                    tint = WcBlue, modifier = Modifier.size(30.dp))
            },
            title = {
                Text("Withdraw balance?", fontWeight = FontWeight.Bold,
                    fontSize = 18.sp, color = WcTextPrimary, textAlign = TextAlign.Center)
            },
            text = {
                Text(
                    "₹$walletBalance will be transferred to your registered bank " +
                            "account within 3–5 business days. Locked deposit ₹$walletDeposit " +
                            "cannot be withdrawn.",
                    fontSize = 14.sp, color = WcTextSecondary,
                    textAlign = TextAlign.Center, lineHeight = 22.sp
                )
            },
            confirmButton = {
                Button(
                    onClick = { showWithdrawDialog = false; onWithdraw() },
                    colors  = ButtonDefaults.buttonColors(containerColor = WcBlue),
                    shape   = RoundedCornerShape(12.dp)
                ) {
                    Text("Withdraw ₹$walletBalance",
                        fontWeight = FontWeight.Bold, color = WcWhite)
                }
            },
            dismissButton = {
                OutlinedButton(onClick = { showWithdrawDialog = false },
                    shape = RoundedCornerShape(12.dp)) {
                    Text("Cancel", color = WcTextPrimary)
                }
            }
        )
    }

    // Insufficient balance sheet
    if (showSheet) {
        ModalBottomSheet(
            onDismissRequest = { showSheet = false },
            sheetState       = sheetState,
            containerColor   = WcWhite,
            shape            = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp)
        ) {
            WcInsufficientSheet(
                shortfallInr     = if (shortfallInr > 0) shortfallInr else 12,
                onTopUp          = { showSheet = false; onAddMoney() },
                onSmallerPackage = { showSheet = false; onChooseSmallerPkg() },
                onDismiss        = { showSheet = false }
            )
        }
    }

    // Group transactions by date header
    // Each group = Pair(header label, list of transactions)
    // FIX: remember(transactions) — recomputes whenever API loads new transactions.
    //      Plain remember{} computed only once on first render (when list is still empty).
    val grouped: List<Pair<String, List<WcTransaction>>> = remember(transactions) {
        listOf("Today", "Yesterday", "Earlier").mapNotNull { group ->
            val txns = transactions.filter { it.dateGroup == group }
            if (txns.isNotEmpty()) group to txns else null
        }
    }

    Scaffold(
        modifier       = modifier.fillMaxSize(),
        containerColor = WcSurface
    ) { padding ->

        LazyColumn(
            modifier       = Modifier.padding(padding).fillMaxSize(),
            contentPadding = PaddingValues(bottom = 32.dp)
        ) {

            // ── Screen title ───────────────────────────────────────────────
            item {
                Text(
                    text     = "Wallet",
                    fontSize = 26.sp,
                    fontWeight = FontWeight.Bold,
                    color    = WcTextPrimary,
                    modifier = Modifier
                        .statusBarsPadding()
                        .padding(horizontal = 16.dp, vertical = 16.dp)
                )
            }

            // ── Balance hero card ──────────────────────────────────────────
            item {
                WcBalanceCard(
                    balance    = walletBalance,
                    depositInr = walletDeposit,
                    modifier   = Modifier.padding(horizontal = 16.dp)
                )
            }

            // ── Add Money — full width primary ─────────────────────────────
            item {
                Column(
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 14.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    Button(
                        onClick  = onAddMoney,
                        modifier = Modifier.fillMaxWidth().height(54.dp),
                        shape    = RoundedCornerShape(14.dp),
                        colors   = ButtonDefaults.buttonColors(
                            containerColor = WcBlue, contentColor = WcWhite),
                        elevation = ButtonDefaults.buttonElevation(defaultElevation = 4.dp)
                    ) {
                        Icon(Icons.Outlined.Add, null, modifier = Modifier.size(20.dp))
                        Spacer(Modifier.width(8.dp))
                        Text("Add Money", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                    }

                    // Withdraw — tiny secondary, correct 2% usage weight
                    TextButton(
                        onClick  = { showWithdrawDialog = true },
                        modifier = Modifier.align(Alignment.CenterHorizontally)
                    ) {
                        Icon(Icons.Outlined.ArrowOutward, null,
                            modifier = Modifier.size(14.dp),
                            tint     = WcTextSecondary)
                        Spacer(Modifier.width(4.dp))
                        Text("Withdraw balance", fontSize = 13.sp,
                            color = WcTextSecondary)
                    }
                }
            }

            // ── Section break — Action zone → History zone ─────────────────
            item {
                Row(
                    modifier          = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Recent Transactions", fontSize = 17.sp,
                        fontWeight = FontWeight.Bold, color = WcTextPrimary,
                        modifier   = Modifier.weight(1f))
                }
            }

            // ── Grouped transaction list ───────────────────────────────────
            if (transactions.isEmpty()) {
                item { WcEmptyState() }
            } else {
                grouped.forEach { (header, txns) ->
                    // Date group header
                    item(key = "header_$header") {
                        Text(
                            text     = header,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                            color    = WcTextSecondary,
                            modifier = Modifier.padding(
                                horizontal = 16.dp, vertical = 6.dp)
                        )
                    }
                    // Transactions in this group
                    items(txns, key = { it.id }) { txn ->
                        WcTransactionRow(
                            txn      = txn,
                            modifier = Modifier.padding(horizontal = 16.dp)
                        )
                        Spacer(Modifier.height(8.dp))
                    }
                }
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4 — Balance hero card
//
// Green gradient background — feels like energy credit.
// ₹ balance is the visual hero — 48sp white bold.
// Locked deposit explained once, clearly, in a frosted row at the bottom.
// ─────────────────────────────────────────────────────────────────────────────

@Composable
private fun WcBalanceCard(balance: Int, depositInr: Int, modifier: Modifier = Modifier) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .background(WcBalanceGradient)
    ) {
        Column(Modifier.padding(20.dp)) {

            // Top row: label + wallet icon
            Row(
                Modifier.fillMaxWidth(),
                Arrangement.SpaceBetween,
                Alignment.CenterVertically
            ) {
                Text("Available balance", fontSize = 14.sp,
                    color = WcWhite.copy(alpha = 0.8f))

                // Wallet icon — white circle
                Box(
                    modifier = Modifier
                        .size(38.dp)
                        .clip(CircleShape)
                        .background(WcWhite.copy(alpha = 0.15f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Outlined.AccountBalanceWallet, null,
                        tint     = WcWhite,
                        modifier = Modifier.size(20.dp))
                }
            }

            Spacer(Modifier.height(10.dp))

            // Hero balance
            Row(verticalAlignment = Alignment.Bottom) {
                Text("₹", fontSize = 26.sp,
                    fontWeight = FontWeight.Bold,
                    color      = WcWhite,
                    modifier   = Modifier.padding(bottom = 6.dp))
                Text("$balance", fontSize = 52.sp,
                    fontWeight = FontWeight.Bold,
                    color      = WcWhite)
            }

            Spacer(Modifier.height(16.dp))

            // Frosted deposit row at bottom of card
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(WcWhite.copy(alpha = 0.12f))
            ) {
                Row(
                    modifier          = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Icon(Icons.Outlined.Lock, null,
                        tint     = WcWhite.copy(alpha = 0.8f),
                        modifier = Modifier.size(14.dp))
                    Text(
                        "₹$depositInr security deposit locked · refundable on account closure",
                        fontSize = 12.sp,
                        color    = WcWhite.copy(alpha = 0.85f),
                        lineHeight = 18.sp
                    )
                }
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5 — Transaction row
// Icon + color fully driven by type — no manual case-by-case logic at call site
// ─────────────────────────────────────────────────────────────────────────────

@Composable
private fun WcTransactionRow(txn: WcTransaction, modifier: Modifier = Modifier) {

    data class TxnStyle(
        val icon:     ImageVector,
        val iconBg:   Color,
        val iconTint: Color,
        val isCredit: Boolean
    )

    val style = when (txn.type) {
        WcTxnType.TOP_UP           -> TxnStyle(Icons.Outlined.Add,          WcGreenBg,  WcGreen,  true)
        WcTxnType.SESSION_CHARGE   -> TxnStyle(Icons.Outlined.Bolt,         WcRedBg,    WcRed,    false)
        WcTxnType.DEPOSIT_LOCKED   -> TxnStyle(Icons.Outlined.Lock,         WcOrangeBg, WcOrange, false)
        WcTxnType.DEPOSIT_RELEASED -> TxnStyle(Icons.Outlined.LockOpen,     WcGreenBg,  WcGreen,  true)
        WcTxnType.REFUND           -> TxnStyle(Icons.Outlined.Refresh,      WcGreenBg,  WcGreen,  true)
        WcTxnType.WITHDRAWAL       -> TxnStyle(Icons.Outlined.ArrowOutward, WcBlueBg,   WcBlue,   false)
    }

    val amountText  = "${if (style.isCredit) "+" else "-"}₹${txn.amountInr}"
    val amountColor = if (style.isCredit) WcGreen else WcRed

    Surface(
        modifier        = modifier.fillMaxWidth(),
        shape           = RoundedCornerShape(14.dp),
        color           = WcWhite,
        shadowElevation = 1.dp,
        border          = androidx.compose.foundation.BorderStroke(1.dp, WcDivider)
    ) {
        Row(
            modifier          = Modifier.padding(horizontal = 14.dp, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Colored icon circle
            Box(
                modifier = Modifier
                    .size(42.dp)
                    .clip(CircleShape)
                    .background(style.iconBg),
                contentAlignment = Alignment.Center
            ) {
                Icon(style.icon, null,
                    tint     = style.iconTint,
                    modifier = Modifier.size(20.dp))
            }

            Spacer(Modifier.width(12.dp))

            Column(Modifier.weight(1f)) {
                Text(txn.title, fontWeight = FontWeight.SemiBold,
                    fontSize = 14.sp, color = WcTextPrimary)
                Spacer(Modifier.height(3.dp))
                Text(txn.subtitle, fontSize = 12.sp, color = WcTextSecondary)
            }

            // Amount — right aligned
            Text(amountText, fontSize = 15.sp,
                fontWeight = FontWeight.Bold, color = amountColor)
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 6 — Empty state
// ─────────────────────────────────────────────────────────────────────────────

@Composable
private fun WcEmptyState() {
    Column(
        modifier            = Modifier
            .fillMaxWidth()
            .padding(vertical = 48.dp, horizontal = 32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Box(
            modifier = Modifier
                .size(64.dp)
                .clip(CircleShape)
                .background(WcGreenBg),
            contentAlignment = Alignment.Center
        ) {
            Icon(Icons.Outlined.ReceiptLong, null,
                tint     = WcGreen,
                modifier = Modifier.size(32.dp))
        }
        Text("No transactions yet", fontWeight = FontWeight.SemiBold,
            fontSize = 16.sp, color = WcTextPrimary)
        Text("Your charging history and wallet\nactivity will appear here",
            fontSize = 13.sp, color = WcTextSecondary,
            textAlign = TextAlign.Center, lineHeight = 20.sp)
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 7 — Insufficient balance bottom sheet
//
// PUBLIC — also called from ChargerDetailScreen when wallet is short.
// Exact shortfall amount passed in — user sees exactly what they need.
// ─────────────────────────────────────────────────────────────────────────────

@Composable
fun WcInsufficientSheet(
    shortfallInr:     Int,
    onTopUp:          () -> Unit,
    onSmallerPackage: () -> Unit,
    onDismiss:        () -> Unit
) {
    Column(
        modifier            = Modifier
            .fillMaxWidth()
            .padding(horizontal = 24.dp)
            .padding(bottom = 32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Drag handle
        Box(
            Modifier.width(40.dp).height(4.dp)
                .clip(CircleShape).background(WcDivider)
        )

        Spacer(Modifier.height(4.dp))

        // Warning icon
        Box(
            modifier = Modifier
                .size(60.dp)
                .clip(CircleShape)
                .background(WcRedBg),
            contentAlignment = Alignment.Center
        ) {
            Icon(Icons.Outlined.WarningAmber, null,
                tint     = WcRed,
                modifier = Modifier.size(30.dp))
        }

        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Text("Insufficient balance",
                fontWeight = FontWeight.Bold,
                fontSize   = 20.sp,
                color      = WcTextPrimary)
            Text("You're short by ₹$shortfallInr for this transaction.",
                fontSize  = 14.sp,
                color     = WcTextSecondary,
                textAlign = TextAlign.Center)
        }

        // Top up — primary blue
        Button(
            onClick  = onTopUp,
            modifier = Modifier.fillMaxWidth().height(54.dp),
            shape    = RoundedCornerShape(14.dp),
            colors   = ButtonDefaults.buttonColors(
                containerColor = WcBlue, contentColor = WcWhite)
        ) {
            Icon(Icons.Outlined.Add, null, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(8.dp))
            Text("Top up ₹$shortfallInr",
                fontWeight = FontWeight.Bold, fontSize = 15.sp)
        }

        // Smaller package — secondary outlined
        OutlinedButton(
            onClick  = onSmallerPackage,
            modifier = Modifier.fillMaxWidth().height(54.dp),
            shape    = RoundedCornerShape(14.dp),
            border   = androidx.compose.foundation.BorderStroke(1.5.dp, WcBlue),
            colors   = ButtonDefaults.outlinedButtonColors(contentColor = WcBlue)
        ) {
            Text("Choose smaller package",
                fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
        }

        TextButton(onClick = onDismiss) {
            Text("Dismiss", fontSize = 13.sp,
                color = WcTextSecondary.copy(alpha = 0.7f))
        }
    }
}