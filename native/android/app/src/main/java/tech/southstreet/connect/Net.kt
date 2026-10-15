package tech.southstreet.connect

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.webkit.CookieManager
import java.net.HttpURLConnection
import java.net.URL
import kotlin.concurrent.thread

/** Small network helpers that reuse the WebView's sign-in cookie. */
object Net {
    val origin: String = BuildConfig.ORIGIN

    fun absolute(path: String?): String? {
        if (path.isNullOrBlank()) return null
        return if (path.startsWith("http")) path else origin + (if (path.startsWith("/")) path else "/$path")
    }

    /** POST JSON to the site as the signed-in user (in the background). */
    fun postJson(path: String, json: String, done: ((Boolean) -> Unit)? = null) {
        thread {
            val ok = try {
                val conn = URL(origin + path).openConnection() as HttpURLConnection
                conn.requestMethod = "POST"
                conn.connectTimeout = 8000
                conn.readTimeout = 8000
                conn.doOutput = true
                conn.setRequestProperty("Content-Type", "application/json")
                conn.setRequestProperty("Origin", origin) // the site's CSRF check
                CookieManager.getInstance().getCookie(origin)?.let { conn.setRequestProperty("Cookie", it) }
                conn.outputStream.use { it.write(json.toByteArray()) }
                val code = conn.responseCode
                conn.disconnect()
                code in 200..299
            } catch (_: Exception) {
                false
            }
            done?.invoke(ok)
        }
    }

    /** Caller photo, or null after a short timeout. Call from a background thread. */
    fun bitmap(path: String?): Bitmap? {
        val url = absolute(path) ?: return null
        return try {
            val conn = URL(url).openConnection() as HttpURLConnection
            conn.connectTimeout = 3000
            conn.readTimeout = 3000
            CookieManager.getInstance().getCookie(origin)?.let { conn.setRequestProperty("Cookie", it) }
            conn.inputStream.use { BitmapFactory.decodeStream(it) }
        } catch (_: Exception) {
            null
        }
    }

    fun quote(s: String) = "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\""
}
