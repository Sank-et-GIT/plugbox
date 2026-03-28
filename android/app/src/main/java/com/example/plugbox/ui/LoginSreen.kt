// ─────────────────────────────────────────────────────────────────────────────
// LoginScreen.kt
//
// FIXES APPLIED:
//   • OTP attempt counter — 3 strikes → 30min lockout UI
//   • OTP success flash — boxes turn green briefly before advancing
//   • Subtle green header strip — brand personality on login screen
//   • Security: OTP comparison noted as server-side in Phase 2
// ─────────────────────────────────────────────────────────────────────────────

package com.example.plugbox.ui

import androidx.activity.compose.BackHandler
import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
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
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.google.maps.android.ktx.BuildConfig
import kotlinx.coroutines.delay

private val LgGreen         = Color(0xFF16C784)
private val LgGreenBg       = Color(0xFFECFDF5)
private val LgGreenDark     = Color(0xFF065F46)
private val LgRed           = Color(0xFFEF4444)
private val LgOrange        = Color(0xFFF59E0B)
private val LgTextPrimary   = Color(0xFF111827)
private val LgTextSecondary = Color(0xFF6B7280)
private val LgDivider       = Color(0xFFE5E7EB)
private val LgWhite         = Color(0xFFFFFFFF)
private val LgSurface       = Color(0xFFF9FAFB)

private enum class LoginStep { PHONE, OTP, NAME }

private const val FAKE_OTP        = "123456"
private const val OTP_LENGTH      = 6
private const val RESEND_SECONDS  = 30
private const val MAX_OTP_ATTEMPTS = 3
private const val LOCKOUT_MINUTES  = 30

