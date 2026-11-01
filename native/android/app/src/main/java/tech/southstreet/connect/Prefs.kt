package tech.southstreet.connect

import android.content.Context
import com.google.firebase.messaging.FirebaseMessaging

/** The device's push token, its registration with the signed-in account, and the ringtone. */
object Prefs {
    private const val FILE = "connect"

    fun token(ctx: Context): String = ctx.getSharedPreferences(FILE, Context.MODE_PRIVATE).getString("fcm", "") ?: ""

    fun saveToken(ctx: Context, token: String) {
        ctx.getSharedPreferences(FILE, Context.MODE_PRIVATE).edit().putString("fcm", token).apply()
    }

    /** The ringtone picked in the app (lib/connect/ringtones.ts), saved by the page through the bridge. */
    fun ringtone(ctx: Context): String = ctx.getSharedPreferences(FILE, Context.MODE_PRIVATE).getString("ringtone", "") ?: ""

    fun saveRingtone(ctx: Context, id: String) {
        if (!Regex("^[a-z-]{2,30}$").matches(id)) return
        ctx.getSharedPreferences(FILE, Context.MODE_PRIVATE).edit().putString("ringtone", id).apply()
    }

    /** Sound file of the ringtone; an unknown one rings with the original. */
    fun ringtoneRes(ctx: Context): Int = when (ringtone(ctx)) {
        "orbit" -> R.raw.ringtone_orbit
        "stardust" -> R.raw.ringtone_stardust
        "nebula" -> R.raw.ringtone_nebula
        "forest" -> R.raw.ringtone_forest
        "chimes" -> R.raw.ringtone_chimes
        "waves" -> R.raw.ringtone_waves
        else -> R.raw.ringtone
    }

    /** Fetches the token (when Firebase is set up) and hands it to [done]. */
    fun fetchToken(ctx: Context, done: (String) -> Unit) {
        if (!BuildConfig.HAS_FIREBASE) return
        try {
            FirebaseMessaging.getInstance().token.addOnSuccessListener { t ->
                if (!t.isNullOrBlank()) {
                    saveToken(ctx, t)
                    done(t)
                }
            }
        } catch (_: Exception) { }
    }

    /** Ties this phone to the account signed in inside the app. */
    fun registerToken(ctx: Context) {
        val t = token(ctx)
        if (t.isBlank()) return
        Net.postJson("/api/connect/push", "{\"subscription\":{\"fcm\":${Net.quote(t)},\"platform\":\"android\"}}")
    }
}
