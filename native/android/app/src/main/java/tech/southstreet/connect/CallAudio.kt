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
 *
 * After the call the phone must be back to normal sound, or YouTube and other
 * apps keep playing through the small earpiece. The WebView's own call engine
 * closes its audio a moment AFTER the page says the call ended, and puts back
 * the "in a call" mode it saw when the call started — so the reset is repeated
 * for a few seconds ([settle]) while no call is going on.
 */
object CallAudio {
    private val main = Handler(Looper.getMainLooper())
    private var active = false
    private var proximity: PowerManager.WakeLock? = null
    /** When our last call ended (only then do we touch the phone's sound). */
    private var endedAt = 0L

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
        active = true
        if (Telecom.route(speaker)) {
            screenOffAtEar(ctx, !speaker)
            return
        }
        val am = ctx.getSystemService(AudioManager::class.java) ?: return
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

    /** Call over (or ringing for an incoming call): back to normal sound, and again for a few seconds. */
    fun reset(ctx: Context) {
        main.removeCallbacksAndMessages(null)
        val app = ctx.applicationContext
        val wasActive = active
        active = false
        if (wasActive) {
            endedAt = System.currentTimeMillis()
            normal(app)
        }
        screenOffAtEar(app, false)
        settle(app)
    }

    /**
     * No call going on: put normal sound back now and at 1.5 s, 4 s and 8 s, in
     * case the call engine sets the call mode back while it closes. A new call
     * ([route]) cancels the pending checks.
     */
    fun settle(ctx: Context) {
        if (System.currentTimeMillis() - endedAt > 120_000) return // no call of ours lately: not our business
        val app = ctx.applicationContext
        for (delay in longArrayOf(0, 1500, 4000, 8000)) {
            main.postDelayed({ if (!active) normal(app) }, delay)
        }
    }

    private fun normal(ctx: Context) {
        val am = ctx.getSystemService(AudioManager::class.java) ?: return
        // Only the internet-call mode (ours / the WebView's): never a phone call (MODE_IN_CALL) or ringing.
        if (am.mode != AudioManager.MODE_IN_COMMUNICATION && am.mode != AudioManager.MODE_NORMAL) return
        try {
            if (Build.VERSION.SDK_INT >= 31) {
                if (am.communicationDevice != null) am.clearCommunicationDevice()
            } else {
                @Suppress("DEPRECATION")
                if (am.isSpeakerphoneOn) am.isSpeakerphoneOn = false
            }
            if (am.mode != AudioManager.MODE_NORMAL) am.mode = AudioManager.MODE_NORMAL
        } catch (_: Exception) { }
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
