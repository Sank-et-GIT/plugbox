package com.example.plugbox.network

import okhttp3.OkHttpClient // network request krta hai
import okhttp3.logging.HttpLoggingInterceptor // request/response ka log rkhta hai
import retrofit2.Retrofit // API calls manage krta hai
import retrofit2.converter.gson.GsonConverterFactory // JSON ko kotlin object mein convert karega

// ApiClient actual network setup karta hai — Retrofit + OkHttp configure karke ek ready API object banata hai jisse app call kare.
object ApiClient { //object (singleton) mtlb single object, apne purein app mein sirf ek he ApiClient instance banega
    private const val BASE_URL = "http://64.227.166.155:8080" // This is Single Backend URL for whole team, sarein API endpoints esi base URL se start honge

    private val client by lazy { // by lazy mtlb jb tk client use nahi hoga tb tk create nhi hoga, pehli baar use hote he bnega
        OkHttpClient.Builder()
            .addInterceptor(HttpLoggingInterceptor().apply {   // Interceptor network requests ko intercept karta hai, yaha logging k liye use horah hai
                level = HttpLoggingInterceptor.Level.BODY // Body level ka mtlb: request+response ka pura data log mein show hoga (headers+body sabkuch)
            })
            .build()
    } //OKHttpClient ready ho gaya

    val api: PlugBoxApi by lazy {
        Retrofit.Builder()
            .baseUrl(BASE_URL)
            .client(client)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(PlugBoxApi::class.java)
    }
}
/**
Yeh Retrofit ka main API object hai. isko use krke hum backend ke functions call karenge.
Base URL set kiya, upar wala OKHttp client attach kia
JSON ka automatically kotlin data class mein convert karega
Retrofit object create kia
PlugBoxApi interface ko implementation mein convert kr dia
*/

// -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

/**
object (Singleton)
Iska matlab:
Pure app mein sirf ek hi ApiClient banega
Memory waste nahi hogi
Best practice hai network clients ke liye*/

/**
Retrofit Kya Hai?
Retrofit ek library hai jo:
HTTP calls ko easy banata hai
API ko function ki tarah call karne deta hai
Example:
@GET("users")
suspend fun getUsers(): List<User>
"Yeh backend ka /users endpoint call karega"
*/

/**
OkHttpClient Kya Karta Hai?
Actual network request send karta hai
Timeout set kar sakte ho
Headers add kar sakte ho
Logging enable kar sakte ho
Retrofit internally OkHttp use karta hai.     */

/**
HttpLoggingInterceptor
level = HttpLoggingInterceptor.Level.BODY
Iska matlab:
App jab API call karega toh Logcat mein yeh dikhega:
Request URL
Headers
Request body
Response body
Development mein useful
Production mein usually OFF kar dete hain (security reason)*/

/**
GsonConverterFactory
Backend se JSON aata hai:
{
    "name": "Rahul",
    "age": 22
}
Gson automatically isse convert karega:
data class User(
    val name: String,
    val age: Int
)
Yeh conversion automatic hota hai.*/

/**
Flow
App ko API call karni hai
ApiClient.api use hoga
Retrofit request banayega
OkHttp network pe bhejega
Server JSON return karega
Gson JSON ko object mein convert karega
App use karega*/

/**
Retrofit = Manager
OkHttp = Delivery Boy
Server = Restaurant
Gson = Translator
App order deta hai → Manager delivery boy ko deta hai → Restaurant se data aata hai → Translator usko samjhta hai → App ko milta hai.*/
