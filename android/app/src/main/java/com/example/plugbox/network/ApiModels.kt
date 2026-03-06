package com.example.plugbox.network

// ApiModels batati hai server se kya data aayega aur kya bhejna hai — matlab request aur response ka structure define karti hai.

/**
Yeh file 3 cheezein define kar rahi hai:
Responses → server se kya aayega
Entities → app ke andar ka real object
Requests → server ko kya bhejna hai*/

// Neeche jo classes hain wo server se aane wale replies ko represent karti hain.

// (HealthResponse) i.e Health API ka reply: sirf status aata hai (jaise "ok").
data class HealthResponse(val status: String) // server ka reply = server said : { "status": "ok" } aur App banayega : HealthResponse("ok") "Matlab: JSON → Kotlin object"

// (ChargersResponse)
data class ChargersResponse(val chargers: List<Charger>) // chargers list API ka reply: chargers naam ki list aayegi, jisme Charger objects honge.

// (HoldResponse) i.e Hold API ka reply: ok success/fail, aur booking details
data class HoldResponse(
    val ok: Boolean,
    val booking: Booking
)

// (StartResponse)
data class StartResponse(val ok: Boolean, val sessionId: Int, val commandId: Int) // Start charging ka reply: success + sessionId + commandId.

// (StopResponse)
data class StopResponse(
    val ok: Boolean
)

// ENTITIES

// Niche app ke “real models” hain (Charger, Booking). Inko response/request dono use kar sakte hain

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

// Neeche jo classes hain wo app server ko bhejti hai.

//---------Hold Request [Hold karne ke liye: chargerId + userId bhej rhe]
data class HoldRequest(val chargerId: Int, val userId: String)

//---------StartRequest [ Start charging ke liye: chargerId + userId bhej rhe]
data class StartRequest(val chargerId: Int, val userId: String)

//---------Stop Request
data class StopRequest(val sessionId: Int)