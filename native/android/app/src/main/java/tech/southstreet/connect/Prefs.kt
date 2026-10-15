package tech.southstreet.connect

import android.content.Context
import com.google.firebase.messaging.FirebaseMessaging

/** The device's push token and its registration with the signed-in account. */
object Prefs {
    private const val FILE = "connect"

    fun token(ctx: Context): String = ctx.getSharedPreferences(FILE, Context.MODE_PRIVATE).getString("fcm", "") ?: ""

    fun saveToken(ctx: Context, token: String) {
        ctx.getSharedPreferences(FILE, Context.MODE_PRIVATE).edit().putString("fcm", token).apply()
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
