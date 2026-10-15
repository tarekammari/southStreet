package tech.southstreet.connect

import android.Manifest
import android.annotation.SuppressLint
import android.app.NotificationManager
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.browser.customtabs.CustomTabColorSchemeParams
import androidx.browser.customtabs.CustomTabsIntent
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import org.json.JSONObject
import java.lang.ref.WeakReference

/**
 * The app itself: the Connect web app (always up to date from the server) in a
 * WebView, plus a bridge — window.SSAndroid — for what the web cannot do:
 * the push token, the ringing / ongoing call service and phone settings.
 */
class MainActivity : AppCompatActivity() {
    private lateinit var web: WebView
    private var pendingMic: PermissionRequest? = null

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Notify.channels(this)
        instance = WeakReference(this)

        web = WebView(this)
        setContentView(web)
        web.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false
            userAgentString = "$userAgentString SSConnectAndroid/${BuildConfig.VERSION_NAME}"
        }
        android.webkit.CookieManager.getInstance().setAcceptThirdPartyCookies(web, false)
        web.addJavascriptInterface(Bridge(), "SSAndroid")
        web.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val url = request.url.toString()
                if (url.startsWith(Net.origin)) return false
                // Other sites (maps, phone numbers, mail) open outside the app.
                try { startActivity(Intent(Intent.ACTION_VIEW, request.url)) } catch (_: Exception) { }
                return true
            }

            override fun onPageFinished(view: WebView, url: String) {
                android.webkit.CookieManager.getInstance().flush()
                ListenerService.start(this@MainActivity) // (re)connects with the fresh sign-in
                Prefs.registerToken(this@MainActivity) // signed in now? tie this phone to the account
            }
        }
        web.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest) {
                runOnUiThread {
                    if (!request.origin.toString().startsWith(Net.origin)) return@runOnUiThread request.deny()
                    if (hasMic()) request.grant(request.resources)
                    else {
                        pendingMic = request
                        ActivityCompat.requestPermissions(this@MainActivity, arrayOf(Manifest.permission.RECORD_AUDIO), REQ_MIC)
                    }
                }
            }
        }

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (web.canGoBack()) web.goBack() else moveTaskToBack(true)
            }
        })

        web.loadUrl(signInUrl(intent) ?: urlFrom(intent) ?: "${Net.origin}/connect")
        applyCallWindow(intent)
        // Permissions are asked by the page's one-tap setup ("موافق — أكمل الإعداد"),
        // after sign-in, all in one go — not as surprise prompts at launch.
        ListenerService.start(this)
        Prefs.fetchToken(this) { token ->
            runOnUiThread { js("window.dispatchEvent(new CustomEvent('ss-native-token',{detail:${Net.quote(token)}}))") }
            Prefs.registerToken(this)
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        applyCallWindow(intent)
        (signInUrl(intent) ?: urlFrom(intent))?.let { web.loadUrl(it) }
    }

    /** Answering from the lock screen: show the call over the lock screen too. */
    private fun applyCallWindow(intent: Intent?) {
        if (intent?.getBooleanExtra(EXTRA_ANSWER, false) == true) {
            CallService.stop(this)
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        }
    }

    /** ssconnect://signin?code=… — finish the Google sign-in done in the browser. */
    private fun signInUrl(intent: Intent?): String? {
        val data = intent?.data ?: return null
        if (data.scheme != "ssconnect" || data.host != "signin") return null
        val code = data.getQueryParameter("code") ?: return null
        return "${Net.origin}/api/auth/app-handoff?code=${Uri.encode(code)}"
    }

    private fun urlFrom(intent: Intent?): String? {
        val path = intent?.getStringExtra(EXTRA_URL)?.takeIf { it.isNotBlank() } ?: return null
        return Net.absolute(path)
    }

    private fun hasMic() = ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED

    private fun notificationsOn() = androidx.core.app.NotificationManagerCompat.from(this).areNotificationsEnabled()

    private fun batteryOk() = getSystemService(android.os.PowerManager::class.java).isIgnoringBatteryOptimizations(packageName)

    private fun fullScreenOk(): Boolean =
        Build.VERSION.SDK_INT < 34 || getSystemService(NotificationManager::class.java).canUseFullScreenIntent()

    /** Setup step 1: notifications + microphone, in one system prompt. */
    private fun askRuntimePermissions() {
        val want = mutableListOf<String>()
        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) want += Manifest.permission.POST_NOTIFICATIONS
        if (!hasMic()) want += Manifest.permission.RECORD_AUDIO
        if (want.isNotEmpty()) ActivityCompat.requestPermissions(this, want.toTypedArray(), REQ_SETUP)
        else setupChanged()
    }

    /** Setup step 2: Android must not put the app to sleep, or calls cannot ring while it is closed. */
    private fun askBattery() {
        if (batteryOk()) return setupChanged()
        try {
            @SuppressLint("BatteryLife")
            val i = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:$packageName"))
            startActivity(i)
        } catch (_: Exception) { setupChanged() }
    }

    private fun openFullScreen() {
        val i = if (Build.VERSION.SDK_INT >= 34) {
            Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, Uri.parse("package:$packageName"))
        } else {
            Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, packageName)
        }
        try { startActivity(i) } catch (_: Exception) { setupChanged() }
    }

    /** Tells the page to look again (it moves on to the next setup step by itself). */
    private fun setupChanged() = js("window.dispatchEvent(new Event('ss-native-setup'))")

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == REQ_SETUP) setupChanged()
        pendingMic?.let { req ->
            if (hasMic()) req.grant(req.resources) else req.deny()
            pendingMic = null
        }
    }

    override fun onResume() {
        super.onResume()
        visible = true
        // Back from a settings screen of the setup: continue with the next step.
        if (::web.isInitialized) setupChanged()
    }

    override fun onPause() {
        visible = false
        super.onPause()
    }

    override fun onDestroy() {
        if (instance?.get() === this) instance = null
        web.destroy()
        super.onDestroy()
    }

    fun js(code: String) = web.evaluateJavascript(code, null)

    /** window.SSAndroid — called by the Connect page. */
    inner class Bridge {
        @JavascriptInterface fun platform() = "android"
        @JavascriptInterface fun version() = BuildConfig.VERSION_NAME
        @JavascriptInterface fun token() = Prefs.token(this@MainActivity)
        @JavascriptInterface fun firebase() = BuildConfig.HAS_FIREBASE

        /** False while the app is in the background: then the phone's call screen rings, not the page. */
        @JavascriptInterface fun inForeground() = visible

        /** Google sign-in runs in a Chrome tab (Google blocks it inside apps). */
        @JavascriptInterface fun openSignIn(url: String) {
            if (!url.startsWith(Net.origin)) return
            runOnUiThread {
                try {
                    CustomTabsIntent.Builder()
                        .setDefaultColorSchemeParams(CustomTabColorSchemeParams.Builder().setToolbarColor(0xFF065F46.toInt()).build())
                        .build()
                        .launchUrl(this@MainActivity, Uri.parse(url))
                } catch (_: Exception) {
                    try { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) } catch (_: Exception) { }
                }
            }
        }

        /** {phase, name, ...} on every call change: keeps the call alive with the screen off. */
        @JavascriptInterface fun callState(json: String) {
            val s = try { JSONObject(json) } catch (_: Exception) { return }
            when (s.optString("phase")) {
                "active", "connecting", "calling", "ringing" -> CallService.ongoing(this@MainActivity, s.optString("name"))
                "ended", "" -> CallService.stop(this@MainActivity)
                "incoming" -> { /* the page rings while it is on screen */ }
            }
        }

        /** Android 14+: may this app show the full-screen call screen? */
        @JavascriptInterface fun canFullScreen(): Boolean = fullScreenOk()

        @JavascriptInterface fun openFullScreenSettings() = runOnUiThread { openFullScreen() }

        @JavascriptInterface fun notificationsOn(): Boolean = this@MainActivity.notificationsOn()

        /** One-tap setup: what is still missing for calls to ring like a phone. */
        @JavascriptInterface fun setupStatus(): String = JSONObject()
            .put("notifications", this@MainActivity.notificationsOn())
            .put("mic", hasMic())
            .put("battery", batteryOk())
            .put("fullScreen", fullScreenOk())
            .toString()

        /** One-tap setup: ask for one step — permissions | battery | fullscreen | app (app info screen). */
        @JavascriptInterface fun setupStep(step: String) {
            runOnUiThread {
                when (step) {
                    "permissions" -> askRuntimePermissions()
                    "battery" -> askBattery()
                    "fullscreen" -> openFullScreen()
                    "app" -> try {
                        startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:$packageName")))
                    } catch (_: Exception) { }
                }
            }
        }

        @JavascriptInterface fun openNotificationSettings() {
            runOnUiThread {
                try {
                    startActivity(Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, packageName))
                } catch (_: Exception) { }
            }
        }
    }

    companion object {
        const val EXTRA_URL = "url"
        const val EXTRA_ANSWER = "answer"
        private const val REQ_MIC = 41
        private const val REQ_SETUP = 42

        @Volatile var visible = false
        private var instance: WeakReference<MainActivity>? = null

        /** Sends a call button (hang up…) from a notification to the page. Returns false if the app is gone. */
        fun sendCallAction(action: String): Boolean {
            val a = instance?.get() ?: return false
            a.runOnUiThread { a.js("window.dispatchEvent(new CustomEvent('ss-native-call',{detail:${Net.quote(action)}}))") }
            return true
        }
    }
}
