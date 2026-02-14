package com.example.plugbox.network

import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST

interface PlugBoxApi {

    @GET("/health")
    suspend fun health(): HealthResponse

    @GET("/chargers")
    suspend fun chargers(): ChargersResponse

    @POST("/bookings/hold")
    suspend fun hold(@Body req: HoldRequest):HoldResponse

    @POST("/sessions/start")
    suspend fun start(@Body req: StartRequest): StartResponse

    @POST("/sessions/stop")
    suspend fun stop(@Body req: StopRequest): StopResponse
}