package com.example.plugbox.network

import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.POST

// ─────────────────────────────────────────────────────────────────────────────
// PlugBoxApi.kt
// CHANGES: Firebase auth endpoints added. OTP endpoints removed.
// All charging endpoints untouched.
// ─────────────────────────────────────────────────────────────────────────────

interface PlugBoxApi {

    // ── Existing endpoints (untouched) ────────────────────────────────────────

    @GET("/health")
    suspend fun health(): HealthResponse

    @GET("/chargers")
    suspend fun chargers(): ChargersResponse

    @POST("/bookings/hold")
    suspend fun hold(@Body req: HoldRequest): HoldResponse

    @POST("/sessions/start")
    suspend fun start(@Body req: StartRequest): StartResponse

    @POST("/sessions/stop")
    suspend fun stop(@Body req: StopRequest): StopResponse

    // ── NEW — Firebase Auth endpoints ─────────────────────────────────────────

    // Step 1: Send Firebase idToken → get our JWT + userId
    // Firebase already verified the OTP before this is called
    @POST("/auth/firebase-login")
    suspend fun firebaseLogin(@Body req: FirebaseLoginRequest): FirebaseLoginResponse

    // Step 2: Save name (new users only, requires Bearer token)
    @POST("/auth/update-name")
    suspend fun updateName(
        @Header("Authorization") bearer: String,
        @Body req: UpdateNameRequest
    ): UpdateNameResponse
}