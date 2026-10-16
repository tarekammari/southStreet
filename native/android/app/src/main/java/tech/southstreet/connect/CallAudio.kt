package tech.southstreet.connect

import android.content.Context
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.PowerManager

/**
 * Where a call is heard, like the phone's own call app: the earpiece at the
 * top of the phone by default (or a Bluetooth / wired headset when one is
 * connected), the loudspeaker only when the user taps «مكبّر الصوت». On the
 * earpiece the screen turns off when the phone is at the ear.
 */
object CallAudio {
    private val main = Handler(Looper.getMainLooper())
    private var active = false
    private var proximity: PowerManager.WakeLock? = null

    private val HEADSETS = setOf(
        AudioDeviceInfo.TYPE_BLUETOOTH_SCO,
        AudioDeviceInfo.TYPE_WIRED_HEADSET,
        AudioDeviceInfo.TYPE_WIRED_HEADPHONES,
        AudioDeviceInfo.TYPE_USB_HEADSET,
        AudioDeviceInfo.TYPE_BLE_HEADSET,
    )

    /** In a call (dialling, ringing back, connecting, talking): earpiece unless [speaker]. */
    fun route(ctx: Context, speaker: Boolean) {
        val app = ctx.applicationContext
        apply(app, speaker)
        // The WebView sets up its own audio when the voice starts flowing: apply again after it.
        main.removeCallbacksAndMessages(null)
        main.postDelayed({ if (active) apply(app, speaker) }, 800)
        main.postDelayed({ if (active) apply(app, speaker) }, 2500)
    }

    private fun apply(ctx: Context, speaker: Boolean) {
        val am = ctx.getSystemService(AudioManager::class.java) ?: return
        active = true
        try {
            am.mode = AudioManager.MODE_IN_COMMUNICATION
            if (Build.VERSION.SDK_INT >= 31) {
                val devices = am.availableCommunicationDevices
                val target = if (speaker) {
                    devices.firstOrNull { it.type == AudioDeviceInfo.TYPE_BUILTIN_SPEAKER }
                } else {
                    devices.firstOrNull { it.type in HEADSETS } ?: devices.firstOrNull { it.type == AudioDeviceInfo.TYPE_BUILTIN_EARPIECE }
                }
                if (target != null && am.communicationDevice?.id != target.id) am.setCommunicationDevice(target)
            } else {
                @Suppress("DEPRECATION")
                am.isSpeakerphoneOn = speaker
            }
        } catch (_: Exception) { }
        screenOffAtEar(ctx, !speaker)
    }

    /** Call over (or ringing for an incoming call): back to normal sound. */
    fun reset(ctx: Context) {
        main.removeCallbacksAndMessages(null)
        if (!active) return
        active = false
        val am = ctx.applicationContext.getSystemService(AudioManager::class.java) ?: return
        try {
            if (Build.VERSION.SDK_INT >= 31) {
                am.clearCommunicationDevice()
            } else {
                @Suppress("DEPRECATION")
                am.isSpeakerphoneOn = false
            }
            am.mode = AudioManager.MODE_NORMAL
        } catch (_: Exception) { }
        screenOffAtEar(ctx, false)
    }

    private fun screenOffAtEar(ctx: Context, on: Boolean) {
        val pm = ctx.applicationContext.getSystemService(PowerManager::class.java) ?: return
        if (on) {
            if (proximity?.isHeld == true || !pm.isWakeLockLevelSupported(PowerManager.PROXIMITY_SCREEN_OFF_WAKE_LOCK)) return
            proximity = pm.newWakeLock(PowerManager.PROXIMITY_SCREEN_OFF_WAKE_LOCK, "ssconnect:ear").apply {
                setReferenceCounted(false)
                acquire(4 * 60 * 60 * 1000L)
            }
        } else {
            try { proximity?.takeIf { it.isHeld }?.release() } catch (_: Exception) { }
            proximity = null
        }
    }
}
