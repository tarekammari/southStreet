package tech.southstreet.connect

import android.app.Activity
import android.app.AlertDialog
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import kotlin.concurrent.thread

/**
 * Updates the app itself. Each time the app opens (and every few hours while it
 * runs) it asks the server for the newest version; if it is newer, the APK is
 * downloaded in the background and checked (same app, really newer), then one
 * dialog asks "تحديث الآن". Android always shows its own install confirmation
 * for apps from outside the Play Store — that tap cannot be skipped.
 * Never during a call.
 */
object Updater {
    private const val CHECK_EVERY_MS = 6 * 60 * 60 * 1000L
    private const val FILE = "update.apk"

    @Volatile private var checking = false
    @Volatile private var lastCheck = 0L
    /** Downloaded, verified and waiting for the user's tap. */
    @Volatile private var ready: File? = null
    private var readyName = ""
    /** The user tapped "update" but first had to allow installs from this app. */
    private var waitingForPermission = false
    private var dialog: AlertDialog? = null

    /**
     * Called when the app opens and comes back to the front ([force] = false), or
     * from "التحقق من التحديثات" ([force] = true). [result]: latest | ready | busy | error.
     */
    fun check(activity: Activity, force: Boolean = false, result: ((state: String, version: String) -> Unit)? = null) {
        if (waitingForPermission && canInstall(activity)) {
            waitingForPermission = false
            ready?.let { return install(activity, it) }
        }
        ready?.let {
            if (force) dialog?.dismiss()
            offer(activity)
            return result?.invoke("ready", readyName) ?: Unit
        }
        val now = System.currentTimeMillis()
        if (checking) return result?.invoke("busy", "") ?: Unit
        if (!force && now - lastCheck < CHECK_EVERY_MS) return
        checking = true
        lastCheck = now
        val app = activity.applicationContext
        val report = { state: String, version: String -> activity.runOnUiThread { result?.invoke(state, version) } }
        thread {
            try {
                val latest = JSONObject(get("${Net.origin}/api/connect/app-version")).getJSONObject("android")
                val code = latest.optLong("versionCode")
                val name = latest.optString("versionName")
                if (code > BuildConfig.VERSION_CODE) {
                    val url = Net.absolute(latest.optString("url"))
                    val file = url?.let { download(app, it) }
                    if (file != null && isNewer(app, file)) {
                        ready = file
                        readyName = name
                        activity.runOnUiThread { offer(activity) }
                        report("ready", name)
                    } else {
                        report("error", name)
                    }
                } else {
                    File(app.cacheDir, FILE).delete() // installed already: clean up
                    report("latest", BuildConfig.VERSION_NAME)
                }
            } catch (_: Exception) {
                lastCheck = 0L // offline: try again next time
                report("error", "")
            } finally {
                checking = false
            }
        }
    }

    private fun offer(activity: Activity) {
        val file = ready ?: return
        if (activity.isFinishing || dialog?.isShowing == true || MainActivity.inCall) return
        dialog = AlertDialog.Builder(activity)
            .setTitle("تحديث جديد جاهز")
            .setMessage("الإصدار $readyName من South Street Connect تم تنزيله. اضغط «تحديث الآن» ثم «تثبيت» — يبقى حسابك ومحادثاتك كما هي.")
            .setPositiveButton("تحديث الآن") { _, _ -> install(activity, file) }
            .setNegativeButton("لاحقاً", null)
            .show()
    }

    private fun canInstall(ctx: Context) = Build.VERSION.SDK_INT < 26 || ctx.packageManager.canRequestPackageInstalls()

    private fun install(activity: Activity, file: File) {
        if (!canInstall(activity)) {
            // Once: Android asks to allow installs from this app; we continue when the user is back.
            waitingForPermission = true
            try {
                activity.startActivity(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${activity.packageName}")))
            } catch (_: Exception) { waitingForPermission = false }
            return
        }
        val uri = FileProvider.getUriForFile(activity, "${activity.packageName}.files", file)
        val i = Intent(Intent.ACTION_VIEW)
            .setDataAndType(uri, "application/vnd.android.package-archive")
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
        try { activity.startActivity(i) } catch (_: Exception) { }
    }

    /** Only an APK of this same app with a higher version is ever offered. */
    @Suppress("DEPRECATION")
    private fun isNewer(ctx: Context, file: File): Boolean {
        val info = ctx.packageManager.getPackageArchiveInfo(file.path, 0) ?: return false
        val code = if (Build.VERSION.SDK_INT >= 28) info.longVersionCode else info.versionCode.toLong()
        return info.packageName == ctx.packageName && code > BuildConfig.VERSION_CODE
    }

    private fun get(url: String): String {
        val conn = URL(url).openConnection() as HttpURLConnection
        conn.connectTimeout = 8000
        conn.readTimeout = 8000
        conn.setRequestProperty("User-Agent", Net.userAgent)
        return try { conn.inputStream.bufferedReader().readText() } finally { conn.disconnect() }
    }

    private fun download(ctx: Context, url: String): File? {
        val part = File(ctx.cacheDir, "$FILE.part")
        val conn = URL(url).openConnection() as HttpURLConnection
        conn.connectTimeout = 10_000
        conn.readTimeout = 30_000
        conn.setRequestProperty("User-Agent", Net.userAgent)
        // The app is only for account holders: download as the signed-in user.
        android.webkit.CookieManager.getInstance().getCookie(Net.origin)?.let { conn.setRequestProperty("Cookie", it) }
        return try {
            if (conn.responseCode !in 200..299) return null
            conn.inputStream.use { input -> part.outputStream().use { input.copyTo(it) } }
            File(ctx.cacheDir, FILE).also { it.delete(); part.renameTo(it) }
        } catch (_: Exception) {
            part.delete()
            null
        } finally {
            conn.disconnect()
        }
    }
}