@Composable
fun LoginScreen(
    onLoginSuccess: () -> Unit,
    modifier:       Modifier = Modifier
) {
    val context = LocalContext.current

    var step         by remember { mutableStateOf(LoginStep.PHONE) }
    var phone        by remember { mutableStateOf("") }
    var otp          by remember { mutableStateOf("") }
    var name         by remember { mutableStateOf("") }
    var otpError     by remember { mutableStateOf(false) }
    var nameError    by remember { mutableStateOf(false) }
    var attemptsLeft by remember { mutableIntStateOf(MAX_OTP_ATTEMPTS) }
    var isLockedOut  by remember { mutableStateOf(false) }
    var otpSuccess   by remember { mutableStateOf(false) }  // flash state

    // Resend countdown
    var resendSeconds by remember { mutableIntStateOf(0) }
    LaunchedEffect(step) {
        if (step == LoginStep.OTP) {
            resendSeconds  = RESEND_SECONDS
            attemptsLeft   = MAX_OTP_ATTEMPTS
            isLockedOut    = false
            while (resendSeconds > 0) { delay(1_000L); resendSeconds-- }
        }
    }

    BackHandler(enabled = step != LoginStep.PHONE) {
        when (step) {
            LoginStep.OTP  -> { step = LoginStep.PHONE; otp = ""; otpError = false; otpSuccess = false }
            LoginStep.NAME -> step = LoginStep.OTP
            else           -> {}
        }
    }

    // OTP verify logic — extracted so both auto and manual call it
    fun verifyOtp() {
        if (isLockedOut || otp.length < OTP_LENGTH) return
        // Phase 2: replace with ApiClient.api.verifyOtp("+91$phone", otp)
        // NEVER compare OTP client-side in production
        if (otp == FAKE_OTP) {
            otpSuccess = true   // trigger green flash
            // Advance after flash duration
        } else {
            attemptsLeft--
            otpError = true
            if (attemptsLeft <= 0) isLockedOut = true
        }
    }

    // When otpSuccess fires, wait for flash then advance
    LaunchedEffect(otpSuccess) {
        if (otpSuccess) {
            delay(600L)  // green flash duration
            step       = LoginStep.NAME
            otpSuccess = false
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

            // ── Green brand header strip ───────────────────────────────────
            // Subtle — just enough to say "this is PlugBox"
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(6.dp)
                    .background(LgGreen)
            )

            // ── Top bar ────────────────────────────────────────────────────
            Row(
                modifier          = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 8.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                if (step != LoginStep.PHONE) {
                    IconButton(onClick = {
                        when (step) {
                            LoginStep.OTP  -> {
                                step = LoginStep.PHONE
                                otp  = ""
                                otpError   = false
                                otpSuccess = false
                            }
                            LoginStep.NAME -> step = LoginStep.OTP
                            else -> {}
                        }
                    }) {
                        Icon(Icons.AutoMirrored.Outlined.ArrowBack, "Back",
                            tint = LgTextPrimary)
                    }
                } else {
                    Spacer(Modifier.size(48.dp))
                }
            }

            // ── Logo + step title ──────────────────────────────────────────
            Column(Modifier.padding(horizontal = 24.dp)) {
                // Logo mark
                Box(
                    modifier = Modifier
                        .size(56.dp)
                        .clip(RoundedCornerShape(16.dp))
                        .background(LgGreen),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Outlined.Bolt, null,
                        tint = LgWhite, modifier = Modifier.size(32.dp))
                }

                Spacer(Modifier.height(16.dp))

                AnimatedContent(
                    targetState   = step,
                    transitionSpec = {
                        slideInHorizontally { it } + fadeIn() togetherWith
                                slideOutHorizontally { -it } + fadeOut()
                    },
                    label = "stepTitle"
                ) { currentStep ->
                    Column {
                        Text(
                            text = when (currentStep) {
                                LoginStep.PHONE -> "Welcome to PlugBox"
                                LoginStep.OTP   -> "Verify your number"
                                LoginStep.NAME  -> "What's your name?"
                            },
                            fontSize = 26.sp, fontWeight = FontWeight.Bold,
                            color = LgTextPrimary
                        )
                        Spacer(Modifier.height(8.dp))
                        Text(
                            text = when (currentStep) {
                                LoginStep.PHONE -> "Enter your mobile number to get started"
                                LoginStep.OTP   -> "We sent a 6-digit OTP to +91 $phone"
                                LoginStep.NAME  -> "This is how you'll appear in PlugBox"
                            },
                            fontSize = 15.sp, color = LgTextSecondary, lineHeight = 23.sp
                        )
                    }
                }
            }

            Spacer(Modifier.height(36.dp))

            // ── Step content ───────────────────────────────────────────────
            Box(
                modifier = Modifier
                    .weight(1f)
                    .padding(horizontal = 24.dp)
            ) {
                AnimatedContent(
                    targetState   = step,
                    transitionSpec = {
                        slideInHorizontally { it } + fadeIn() togetherWith
                                slideOutHorizontally { -it } + fadeOut()
                    },
                    label = "stepFields"
                ) { currentStep ->
                    when (currentStep) {
                        LoginStep.PHONE -> LgPhoneStep(
                            phone    = phone,
                            onChange = { if (it.length <= 10 && it.all(Char::isDigit)) phone = it },
                            onNext   = { if (phone.length == 10) step = LoginStep.OTP }
                        )
                        LoginStep.OTP -> LgOtpStep(
                            otp           = otp,
                            otpError      = otpError,
                            otpSuccess    = otpSuccess,
                            attemptsLeft  = attemptsLeft,
                            isLockedOut   = isLockedOut,
                            resendSeconds = resendSeconds,
                            onChange      = { value ->
                                if (value.length <= OTP_LENGTH && value.all(Char::isDigit)
                                    && !isLockedOut && !otpSuccess) {
                                    otp      = value
                                    otpError = false
                                    if (value.length == OTP_LENGTH) verifyOtp()
                                }
                            },
                            onVerify = { verifyOtp() },
                            onResend = {
                                otp           = ""
                                otpError      = false
                                otpSuccess    = false
                                attemptsLeft  = MAX_OTP_ATTEMPTS
                                isLockedOut   = false
                                resendSeconds = RESEND_SECONDS
                            }
                        )
                        LoginStep.NAME -> LgNameStep(
                            name      = name,
                            nameError = nameError,
                            onChange  = { name = it; nameError = false },
                            onDone    = {
                                if (name.trim().length >= 2) {
                                    context.getSharedPreferences(
                                        "plugbox_prefs",
                                        android.content.Context.MODE_PRIVATE
                                    ).edit()
                                        .putString("user_name", name.trim())
                                        .putBoolean("logged_in", true)
                                        .apply()
                                    onLoginSuccess()
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
// Step 1 — Phone entry
// ─────────────────────────────────────────────────────────────────────────────

@Composable
private fun LgPhoneStep(
    phone:    String,
    onChange: (String) -> Unit,
    onNext:   () -> Unit
) {
    val focusRequester = remember { FocusRequester() }
    LaunchedEffect(Unit) { focusRequester.requestFocus() }

    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {

        Surface(
            modifier = Modifier.fillMaxWidth(),
            shape    = RoundedCornerShape(14.dp),
            color    = LgSurface,
            border   = androidx.compose.foundation.BorderStroke(
                1.5.dp,
                if (phone.isNotEmpty()) LgGreen else LgDivider)
        ) {
            Row(
                modifier          = Modifier.padding(horizontal = 16.dp, vertical = 16.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("+91", fontSize = 16.sp,
                    fontWeight = FontWeight.SemiBold, color = LgTextPrimary)
                Spacer(Modifier.width(8.dp))
                Box(Modifier.width(1.dp).height(20.dp).background(LgDivider))
                Spacer(Modifier.width(12.dp))

                BasicTextField(
                    value         = phone,
                    onValueChange = onChange,
                    modifier      = Modifier.weight(1f).focusRequester(focusRequester),
                    singleLine    = true,
                    textStyle     = TextStyle(
                        fontSize      = 18.sp,
                        fontWeight    = FontWeight.SemiBold,
                        color         = LgTextPrimary,
                        letterSpacing = 2.sp
                    ),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                    cursorBrush     = SolidColor(LgGreen),
                    decorationBox   = { inner ->
                        Box(contentAlignment = Alignment.CenterStart) {
                            if (phone.isEmpty()) {
                                Text("10-digit mobile number",
                                    fontSize = 16.sp, color = LgTextSecondary)
                            }
                            inner()
                        }
                    }
                )

                if (phone.isNotEmpty()) {
                    IconButton(onClick = { onChange("") },
                        modifier = Modifier.size(20.dp)) {
                        Icon(Icons.Outlined.Cancel, null,
                            tint = LgTextSecondary, modifier = Modifier.size(18.dp))
                    }
                }
            }
        }

        Text("We'll send a one-time password to verify your number.",
            fontSize = 13.sp, color = LgTextSecondary)

        Spacer(Modifier.height(8.dp))

        Button(
            onClick  = onNext,
            enabled  = phone.length == 10,
            modifier = Modifier.fillMaxWidth().height(56.dp),
            shape    = RoundedCornerShape(14.dp),
            colors   = ButtonDefaults.buttonColors(
                containerColor         = LgGreen,
                contentColor           = LgWhite,
                disabledContainerColor = LgDivider,
                disabledContentColor   = LgWhite
            )
        ) {
            Text("Send OTP", fontWeight = FontWeight.Bold, fontSize = 16.sp)
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 2 — OTP entry
//
// otpSuccess = true → all boxes flash green briefly before advancing
// attemptsLeft tracks wrong guesses — shows "2 attempts remaining"
// isLockedOut = true → all boxes red, disabled, shows lockout message
// ─────────────────────────────────────────────────────────────────────────────

@Composable
private fun LgOtpStep(
    otp:           String,
    otpError:      Boolean,
    otpSuccess:    Boolean,
    attemptsLeft:  Int,
    isLockedOut:   Boolean,
    resendSeconds: Int,
    onChange:      (String) -> Unit,
    onVerify:      () -> Unit,
    onResend:      () -> Unit
) {
    val focusRequester = remember { FocusRequester() }
    LaunchedEffect(Unit) { focusRequester.requestFocus() }

    Column(verticalArrangement = Arrangement.spacedBy(20.dp)) {

        // 6 digit boxes
        Row(
            modifier              = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            repeat(OTP_LENGTH) { index ->
                val digit    = otp.getOrNull(index)?.toString() ?: ""
                val isFilled = digit.isNotEmpty()
                val isActive = index == otp.length && !isLockedOut

                // Box border color logic:
                // success → green flash
                // error   → red
                // active  → green
                // filled  → light green
                // empty   → gray
                val borderColor = when {
                    otpSuccess -> LgGreen
                    isLockedOut || (otpError && isFilled) -> LgRed
                    isActive   -> LgGreen
                    isFilled   -> LgGreen.copy(alpha = 0.4f)
                    else       -> LgDivider
                }

                val boxBg = when {
                    otpSuccess              -> LgGreenBg
                    isLockedOut && isFilled -> LgRed.copy(alpha = 0.06f)
                    isFilled                -> LgGreenBg.copy(alpha = 0.7f)
                    else                    -> LgSurface
                }

                Box(
                    modifier = Modifier
                        .weight(1f)
                        .aspectRatio(1f)           // perfect squares
                        .clip(RoundedCornerShape(12.dp))
                        .background(boxBg)
                        .border(1.5.dp, borderColor, RoundedCornerShape(12.dp)),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text       = digit,
                        fontSize   = 22.sp,
                        fontWeight = FontWeight.Bold,
                        color      = when {
                            otpSuccess  -> LgGreen
                            isLockedOut -> LgRed
                            otpError    -> LgRed
                            else        -> LgTextPrimary
                        }
                    )
                }
            }
        }

        // Hidden field that actually receives input
        BasicTextField(
            value         = otp,
            onValueChange = onChange,
            modifier      = Modifier
                .size(1.dp)
                .focusRequester(focusRequester),
            enabled         = !isLockedOut && !otpSuccess,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
            singleLine      = true,
            textStyle       = TextStyle(color = LgWhite.copy(alpha = 0f))
        )

        // Status messages
        when {
            otpSuccess -> {
                Row(
                    verticalAlignment     = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Icon(Icons.Outlined.CheckCircle, null,
                        tint = LgGreen, modifier = Modifier.size(16.dp))
                    Text("Verified! Taking you in...",
                        fontSize = 13.sp, color = LgGreen,
                        fontWeight = FontWeight.SemiBold)
                }
            }
            isLockedOut -> {
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    shape    = RoundedCornerShape(10.dp),
                    color    = LgRed.copy(alpha = 0.06f),
                    border   = androidx.compose.foundation.BorderStroke(
                        1.dp, LgRed.copy(0.2f))
                ) {
                    Row(
                        Modifier.padding(12.dp),
                        Arrangement.spacedBy(8.dp),
                        Alignment.CenterVertically
                    ) {
                        Icon(Icons.Outlined.Lock, null,
                            tint = LgRed, modifier = Modifier.size(16.dp))
                        Text(
                            "Too many wrong attempts. " +
                                    "Try again in $LOCKOUT_MINUTES minutes.",
                            fontSize = 13.sp, color = LgRed, lineHeight = 20.sp
                        )
                    }
                }
            }
            otpError -> {
                Row(
                    verticalAlignment     = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Icon(Icons.Outlined.ErrorOutline, null,
                        tint = LgRed, modifier = Modifier.size(16.dp))
                    Text(
                        "Incorrect OTP. $attemptsLeft attempt${if (attemptsLeft == 1) "" else "s"} remaining.",
                        fontSize = 13.sp, color = LgRed
                    )
                }
            }
        }

        // Resend row
        if (!isLockedOut && !otpSuccess) {
            Row(
                verticalAlignment     = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Text("Didn't receive it?",
                    fontSize = 13.sp, color = LgTextSecondary)
                if (resendSeconds > 0) {
                    Text("Resend in ${resendSeconds}s",
                        fontSize = 13.sp, color = LgTextSecondary)
                } else {
                    TextButton(
                        onClick        = onResend,
                        contentPadding = PaddingValues(0.dp)
                    ) {
                        Text("Resend OTP", fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold, color = LgGreen)
                    }
                }
            }
        }

        // Dev hint — debug only
        if (false) {
            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape    = RoundedCornerShape(10.dp),
                color    = LgGreenBg,
                border   = androidx.compose.foundation.BorderStroke(
                    1.dp, LgGreen.copy(0.2f))
            ) {
                Text(
                    "Dev: Use OTP 1 2 3 4 5 6",
                    fontSize = 12.sp,
                    color = LgGreenDark,
                    modifier = Modifier.padding(10.dp)
                )
            }
        }
        Button(
            onClick  = onVerify,
            enabled  = otp.length == OTP_LENGTH && !isLockedOut && !otpSuccess,
            modifier = Modifier.fillMaxWidth().height(56.dp),
            shape    = RoundedCornerShape(14.dp),
            colors   = ButtonDefaults.buttonColors(
                containerColor         = LgGreen,
                contentColor           = LgWhite,
                disabledContainerColor = LgDivider,
                disabledContentColor   = LgWhite
            )
        ) {
            Text("Verify OTP", fontWeight = FontWeight.Bold, fontSize = 16.sp)
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 3 — Name entry
// ─────────────────────────────────────────────────────────────────────────────

@Composable
private fun LgNameStep(
    name:      String,
    nameError: Boolean,
    onChange:  (String) -> Unit,
    onDone:    () -> Unit
) {
    val focusRequester = remember { FocusRequester() }
    LaunchedEffect(Unit) { focusRequester.requestFocus() }

    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {

        Surface(
            modifier = Modifier.fillMaxWidth(),
            shape    = RoundedCornerShape(14.dp),
            color    = LgSurface,
            border   = androidx.compose.foundation.BorderStroke(
                1.5.dp,
                when {
                    nameError         -> LgRed
                    name.isNotEmpty() -> LgGreen
                    else              -> LgDivider
                }
            )
        ) {
            BasicTextField(
                value         = name,
                onValueChange = onChange,
                modifier      = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 16.dp)
                    .focusRequester(focusRequester),
                singleLine    = true,
                textStyle     = TextStyle(
                    fontSize   = 18.sp,
                    fontWeight = FontWeight.SemiBold,
                    color      = LgTextPrimary
                ),
                keyboardOptions = KeyboardOptions(
                    keyboardType   = KeyboardType.Text,
                    capitalization = androidx.compose.ui.text.input.KeyboardCapitalization.Words
                ),
                cursorBrush   = SolidColor(LgGreen),
                decorationBox = { inner ->
                    Box(contentAlignment = Alignment.CenterStart) {
                        if (name.isEmpty()) {
                            Text("Your full name",
                                fontSize = 16.sp, color = LgTextSecondary)
                        }
                        inner()
                    }
                }
            )
        }

        if (nameError) {
            Row(
                verticalAlignment     = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                Icon(Icons.Outlined.ErrorOutline, null,
                    tint = LgRed, modifier = Modifier.size(16.dp))
                Text("Please enter your name (at least 2 characters).",
                    fontSize = 13.sp, color = LgRed)
            }
        }

        Text("Used on your wallet and profile. You can update it later.",
            fontSize = 13.sp, color = LgTextSecondary)

        Spacer(Modifier.height(8.dp))

        Button(
            onClick  = onDone,
            enabled  = name.trim().length >= 2,
            modifier = Modifier.fillMaxWidth().height(56.dp),
            shape    = RoundedCornerShape(14.dp),
            colors   = ButtonDefaults.buttonColors(
                containerColor         = LgGreen,
                contentColor           = LgWhite,
                disabledContainerColor = LgDivider,
                disabledContentColor   = LgWhite
            )
        ) {
            Text("Continue", fontWeight = FontWeight.Bold, fontSize = 16.sp)
            Spacer(Modifier.width(8.dp))
            Icon(Icons.Outlined.ArrowForward, null, modifier = Modifier.size(18.dp))
        }
    }
}