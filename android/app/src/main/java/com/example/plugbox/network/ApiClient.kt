package com.example.plugbox.network

import android.content.Context
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory

// ─────────────────────────────────────────────────────────────────────────────
// ApiClient.kt
//
// CHANGES:
//   • Added AuthInterceptor — reads JWT from SharedPreferences,
//     adds "Authorization: Bearer <token>" to every request automatically.
//   • Added init(context), saveToken(), getUserId(), clearAuth() helpers.
//   • Call ApiClient.init(context) once in MainActivity before any API call.
//
// Phase 2: swap SharedPreferences for EncryptedSharedPreferences (security)
// ─────────────────────────────────────────────────────────────────────────────

object ApiClient {
    private const val BASE_URL = "http://64.227.166.155:8080"

    private var appContext: Context? = null

    // Call once from MainActivity.onCreate()
    fun init(context: Context) {
        appContext = context.applicationContext
    }

    // Read token for auth interceptor
    private fun getToken(): String? =
        appContext
            ?.getSharedPreferences("plugbox_prefs", Context.MODE_PRIVATE)
            ?.getString("auth_token", null)

    // Save after successful login
    fun saveToken(context: Context, token: String, userId: String) {
        context.getSharedPreferences("plugbox_prefs", Context.MODE_PRIVATE)
            .edit()
            .putString("auth_token", token)
            .putString("user_id", userId)
            .putBoolean("logged_in", true)
            .apply()
    }

    // Read userId — pass to Hold/Start/Stop requests
    fun getUserId(context: Context): String? =
        context.getSharedPreferences("plugbox_prefs", Context.MODE_PRIVATE)
            .getString("user_id", null)

    // Clear on logout or delete account
    fun clearAuth(context: Context) {
        context.getSharedPreferences("plugbox_prefs", Context.MODE_PRIVATE)
            .edit()
            .remove("auth_token")
            .remove("user_id")
            .putBoolean("logged_in", false)
            .apply()
    }

    // OkHttp with auth interceptor + logging
    private val client by lazy {
        OkHttpClient.Builder()
            .addInterceptor { chain ->
                // Attach JWT to every request that has a token stored
                val token   = getToken()
                val request = if (token != null) {
                    chain.request().newBuilder()
                        .addHeader("Authorization", "Bearer $token")
                        .build()
                } else {
                    chain.request()
                }
                chain.proceed(request)
            }
            .addInterceptor(HttpLoggingInterceptor().apply {
                level = HttpLoggingInterceptor.Level.BODY
            })
            .build()
    }

    val api: PlugBoxApi by lazy {
        Retrofit.Builder()
            .baseUrl(BASE_URL)
            .client(client)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(PlugBoxApi::class.java)
    }
}