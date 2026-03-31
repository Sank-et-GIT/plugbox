package com.example.plugbox.network

import android.content.Context
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import androidx.core.content.edit

object ApiClient {

    private const val BASE_URL    = "http://64.227.166.155:8080/"
    private const val PREFS_NAME  = "plugbox_prefs"
    private const val KEY_USER_ID = "user_id"
    private const val KEY_TOKEN   = "auth_token"

    // Called from MainActivity.onCreate
    fun init(context: Context) {
        // Nothing to do currently — future: load cached token, init analytics etc.
    }

    private val httpClient by lazy {
        OkHttpClient.Builder()
            .addInterceptor(HttpLoggingInterceptor().apply {
                level = HttpLoggingInterceptor.Level.BODY
            })
            .build()
    }

    val api: PlugBoxApi by lazy {
        Retrofit.Builder()
            .baseUrl(BASE_URL)
            .client(httpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(PlugBoxApi::class.java)
    }

    // ── Session helpers ───────────────────────────────────────────────────────

    // Called from LoginScreen after successful Firebase + backend login
    fun saveToken(context: Context, token: String, userId: String) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit {
                putString(KEY_TOKEN, token)
                    .putString(KEY_USER_ID, userId)
                    .putBoolean("logged_in", true)  // PlugBoxAppRoot reads this
            }
    }

    // Called from PlugBoxHomeFlow for API calls
    fun getUserId(context: Context): String? =
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getString(KEY_USER_ID, null)

    fun getToken(context: Context): String? =
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getString(KEY_TOKEN, null)

    fun isLoggedIn(context: Context): Boolean =
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getBoolean("logged_in", false)

    fun logout(context: Context) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit { clear() }
    }
}