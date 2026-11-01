package tech.southstreet.connect

import android.animation.AnimatorSet
import android.animation.ObjectAnimator
import android.animation.ValueAnimator
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Outline
import android.os.Bundle
import android.view.View
import android.view.ViewOutlineProvider
import android.view.WindowManager
import android.widget.ImageView
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import java.lang.ref.WeakReference
import kotlin.concurrent.thread

/**
 * The phone-style incoming call screen: wakes the phone, shows over the lock
 * screen, with the caller's photo, name and big Answer / Decline buttons.
 * The ringtone is played by [CallService].
 */
class IncomingCallActivity : AppCompatActivity() {
    private var call: CallInfo? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setShowWhenLocked(true)
        setTurnScreenOn(true)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        setContentView(R.layout.activity_incoming)
        instance = WeakReference(this)
        bind(intent)

        findViewById<View>(R.id.answer).setOnClickListener { answer() }
        findViewById<View>(R.id.decline).setOnClickListener { decline() }
        pulse(findViewById(R.id.ring1), 0)
        pulse(findViewById(R.id.ring2), 1000)
        nudge(findViewById(R.id.answer))
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        bind(intent)
    }

    private fun bind(intent: Intent?) {
        val c = CallInfo.from(intent?.extras) ?: return finish()
        call = c
        findViewById<TextView>(R.id.name).text = c.caller
        findViewById<TextView>(R.id.role).apply {
            text = c.role
            visibility = if (c.role.isBlank()) View.GONE else View.VISIBLE
        }
        findViewById<TextView>(R.id.initial).text = c.caller.trim().take(1)
        thread {
            val bmp = Net.bitmap(c.photo) ?: return@thread
            runOnUiThread { showPhoto(bmp) }
        }
    }

    private fun showPhoto(bmp: Bitmap) {
        findViewById<ImageView>(R.id.photo).apply {
            setImageBitmap(bmp)
            visibility = View.VISIBLE
            clipToOutline = true
            outlineProvider = object : ViewOutlineProvider() {
                override fun getOutline(view: View, outline: Outline) = outline.setOval(0, 0, view.width, view.height)
            }
        }
        findViewById<ImageView>(R.id.backdrop).apply {
            setImageBitmap(bmp)
            if (android.os.Build.VERSION.SDK_INT >= 31) {
                setRenderEffect(android.graphics.RenderEffect.createBlurEffect(60f, 60f, android.graphics.Shader.TileMode.CLAMP))
            }
        }
    }

    private fun answer() {
        val c = call ?: return finish()
        CallService.stop(this)
        Telecom.active()
        startActivity(
            Intent(this, MainActivity::class.java)
                .putExtra(MainActivity.EXTRA_URL, "/connect?call=${c.id}&answer=1")
                .putExtra(MainActivity.EXTRA_ANSWER, true)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        )
        finish()
    }

    private fun decline() {
        val c = call
        CallService.stop(this)
        Telecom.end(android.telecom.DisconnectCause.REJECTED)
        if (c != null) Net.postJson("/api/connect/call", "{\"action\":\"decline\",\"id\":${Net.quote(c.id)}}")
        finish()
    }

    private fun pulse(v: View, delay: Long) {
        val sx = ObjectAnimator.ofFloat(v, View.SCALE_X, 1f, 1.75f)
        val sy = ObjectAnimator.ofFloat(v, View.SCALE_Y, 1f, 1.75f)
        val a = ObjectAnimator.ofFloat(v, View.ALPHA, 0.9f, 0f)
        listOf(sx, sy, a).forEach { it.repeatCount = ValueAnimator.INFINITE; it.duration = 2000 }
        AnimatorSet().apply { playTogether(sx, sy, a); startDelay = delay; start() }
    }

    private fun nudge(v: View) {
        ObjectAnimator.ofFloat(v, View.TRANSLATION_Y, 0f, -18f, 0f, -8f, 0f).apply {
            duration = 1400
            repeatCount = ValueAnimator.INFINITE
            start()
        }
    }

    override fun onDestroy() {
        if (instance?.get() === this) instance = null
        super.onDestroy()
    }

    companion object {
        private var instance: WeakReference<IncomingCallActivity>? = null

        /** Answered on a headset / car (Telecom): answer from this screen. False when it is not open. */
        fun answerFromSystem(): Boolean {
            val a = instance?.get() ?: return false
            a.runOnUiThread { a.answer() }
            return true
        }

        /** Closes the screen when the call is cancelled / answered elsewhere. */
        fun close() {
            instance?.get()?.let { a -> a.runOnUiThread { a.finish() } }
        }
    }
}
