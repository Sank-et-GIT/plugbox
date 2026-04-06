package com.example.plugbox.ui

import android.app.Activity
import android.content.Context
import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.ArrowForward
import androidx.compose.material.icons.outlined.Bolt
import androidx.compose.material.icons.outlined.Cancel
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.ErrorOutline
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.plugbox.network.ApiClient
import com.example.plugbox.network.FirebaseLoginRequest
import com.example.plugbox.network.UpdateNameRequest
import com.google.firebase.FirebaseException
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseAuthInvalidCredentialsException
import com.google.firebase.auth.PhoneAuthCredential
import com.google.firebase.auth.PhoneAuthOptions
import com.google.firebase.auth.PhoneAuthProvider
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import java.util.concurrent.TimeUnit

// ─────────────────────────────────────────────────────────────────────────────
// Colors
// ─────────────────────────────────────────────────────────────────────────────

private val LgGreen         = Color(0xFF16C784)
private val LgGreenBg       = Color(0xFFECFDF5)
private val LgRed           = Color(0xFFEF4444)
private val LgTextPrimary   = Color(0xFF111827)
private val LgTextSecondary = Color(0xFF6B7280)
private val LgDivider       = Color(0xFFE5E7EB)
private val LgWhite         = Color(0xFFFFFFFF)
private val LgSurface       = Color(0xFFF9FAFB)

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

private enum class LoginStep { PHONE, OTP, NAME }
private const val OTP_LENGTH     = 6
private const val RESEND_SECONDS = 30

// ─────────────────────────────────────────────────────────────────────────────
// Main composable
// ─────────────────────────────────────────────────────────────────────────────

