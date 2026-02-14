package com.example.plugbox.network

// RESPONSES

//---------HealthResponse
data class HealthResponse(val status: String)

//---------ChargersResponse
data class ChargersResponse(val chargers: List<Charger>)

//---------HoldResponse
data class HoldResponse(
    val ok: Boolean,
    val booking: Booking
)

//---------StartResponse
data class StartResponse(val ok: Boolean, val sessionId: Int, val commandId: Int)

//----------StopResponse
data class StopResponse(
    val ok: Boolean
)


//----------------------------------------------------------------------------------------

// ENTITIES

//---------Charger
data class Charger(
    val id: Int,
    val name: String,
    val lat: Double,
    val lng: Double,
    val status: String,
    val lastSeen: String?,
    val lastSeenSecondsAgo: Long?
)

//---------Booking
data class Booking(
    val id: Int,
    val chargerId: Int,
    val userId: String,
    val status: String,
    val expiresAt: String,
    val createdAt: String,
    val updatedAt: String
)

//-------------------------------------------------------------------------------------------

// REQUESTS

//---------Hold Request
data class HoldRequest(val chargerId: Int, val userId: String)

//---------StartRequest
data class StartRequest(val chargerId: Int, val userId: String)

//---------Stop Request
data class StopRequest(val sessionId: Int)