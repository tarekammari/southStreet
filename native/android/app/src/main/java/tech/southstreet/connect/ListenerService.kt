package tech.southstreet.connect

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.webkit.CookieManager
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL
import kotlin.concurrent.thread

/**
 * Keeps the app ready for calls while it is closed, like a phone app: a quiet
 * "ready" notification lets Android keep it running, and its own live
 * connection to the server (/api/connect/stream) starts the full-screen call
 * screen + ringtone the moment someone calls. Works without Firebase; when
 * Firebase is set up both paths run and the first one rings.
 */
class ListenerService : Service() {
    @Volatile private var running = false
    private var worker: Thread? = null
    @Volatile private var conn: HttpURLConnection? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopSelf()
            return START_NOT_STICKY
        }
        channel()
        val n = NotificationCompat.Builder(this, CH)
            .setSmallIcon(R.drawable.ic_stat_call)
            .setContentTitle("SS Connect جاهز لاستقبال المكالمات")
            .setContentText("يبقى التطبيق متصلاً ليرنّ الهاتف عند الاتصال")
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .setOngoing(true)
            .setShowWhen(false)
            .setContentIntent(Notify.openApp(this, "", 51))
            .build()
        val type = if (Build.VERSION.SDK_INT >= 34) ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE else 0
        try {
            ServiceCompat.startForeground(this, ID, n, type)
        } catch (_: Exception) {
            stopSelf()
            return START_NOT_STICKY
        }
        if (!running) {
            running = true
            worker = thread(name = "connect-listener") { loop() }
        }
        return START_STICKY
    }

    private fun channel() {
        getSystemService(NotificationManager::class.java).createNotificationChannel(
            NotificationChannel(CH, "جاهز للمكالمات", NotificationManager.IMPORTANCE_MIN).apply { setShowBadge(false) }
        )
    }

    private fun loop() {
        var backoff = 2_000L
        while (running) {
            val result = listenOnce()
            if (!running) break
            if (result == 401) {
                // Signed out: nothing to listen for until the app is opened again.
                Thread.sleep(60_000)
                continue
            }
            backoff = if (result == 200) 1_000L else (backoff * 2).coerceAtMost(60_000L)
            try { Thread.sleep(backoff) } catch (_: InterruptedException) { break }
        }
    }

    /** One stream connection (the server ends it about every 50 s). Returns the HTTP status. */
    private fun listenOnce(): Int {
        val cookie = CookieManager.getInstance().getCookie(Net.origin) ?: return 401
        if (!cookie.contains("south_street_token=")) return 401
        return try {
            val c = URL("${Net.origin}/api/connect/stream").openConnection() as HttpURLConnection
            conn = c
            c.connectTimeout = 15_000
            c.readTimeout = 40_000 // the server pings every 15 s
            c.setRequestProperty("Accept", "text/event-stream")
            c.setRequestProperty("Cookie", cookie)
            c.setRequestProperty("User-Agent", Net.userAgent)
            val code = c.responseCode
            if (code != 200) return code
            BufferedReader(InputStreamReader(c.inputStream, Charsets.UTF_8)).use { r ->
                var event = ""
                val data = StringBuilder()
                while (running) {
                    val line = r.readLine() ?: break
                    when {
                        line.startsWith("event:") -> event = line.substring(6).trim()
                        line.startsWith("data:") -> data.append(line.substring(5).trim())
                        line.isEmpty() -> {
                            if (event.isNotEmpty() && data.isNotEmpty()) handle(event, data.toString())
                            event = ""
                            data.setLength(0)
                        }
                    }
                }
            }
            200
        } catch (_: Exception) {
            0
        } finally {
            conn?.disconnect()
            conn = null
        }
    }

    private fun handle(event: String, json: String) {
        val o = try { JSONObject(json) } catch (_: Exception) { return }
        when (event) {
            "incoming" -> {
                if (MainActivity.visible) return // the open app shows and rings the call itself
                val id = o.optString("id").ifBlank { return }
                if (CallService.current == id) return // already ringing (e.g. via Firebase)
                val caller = o.optJSONObject("caller")
                CallService.ring(
                    this,
                    CallInfo(id, caller?.optString("name").orEmpty().ifBlank { "مكالمة" }, caller?.optString("photo").orEmpty(), caller?.optString("roleLabel").orEmpty())
                )
            }
            "chat" -> {
                // A new message while the app is closed (only the recipient's events carry a preview).
                if (MainActivity.visible) return
                val name = o.optString("name").ifBlank { return }
                val chatId = o.optString("chatId")
                Notify.message(this, name, o.optString("preview"), "/connect?chat=${o.optString("from")}", "chat-$chatId", o.optString("msgId"))
            }
            "call" -> {
                // The caller hung up / someone answered elsewhere: stop ringing.
                val id = o.optString("id")
                val state = o.optString("state")
                if (id.isNotBlank() && id == CallService.ringingNow && state.isNotBlank() && state != "ringing") {
                    CallService.stop(this)
                    IncomingCallActivity.close()
                    Telecom.end(Telecom.causeOf(state))
                }
            }
        }
    }

    override fun onDestroy() {
        running = false
        try { conn?.disconnect() } catch (_: Exception) { }
        worker?.interrupt()
        super.onDestroy()
    }

    companion object {
        private const val CH = "listener"
        private const val ID = 7100
        private const val ACTION_STOP = "stop"

        fun start(ctx: Context) {
            try {
                ContextCompat.startForegroundService(ctx, Intent(ctx, ListenerService::class.java))
            } catch (_: Exception) { }
        }
    }
}

/** Starts the listener after the phone restarts or the app is updated. */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED || intent.action == Intent.ACTION_MY_PACKAGE_REPLACED) {
            ListenerService.start(ctx)
        }
    }
}
