package com.example.plugbox.network

import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.POST
import retrofit2.http.Path

// ─────────────────────────────────────────────────────────────────────────────
// PlugBoxApi.kt — PlugBox v2
// All backend endpoints
// ─────────────────────────────────────────────────────────────────────────────

interface PlugBoxApi {

    // ── Health ────────────────────────────────────────────────────────────────
    @GET("/health")
    suspend fun health(): HealthResponse

    // ── Chargers ──────────────────────────────────────────────────────────────
    @GET("/chargers")
    suspend fun chargers(): ChargersResponse

    // ── Wallet ────────────────────────────────────────────────────────────────

    // Get wallet balance + transactions
    @GET("/wallet/{userId}")
    suspend fun getWallet(@Path("userId") userId: String): WalletResponse

    // Create Razorpay order (topup / first_booking / shortfall)
    @POST("/wallet/create-order")
    suspend fun createOrder(@Body req: CreateOrderRequest): CreateOrderResponse

    // Verify payment after Razorpay SDK returns success
    @POST("/wallet/verify-payment")
    suspend fun verifyPayment(@Body req: VerifyPaymentRequest): VerifyPaymentResponse

    // ── Bookings ──────────────────────────────────────────────────────────────

    // Hold a charger slot — deducts wallet if balance sufficient
    @POST("/bookings/hold")
    suspend fun hold(@Body req: HoldRequest): HoldResponse

    // ── Sessions ──────────────────────────────────────────────────────────────

    // Start session → publishes SOLENOID_UNLOCK to hardware
    @POST("/sessions/start")
    suspend fun start(@Body req: StartRequest): StartResponse

    // Stop session → refund wallet → publishes RELAY_OFF to hardware
    @POST("/sessions/stop")
    suspend fun stop(@Body req: StopRequest): StopResponse

    // Live meter — polled every 30s during charging
    @GET("/sessions/meter/{sessionId}")
    suspend fun meter(@Path("sessionId") sessionId: Int): MeterResponse

    // Check for active session on app launch (session recovery)
    @GET("/sessions/active/{userId}")
    suspend fun activeSession(@Path("userId") userId: String): ActiveSessionResponse

    // Session history — past ENDED sessions
    @GET("/sessions/history/{userId}")
    suspend fun sessionHistory(@Path("userId") userId: String): SessionHistoryResponse

    // Unlock lid after session ends — user taps to retrieve cable
    @POST("/sessions/unlock-cable")
    suspend fun unlockCable(@Body req: UnlockCableRequest): UnlockCableResponse

    // ── Auth ──────────────────────────────────────────────────────────────────

    // Firebase idToken → our JWT + userId
    @POST("/auth/firebase-login")
    suspend fun firebaseLogin(@Body req: FirebaseLoginRequest): FirebaseLoginResponse

    // Save name after signup (new users only)
    @POST("/auth/update-name")
    suspend fun updateName(
        @Header("Authorization") bearer: String,
        @Body req: UpdateNameRequest
    ): UpdateNameResponse
}