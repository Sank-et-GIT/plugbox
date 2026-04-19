package com.example.plugbox.network

// ─────────────────────────────────────────────────────────────────────────────
// ApiModels.kt — PlugBox v2
// All request/response models matching backend exactly
// ─────────────────────────────────────────────────────────────────────────────

// ── Health ────────────────────────────────────────────────────────────────────
data class HealthResponse(val status: String)

// ── Chargers ──────────────────────────────────────────────────────────────────
data class ChargersResponse(val chargers: List<Charger>)

data class Charger(
    val id:                 Int,
    val name:               String,
    val lat:                Double,
    val lng:                Double,
    val status:             String,
    val lastSeen:           String?,
    val lastSeenSecondsAgo: Long?,
    val slotNumber:         Int?    = 1,
    val displayName:        String? = null,
    val mqttTopic:          String? = null,
)

// ── Wallet ────────────────────────────────────────────────────────────────────
data class WalletResponse(
    val ok:           Boolean,
    val balance:      Int     = 0,    // paise
    val balanceInr:   Double  = 0.0,  // rupees for display
    val deposit:      Int     = 0,
    val depositInr:   Double  = 0.0,
    val transactions: List<WalletTxn> = emptyList(),
    val error:        String? = null
)

data class WalletTxn(
    val id:         String,
    val type:       String,   // TOPUP / PACKAGE_DEBIT / REFUND / DEPOSIT_COLLECT
    val amountInr:  Double,
    val balanceInr: Double,
    val note:       String?,
    val createdAt:  String
)

// POST /wallet/create-order
data class CreateOrderRequest(
    val userId:       String,
    val amountPaise:  Int,
    val purpose:      String,  // "topup" | "first_booking" | "shortfall"
    val bookingMeta:  BookingMeta? = null
)

data class BookingMeta(
    val chargerId:    Int,
    val packageName:  String,
    val packagePaise: Int,
    val kwhLimit:     Double
)

data class CreateOrderResponse(
    val ok:       Boolean,
    val orderId:  String? = null,
    val amount:   Int?    = null,
    val currency: String? = null,
    val keyId:    String? = null,
    val error:    String? = null
)

// POST /wallet/verify-payment
data class VerifyPaymentRequest(
    val razorpayPaymentId:  String,
    val razorpayOrderId:    String,
    val razorpaySignature:  String,
    val userId:             String
)

data class VerifyPaymentResponse(
    val ok:        Boolean,
    val processed: Boolean = false,
    val bookingId: Int?    = null,
    val error:     String? = null
)

// ── Bookings ──────────────────────────────────────────────────────────────────

// POST /bookings/hold
data class HoldRequest(
    val chargerId:    Int,
    val userId:       String,
    val packageName:  String,
    val packagePaise: Int,
    val kwhLimit:     Double
)

data class HoldResponse(
    val ok:                  Boolean,
    val bookingId:           Int?    = null,
    val expiresAt:           String? = null,
    val packageName:         String? = null,
    val packagePaise:        Int?    = null,
    val kwhLimit:            Double? = null,
    // Error fields
    val reason:              String? = null,  // "insufficient_balance" | "already_held"
    val needsDeposit:        Boolean = false,
    val shortfallPaise:      Int?    = null,
    val totalRequiredPaise:  Int?    = null,
    val currentBalancePaise: Int?    = null,
    val depositPaise:        Int?    = null,
    val error:               String? = null
)

// Booking entity (used in responses)
data class Booking(
    val id:          Int,
    val chargerId:   Int,
    val userId:      String,
    val status:      String,
    val packageName: String,
    val expiresAt:   String,
    val createdAt:   String,
)

// ── Sessions ──────────────────────────────────────────────────────────────────

// POST /sessions/start
data class StartRequest(val chargerId: Int, val userId: String)

data class StartResponse(
    val ok:        Boolean,
    val sessionId: Int?    = null,
    val commandId: Int?    = null,
    val error:     String? = null
)

// POST /sessions/stop
data class StopRequest(val sessionId: Int)

data class StopResponse(
    val ok:         Boolean,
    val sessionId:  Int?    = null,
    val finalKwh:   Double? = null,
    val usedInr:    Double? = null,
    val refundInr:  Double? = null,
    val packageInr: Double? = null,
    val error:      String? = null
)

// GET /sessions/meter/:sessionId
data class MeterResponse(
    val ok:                  Boolean,
    val sessionId:           Int?    = null,
    val status:              String? = null,
    val usedKwh:             Double  = 0.0,
    val remainingBalanceInr: Double  = 0.0,
    val etaMinutes:          Int     = 0,
    val usedInr:             Double  = 0.0,
    val refundInr:           Double  = 0.0,
    val noLoad:              Boolean = false, // true = plug removed (no PZEM reading for >3s)
    val error:               String? = null
)

// GET /sessions/active/:userId
data class ActiveSessionResponse(
    val ok:           Boolean,
    val active:       Boolean = false,
    val sessionId:    Int?    = null,
    val status:       String? = null,
    val chargerId:    Int?    = null,
    val chargerName:  String? = null,
    val chargerLat:   Double? = null,
    val chargerLng:   Double? = null,
    val packageName:  String? = null,
    val packagePaise: Int?    = null,
    val kwhLimit:     Double? = null,
    val startedAt:    String? = null,
    val error:        String? = null
)

// ── Auth ──────────────────────────────────────────────────────────────────────
data class FirebaseLoginRequest(val idToken: String)

data class FirebaseLoginResponse(
    val ok:        Boolean,
    val token:     String?  = null,
    val userId:    String?  = null,
    val name:      String?  = null,
    val isNewUser: Boolean  = false,
    val error:     String?  = null
)

data class UpdateNameRequest(val name: String)
data class UpdateNameResponse(val ok: Boolean, val error: String? = null)

// GET /sessions/history/:userId
data class SessionHistoryItem(
    val id:          Int,
    val chargerName: String,
    val packageName: String,
    val usedKwh:     Double,
    val usedInr:     Double,
    val refundInr:   Double,
    val durationMin: Int,
    val endedAt:     String?
)

data class SessionHistoryResponse(
    val ok:       Boolean,
    val sessions: List<SessionHistoryItem> = emptyList()
)