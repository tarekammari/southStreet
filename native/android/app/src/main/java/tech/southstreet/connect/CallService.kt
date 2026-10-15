package tech.southstreet.connect

import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.MediaPlayer
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.ServiceCompat
import kotlin.concurrent.thread

/** One incoming / ongoing call. */
data class CallInfo(val id: String, val caller: String, val photo: String, val role: String) {
    fun toBundle() = Bundle().apply {
        putString("id", id); putString("caller", caller); putString("photo", photo); putString("role", role)
    }

    companion object {
        fun from(b: Bundle?): CallInfo? {
            val id = b?.getString("id") ?: return null
            return CallInfo(id, b.getString("caller") ?: "مكالمة", b.getString("photo") ?: "", b.getString("role") ?: "")
        }

        fun from(data: Map<String, String>): CallInfo? {
            val id = data["callId"] ?: return null
            return CallInfo(id, data["caller"] ?: data["title"]?.removePrefix("📞 ") ?: "مكالمة", data["photo"] ?: "", data["role"] ?: "")
        }
    }
}

/**
 * Foreground service of a call, like the phone app:
 *  - RING: shows the call notification + full-screen screen, loops the ringtone
 *    (rising volume) and vibrates, following ring / vibrate / silent mode;
 *  - ONGOING: after answering, keeps the app (and its microphone) alive with an
 *    "ongoing call" notification and a hang-up button, even with the screen off.
 */
class CallService : Service() {
    private var player: MediaPlayer? = null
    private var vibrator: Vibrator? = null
    private var wake: PowerManager.WakeLock? = null
    private val handler = Handler(Looper.getMainLooper())
    private var ringing: CallInfo? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Notify.channels(this)
        when (intent?.action) {
            ACTION_RING -> CallInfo.from(intent.extras)?.let { ring(it) }
            ACTION_ONGOING -> ongoing(intent.getStringExtra("caller") ?: "")
            else -> stopEverything()
        }
        return START_NOT_STICKY
    }

    private fun ring(call: CallInfo) {
        // The same call can be announced twice (live stream + push): ring once.
        if (ringing?.id == call.id && player != null) return
        stopSound() // never leave an earlier ringtone playing
        ringing = call
        current = call.id
        foreground(Notify.incoming(this, call, null), ServiceInfo.FOREGROUND_SERVICE_TYPE_PHONE_CALL)
        // Caller photo: refresh the notification once it has loaded.
        thread {
            val photo = Net.bitmap(call.photo)
            if (photo != null && ringing?.id == call.id) {
                try {
                    NotificationManagerCompat.from(this).notify(Notify.ID_CALL, Notify.incoming(this, call, photo))
                } catch (_: SecurityException) { }
            }
        }
        wake = (getSystemService(POWER_SERVICE) as PowerManager)
            .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "ssconnect:ring").apply { acquire(60_000) }
        startSound()
        // Nobody answered: the server also marks it missed after 45 s.
        handler.postDelayed({ if (ringing?.id == call.id) stopEverything() }, 50_000)
    }

    private fun startSound() {
        val audio = getSystemService(AUDIO_SERVICE) as AudioManager
        val mode = audio.ringerMode
        if (mode != AudioManager.RINGER_MODE_SILENT) vibrate()
        if (mode != AudioManager.RINGER_MODE_NORMAL) return
        try {
            player = MediaPlayer().apply {
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                )
                setDataSource(this@CallService, Uri.parse("android.resource://$packageName/${R.raw.ringtone}"))
                isLooping = true
                prepare()
                setVolume(0.35f, 0.35f)
                start()
            }
            // Starts soft, then swells to full ring volume over ~8 seconds.
            var v = 0.35f
            val swell = object : Runnable {
                override fun run() {
                    val p = player ?: return
                    v = (v + 0.05f).coerceAtMost(1f)
                    p.setVolume(v, v)
                    if (v < 1f) handler.postDelayed(this, 500)
                }
            }
            handler.postDelayed(swell, 500)
        } catch (_: Exception) {
            player = null
        }
    }

    private fun vibrate() {
        vibrator = if (Build.VERSION.SDK_INT >= 31) {
            (getSystemService(VIBRATOR_MANAGER_SERVICE) as VibratorManager).defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            getSystemService(VIBRATOR_SERVICE) as Vibrator
        }
        val pattern = longArrayOf(0, 800, 400, 800, 1400)
        vibrator?.vibrate(
            VibrationEffect.createWaveform(pattern, 0),
            AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE).build()
        )
    }

    private fun stopSound() {
        handler.removeCallbacksAndMessages(null)
        try { player?.stop() } catch (_: Exception) { }
        player?.release()
        player = null
        vibrator?.cancel()
        vibrator = null
        wake?.let { if (it.isHeld) it.release() }
        wake = null
    }

    private fun ongoing(caller: String) {
        stopSound()
        ringing = null
        val type = if (Build.VERSION.SDK_INT >= 30) {
            ServiceInfo.FOREGROUND_SERVICE_TYPE_PHONE_CALL or ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
        } else ServiceInfo.FOREGROUND_SERVICE_TYPE_PHONE_CALL
        foreground(Notify.ongoing(this, caller), type)
    }

    private fun foreground(n: android.app.Notification, type: Int) {
        try {
            ServiceCompat.startForeground(this, Notify.ID_CALL, n, type)
        } catch (_: Exception) {
            // e.g. microphone type refused: keep the call notification at least.
            try { ServiceCompat.startForeground(this, Notify.ID_CALL, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_PHONE_CALL) } catch (_: Exception) { }
        }
    }

    private fun stopEverything() {
        stopSound()
        ringing = null
        current = null
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    // The app was swiped away from recent apps while ringing: stop the ringtone too.
    override fun onTaskRemoved(rootIntent: Intent?) {
        if (ringing != null) stopEverything()
        super.onTaskRemoved(rootIntent)
    }

    override fun onDestroy() {
        stopSound()
        current = null
        super.onDestroy()
    }

    companion object {
        const val ACTION_RING = "ring"
        const val ACTION_ONGOING = "ongoing"
        const val ACTION_STOP = "stop"

        /** Id of the call ringing on this phone right now, if any. */
        @Volatile var current: String? = null

        fun ring(ctx: Context, call: CallInfo) {
            synchronized(this) {
                if (current == call.id) return
                current = call.id
            }
            start(ctx, Intent(ctx, CallService::class.java).setAction(ACTION_RING).putExtras(call.toBundle()))
        }
        fun ongoing(ctx: Context, caller: String) = start(ctx, Intent(ctx, CallService::class.java).setAction(ACTION_ONGOING).putExtra("caller", caller))
        fun stop(ctx: Context) {
            current = null
            try { ctx.startService(Intent(ctx, CallService::class.java).setAction(ACTION_STOP)) } catch (_: Exception) { }
            NotificationManagerCompat.from(ctx).cancel(Notify.ID_CALL)
        }

        private fun start(ctx: Context, i: Intent) {
            try { androidx.core.content.ContextCompat.startForegroundService(ctx, i) } catch (_: Exception) { }
        }
    }
}