@Composable
fun LoginScreen(
    onLoginSuccess: () -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val activity = context as Activity
    val scope = rememberCoroutineScope()
    val firebaseAuth = remember { FirebaseAuth.getInstance() }

    var step by remember { mutableStateOf(LoginStep.PHONE) }
    var phone by remember { mutableStateOf("") }
    var otp by remember { mutableStateOf("") }
    var name by remember { mutableStateOf("") }

    var verificationId by remember { mutableStateOf("") }
    var resendToken by remember { mutableStateOf<PhoneAuthProvider.ForceResendingToken?>(null) }

    var isLoading by remember { mutableStateOf(false) }
    var errorMsg by remember { mutableStateOf("") }
    var otpSuccess by remember { mutableStateOf(false) }
    var nameError by remember { mutableStateOf(false) }

    var authToken by remember { mutableStateOf("") }
    var isNewUser by remember { mutableStateOf(true) }

    var resendSeconds by remember { mutableStateOf(RESEND_SECONDS) }

    // Countdown timer while user is on OTP step.
    LaunchedEffect(step) {
        if (step == LoginStep.OTP) {
            resendSeconds = RESEND_SECONDS
            while (resendSeconds > 0) {
                delay(1_000L)
                resendSeconds--
            }
        }
    }

    // Back handling: OTP -> PHONE
    BackHandler(enabled = step == LoginStep.OTP) {
        step = LoginStep.PHONE
        otp = ""
        errorMsg = ""
        otpSuccess = false
    }

    val firebaseCallbacks = remember {
        object : PhoneAuthProvider.OnVerificationStateChangedCallbacks() {

            override fun onVerificationCompleted(credential: PhoneAuthCredential) {
                scope.launch {
                    isLoading = true
                    doSignIn(
                        firebaseAuth = firebaseAuth,
                        credential = credential,
                        context = context,
                        phone = phone,
                        onSuccess = { token, newUser ->
                            authToken = token
                            isNewUser = newUser
                            otpSuccess = true
                        },
                        onError = { msg ->
                            errorMsg = msg
                            isLoading = false
                        }
                    )
                }
            }

            override fun onCodeSent(
                vId: String,
                token: PhoneAuthProvider.ForceResendingToken
            ) {
                verificationId = vId
                resendToken = token
                isLoading = false
                step = LoginStep.OTP
            }

            override fun onVerificationFailed(e: FirebaseException) {
                isLoading = false
                errorMsg = when {
                    e.message?.contains("TOO_SHORT") == true -> "Phone number too short"
                    e.message?.contains("quota") == true -> "Too many requests. Try later."
                    e.message?.contains("BLOCKED") == true -> "Number temporarily blocked"
                    else -> "Verification failed. Check your number."
                }
            }
        }
    }

    // After OTP success animation, route user ahead.
    LaunchedEffect(otpSuccess) {
        if (!otpSuccess) return@LaunchedEffect
        delay(600L)
        isLoading = false
        if (isNewUser) {
            step = LoginStep.NAME
            otpSuccess = false
        } else {
            onLoginSuccess()
        }
    }

    fun sendOtp(forceResend: Boolean = false) {
        isLoading = true
        errorMsg = ""

        val builder = PhoneAuthOptions.newBuilder(firebaseAuth)
            .setPhoneNumber("+91${phone.trim()}")
            .setTimeout(60L, TimeUnit.SECONDS)
            .setActivity(activity)
            .setCallbacks(firebaseCallbacks)

        val token = resendToken
        if (forceResend && token != null) {
            builder.setForceResendingToken(token)
        }

        PhoneAuthProvider.verifyPhoneNumber(builder.build())
    }

    fun verifyOtp() {
        if (verificationId.isEmpty() || otp.length < OTP_LENGTH || isLoading) return

        isLoading = true
        errorMsg = ""

        val credential = PhoneAuthProvider.getCredential(verificationId, otp)

        scope.launch {
            doSignIn(
                firebaseAuth = firebaseAuth,
                credential = credential,
                context = context,
                phone = phone,
                onSuccess = { token, newUser ->
                    authToken = token
                    isNewUser = newUser
                    otpSuccess = true
                },
                onError = { msg ->
                    errorMsg = msg
                    isLoading = false
                }
            )
        }
    }

    // Auto-submit OTP when all digits are entered.
    LaunchedEffect(otp) {
        if (otp.length == OTP_LENGTH && step == LoginStep.OTP && !isLoading) {
            verifyOtp()
        }
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(LgWhite)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .statusBarsPadding()
                .navigationBarsPadding()
        ) {
            Box(
                Modifier
                    .fillMaxWidth()
                    .height(6.dp)
                    .background(LgGreen)
            )

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 8.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                if (step == LoginStep.OTP) {
                    IconButton(onClick = {
                        step = LoginStep.PHONE
                        otp = ""
                        errorMsg = ""
                        otpSuccess = false
                    }) {
                        Icon(
                            Icons.AutoMirrored.Outlined.ArrowBack,
                            contentDescription = "Back",
                            tint = LgTextPrimary
                        )
                    }
                } else {
                    Spacer(Modifier.size(48.dp))
                }
            }

            Column(Modifier.padding(horizontal = 24.dp)) {
                Box(
                    modifier = Modifier
                        .size(56.dp)
                        .clip(RoundedCornerShape(16.dp))
                        .background(LgGreen),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        Icons.Outlined.Bolt,
                        contentDescription = null,
                        tint = LgWhite,
                        modifier = Modifier.size(32.dp)
                    )
                }

                Spacer(Modifier.height(16.dp))

                AnimatedContent(
                    targetState = step,
                    transitionSpec = {
                        slideInHorizontally { it } + fadeIn() togetherWith
                                slideOutHorizontally { -it } + fadeOut()
                    },
                    label = "stepTitle"
                ) { s ->
                    Column {
                        Text(
                            text = when (s) {
                                LoginStep.PHONE -> "Welcome to PlugBox"
                                LoginStep.OTP -> "Verify your number"
                                LoginStep.NAME -> "What's your name?"
                            },
                            fontSize = 26.sp,
                            fontWeight = FontWeight.Bold,
                            color = LgTextPrimary
                        )

                        Spacer(Modifier.height(8.dp))

                        Text(
                            text = when (s) {
                                LoginStep.PHONE -> "Enter your mobile number to get started"
                                LoginStep.OTP -> "We sent a 6-digit OTP to +91 $phone"
                                LoginStep.NAME -> "This is how you'll appear in PlugBox"
                            },
                            fontSize = 15.sp,
                            color = LgTextSecondary,
                            lineHeight = 23.sp
                        )
                    }
                }
            }

            Spacer(Modifier.height(36.dp))

            Box(
                modifier = Modifier
                    .weight(1f)
                    .padding(horizontal = 24.dp)
            ) {
                AnimatedContent(
                    targetState = step,
                    transitionSpec = {
                        slideInHorizontally { it } + fadeIn() togetherWith
                                slideOutHorizontally { -it } + fadeOut()
                    },
                    label = "stepContent"
                ) { s ->
                    when (s) {
                        LoginStep.PHONE -> LgPhoneStep(
                            phone = phone,
                            errorMsg = errorMsg,
                            isLoading = isLoading,
                            onChange = {
                                if (it.length <= 10 && it.all(Char::isDigit)) {
                                    phone = it
                                    errorMsg = ""
                                }
                            },
                            onNext = {
                                if (phone.length == 10) sendOtp()
                            }
                        )

                        LoginStep.OTP -> LgOtpStep(
                            otp = otp,
                            errorMsg = errorMsg,
                            otpSuccess = otpSuccess,
                            isLoading = isLoading,
                            resendSeconds = resendSeconds,
                            onChange = { value ->
                                if (
                                    value.length <= OTP_LENGTH &&
                                    value.all(Char::isDigit) &&
                                    !otpSuccess &&
                                    !isLoading
                                ) {
                                    otp = value
                                    errorMsg = ""
                                }
                            },
                            onVerify = { verifyOtp() },
                            onResend = {
                                otp = ""
                                errorMsg = ""
                                sendOtp(forceResend = true)
                            }
                        )

                        LoginStep.NAME -> LgNameStep(
                            name = name,
                            nameError = nameError,
                            isLoading = isLoading,
                            onChange = {
                                name = it
                                nameError = false
                            },
                            onDone = {
                                if (name.trim().length >= 2) {
                                    scope.launch {
                                        isLoading = true
                                        try {
                                            ApiClient.api.updateName(
                                                bearer = "Bearer $authToken",
                                                req = UpdateNameRequest(name = name.trim())
                                            )
                                        } catch (_: Exception) {
                                        }

                                        // Persist display name locally so ProfileScreen can show real data.
                                        context.getSharedPreferences(
                                            "plugbox_prefs",
                                            Context.MODE_PRIVATE
                                        ).edit()
                                            .putString("user_name", name.trim())
                                            .apply()

                                        isLoading = false
                                        onLoginSuccess()
                                    }
                                } else {
                                    nameError = true
                                }
                            }
                        )
                    }
                }
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Firebase sign-in helper
// Signs in -> gets Firebase token -> exchanges with backend -> stores session
// ─────────────────────────────────────────────────────────────────────────────

private suspend fun doSignIn(
    firebaseAuth: FirebaseAuth,
    credential: PhoneAuthCredential,
    context: Context,
    phone: String,
    onSuccess: (token: String, isNewUser: Boolean) -> Unit,
    onError: (msg: String) -> Unit
) {
    try {
        val result = firebaseAuth.signInWithCredential(credential).await()
        val fbUser = result.user ?: return onError("Firebase sign-in failed. Try again.")

        val idToken = fbUser.getIdToken(false).await().token
            ?: return onError("Could not get Firebase token. Try again.")

        val response = ApiClient.api.firebaseLogin(
            FirebaseLoginRequest(idToken = idToken)
        )

        if (response.ok && response.token != null && response.userId != null) {
            // Core auth persistence handled centrally.
            ApiClient.saveToken(context, response.token, response.userId)

            // Save verified phone for ProfileScreen and other session-aware UI.
            context.getSharedPreferences("plugbox_prefs", Context.MODE_PRIVATE)
                .edit()
                .putString("user_phone", "+91${phone.trim()}")
                .apply()

            onSuccess(response.token, response.isNewUser)
        } else {
            onError(response.error ?: "Login failed. Try again.")
        }

    } catch (ex: FirebaseAuthInvalidCredentialsException) {
        onError("Wrong OTP. Please check and try again.")
    } catch (_: Exception) {
        onError("Something went wrong. Please try again.")
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 1 — Phone entry
// ─────────────────────────────────────────────────────────────────────────────

@Composable
private fun LgPhoneStep(
    phone: String,
    errorMsg: String,
    isLoading: Boolean,
    onChange: (String) -> Unit,
    onNext: () -> Unit
) {
    val fr = remember { FocusRequester() }
    LaunchedEffect(Unit) { fr.requestFocus() }

    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {

        Surface(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(14.dp),
            color = LgSurface,
            border = androidx.compose.foundation.BorderStroke(
                1.5.dp,
                when {
                    errorMsg.isNotEmpty() -> LgRed
                    phone.isNotEmpty() -> LgGreen
                    else -> LgDivider
                }
            )
        ) {
            Row(
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 16.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    "+91",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = LgTextPrimary
                )

                Spacer(Modifier.width(8.dp))
                Box(Modifier.width(1.dp).height(20.dp).background(LgDivider))
                Spacer(Modifier.width(12.dp))

                BasicTextField(
                    value = phone,
                    onValueChange = onChange,
                    modifier = Modifier
                        .weight(1f)
                        .focusRequester(fr),
                    singleLine = true,
                    textStyle = TextStyle(
                        fontSize = 18.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = LgTextPrimary,
                        letterSpacing = 2.sp
                    ),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                    cursorBrush = SolidColor(LgGreen),
                    decorationBox = { inner ->
                        Box(contentAlignment = Alignment.CenterStart) {
                            if (phone.isEmpty()) {
                                Text(
                                    "10-digit mobile number",
                                    fontSize = 16.sp,
                                    color = LgTextSecondary
                                )
                            }
                            inner()
                        }
                    }
                )

                if (phone.isNotEmpty()) {
                    IconButton(
                        onClick = { onChange("") },
                        modifier = Modifier.size(20.dp)
                    ) {
                        Icon(
                            Icons.Outlined.Cancel,
                            contentDescription = null,
                            tint = LgTextSecondary,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                }
            }
        }

        if (errorMsg.isNotEmpty()) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                Icon(
                    Icons.Outlined.ErrorOutline,
                    contentDescription = null,
                    tint = LgRed,
                    modifier = Modifier.size(16.dp)
                )
                Text(errorMsg, fontSize = 13.sp, color = LgRed)
            }
        } else {
            Text(
                "We'll send a one-time password to verify your number.",
                fontSize = 13.sp,
                color = LgTextSecondary
            )
        }

        Spacer(Modifier.height(8.dp))

        Button(
            onClick = onNext,
            enabled = phone.length == 10 && !isLoading,
            modifier = Modifier
                .fillMaxWidth()
                .height(56.dp),
            shape = RoundedCornerShape(14.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = LgGreen,
                contentColor = LgWhite,
                disabledContainerColor = LgDivider,
                disabledContentColor = LgWhite
            )
        ) {
            if (isLoading) {
                CircularProgressIndicator(
                    modifier = Modifier.size(20.dp),
                    color = LgWhite,
                    strokeWidth = 2.dp
                )
            } else {
                Text("Send OTP", fontWeight = FontWeight.Bold, fontSize = 16.sp)
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 2 — OTP entry
// ─────────────────────────────────────────────────────────────────────────────

@Composable
private fun LgOtpStep(
    otp: String,
    errorMsg: String,
    otpSuccess: Boolean,
    isLoading: Boolean,
    resendSeconds: Int,
    onChange: (String) -> Unit,
    onVerify: () -> Unit,
    onResend: () -> Unit
) {
    val fr = remember { FocusRequester() }
    LaunchedEffect(Unit) { fr.requestFocus() }

    val hasError = errorMsg.isNotEmpty()

    Column(verticalArrangement = Arrangement.spacedBy(20.dp)) {

        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            repeat(OTP_LENGTH) { i ->
                val digit = otp.getOrNull(i)?.toString() ?: ""
                val isFilled = digit.isNotEmpty()
                val isActive = i == otp.length && !hasError && !otpSuccess

                val borderColor = when {
                    otpSuccess -> LgGreen
                    hasError && isFilled -> LgRed
                    isActive -> LgGreen
                    isFilled -> LgGreen.copy(alpha = 0.4f)
                    else -> LgDivider
                }

                val boxBg = when {
                    otpSuccess -> LgGreenBg
                    hasError && isFilled -> LgRed.copy(alpha = 0.06f)
                    isFilled -> LgGreenBg.copy(alpha = 0.7f)
                    else -> LgSurface
                }

                Box(
                    modifier = Modifier
                        .weight(1f)
                        .aspectRatio(1f)
                        .clip(RoundedCornerShape(12.dp))
                        .background(boxBg)
                        .border(1.5.dp, borderColor, RoundedCornerShape(12.dp)),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = digit,
                        fontSize = 22.sp,
                        fontWeight = FontWeight.Bold,
                        color = when {
                            otpSuccess -> LgGreen
                            hasError -> LgRed
                            else -> LgTextPrimary
                        }
                    )
                }
            }
        }

        BasicTextField(
            value = otp,
            onValueChange = onChange,
            modifier = Modifier
                .size(1.dp)
                .focusRequester(fr),
            enabled = !otpSuccess && !isLoading,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
            singleLine = true,
            textStyle = TextStyle(color = LgWhite.copy(alpha = 0f))
        )

        when {
            otpSuccess -> Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                Icon(
                    Icons.Outlined.CheckCircle,
                    contentDescription = null,
                    tint = LgGreen,
                    modifier = Modifier.size(16.dp)
                )
                Text(
                    "Verified! Taking you in...",
                    fontSize = 13.sp,
                    color = LgGreen,
                    fontWeight = FontWeight.SemiBold
                )
            }

            hasError -> Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                Icon(
                    Icons.Outlined.ErrorOutline,
                    contentDescription = null,
                    tint = LgRed,
                    modifier = Modifier.size(16.dp)
                )
                Text(errorMsg, fontSize = 13.sp, color = LgRed)
            }
        }

        if (!otpSuccess) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Text("Didn't receive it?", fontSize = 13.sp, color = LgTextSecondary)

                if (resendSeconds > 0) {
                    Text(
                        "Resend in ${resendSeconds}s",
                        fontSize = 13.sp,
                        color = LgTextSecondary
                    )
                } else {
                    TextButton(
                        onClick = onResend,
                        enabled = !isLoading,
                        contentPadding = PaddingValues(0.dp)
                    ) {
                        Text(
                            "Resend OTP",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = LgGreen
                        )
                    }
                }
            }
        }

        Button(
            onClick = onVerify,
            enabled = otp.length == OTP_LENGTH && !otpSuccess && !isLoading,
            modifier = Modifier
                .fillMaxWidth()
                .height(56.dp),
            shape = RoundedCornerShape(14.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = LgGreen,
                contentColor = LgWhite,
                disabledContainerColor = LgDivider,
                disabledContentColor = LgWhite
            )
        ) {
            if (isLoading) {
                CircularProgressIndicator(
                    modifier = Modifier.size(20.dp),
                    color = LgWhite,
                    strokeWidth = 2.dp
                )
            } else {
                Text("Verify OTP", fontWeight = FontWeight.Bold, fontSize = 16.sp)
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 3 — Name entry
// ─────────────────────────────────────────────────────────────────────────────

@Composable
private fun LgNameStep(
    name: String,
    nameError: Boolean,
    isLoading: Boolean,
    onChange: (String) -> Unit,
    onDone: () -> Unit
) {
    val fr = remember { FocusRequester() }
    LaunchedEffect(Unit) { fr.requestFocus() }

    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {

        Surface(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(14.dp),
            color = LgSurface,
            border = androidx.compose.foundation.BorderStroke(
                1.5.dp,
                when {
                    nameError -> LgRed
                    name.isNotEmpty() -> LgGreen
                    else -> LgDivider
                }
            )
        ) {
            BasicTextField(
                value = name,
                onValueChange = onChange,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 16.dp)
                    .focusRequester(fr),
                singleLine = true,
                textStyle = TextStyle(
                    fontSize = 18.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = LgTextPrimary
                ),
                keyboardOptions = KeyboardOptions(
                    keyboardType = KeyboardType.Text,
                    capitalization = KeyboardCapitalization.Words
                ),
                cursorBrush = SolidColor(LgGreen),
                decorationBox = { inner ->
                    Box(contentAlignment = Alignment.CenterStart) {
                        if (name.isEmpty()) {
                            Text("Your full name", fontSize = 16.sp, color = LgTextSecondary)
                        }
                        inner()
                    }
                }
            )
        }

        if (nameError) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                Icon(
                    Icons.Outlined.ErrorOutline,
                    contentDescription = null,
                    tint = LgRed,
                    modifier = Modifier.size(16.dp)
                )
                Text(
                    "Please enter your name (at least 2 characters).",
                    fontSize = 13.sp,
                    color = LgRed
                )
            }
        } else {
            Text(
                "Used on your wallet and profile. You can update it later.",
                fontSize = 13.sp,
                color = LgTextSecondary
            )
        }

        Spacer(Modifier.height(8.dp))

        Button(
            onClick = onDone,
            enabled = name.trim().length >= 2 && !isLoading,
            modifier = Modifier
                .fillMaxWidth()
                .height(56.dp),
            shape = RoundedCornerShape(14.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = LgGreen,
                contentColor = LgWhite,
                disabledContainerColor = LgDivider,
                disabledContentColor = LgWhite
            )
        ) {
            if (isLoading) {
                CircularProgressIndicator(
                    modifier = Modifier.size(20.dp),
                    color = LgWhite,
                    strokeWidth = 2.dp
                )
            } else {
                Text("Continue", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                Spacer(Modifier.width(8.dp))
                Icon(
                    Icons.AutoMirrored.Outlined.ArrowForward,
                    contentDescription = null,
                    modifier = Modifier.size(18.dp)
                )
            }
        }
    }
}