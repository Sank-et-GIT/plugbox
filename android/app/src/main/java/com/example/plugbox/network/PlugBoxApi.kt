package com.example.plugbox.network

import retrofit2.Response
import retrofit2.http.Body // @Body → jo data bhejna hai wo body mein jayega
import retrofit2.http.GET // @GET → GET request bhejne ke liye
import retrofit2.http.POST // @POST → POST request bhejne ke liye

// PlugBoxApi batata hai kaun-kaun se endpoints hain (health, chargers, hold, start, stop) aur unko kaise call karna hai — yeh Retrofit ke through HTTP functions define karta hai.

/**
Ye sabse important file hai
Yahan actual API calls define ho rahi hain
Yeh interface batata hai ki app backend ko kaise call karegi
Yeh file backend ke endpoints ko Kotlin functions mein convert kar rahi hai
Tum function call karo
Retrofit network call kar dega
*/



/**
Yeh ek interface hai
Isme sirf functions define hote hain
Actual implementation Retrofit khud banata hai (ApiClient mein .create() kiya tha)
Matlab: mein sirf function call kr rha hu  → Retrofit network request bhej dega
 */
interface PlugBoxApi {

    @GET("/health")
    suspend fun health(): HealthResponse

   /**
    * /health endpoint hit karega
    GET request jayegi
    Response type = HealthResponse
    suspend ka matlab:
    Yeh function background thread pe chalega (coroutines ke saath)
    Network call main thread block nahi karega
    */
    @GET("/chargers")
    suspend fun chargers(): ChargersResponse

    /**
     * /chargers endpoint hit karega
    List of chargers return karega
    Output = ChargersResponse
*/
    @POST("/bookings/hold")
    suspend fun hold(@Body req: HoldRequest):HoldResponse

/**
    POST request jayegi /bookings/hold pe
    req body mein bheja jayega
    Server se HoldResponse milega
    Yahan kaun bhej raha hai?
    App bhej rahi hai HoldRequest object
 */

    @POST("/sessions/start")
    suspend fun start(@Body req: StartRequest): StartResponse
    /**
    Start charging request
    Body mein StartRequest jayega
    Server StartResponse dega
  */
    @POST("/sessions/stop")
    suspend fun stop(@Body req: StopRequest): StopResponse
}

/**
Stop charging
Body mein sessionId bhejoge
Server success/fail return karega
*/

/**
FLOW
User button dabata hai
↓
ViewModel function call karta hai
↓
ApiClient.api.start(...) call hota hai
↓
Retrofit yeh interface use karta hai
↓
OkHttp network pe request bhejta hai
↓
Server response deta hai
↓
Gson usko object mein convert karta hai
↓
App ko result milta hai
*/


