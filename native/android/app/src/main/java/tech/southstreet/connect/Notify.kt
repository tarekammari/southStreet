package tech.southstreet.connect

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.Person
import androidx.core.graphics.drawable.IconCompat

/** Notification channels and the notifications of calls and messages. */
object Notify {
    const val CH_CALLS = "calls_v2"
    const val CH_ONGOING = "ongoing"
    const val CH_MESSAGES = "messages"
    const val CH_MISSED = "missed"
    const val ID_CALL = 7001

    fun channels(ctx: Context) {
        val nm = ctx.getSystemService(NotificationManager::class.java)
        // The ringtone and vibration are played by CallService itself (looping,
        // following ring / vibrate / silent mode), so the channel is silent.
        nm.createNotificationChannel(NotificationChannel(CH_CALLS, "المكالمات الواردة", NotificationManager.IMPORTANCE_HIGH).apply {
            setSound(null, null)
            enableVibration(false)
            lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
        })
        nm.createNotificationChannel(NotificationChannel(CH_ONGOING, "المكالمة الجارية", NotificationManager.IMPORTANCE_LOW))
        nm.createNotificationChannel(NotificationChannel(CH_MESSAGES, "الرسائل", NotificationManager.IMPORTANCE_HIGH))
        nm.createNotificationChannel(NotificationChannel(CH_MISSED, "المكالمات الفائتة", NotificationManager.IMPORTANCE_DEFAULT))
    }

    private fun flags() = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE

    fun openApp(ctx: Context, url: String, req: Int, answer: Boolean = false): PendingIntent {
        val i = Intent(ctx, MainActivity::class.java)
            .putExtra(MainActivity.EXTRA_URL, url)
            .putExtra(MainActivity.EXTRA_ANSWER, answer)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        return PendingIntent.getActivity(ctx, req, i, flags())
    }

    /** Phone-style incoming call notification (CallStyle) with a full-screen screen. */
    fun incoming(ctx: Context, call: CallInfo, photo: Bitmap?): android.app.Notification {
        val person = Person.Builder()
            .setName(call.caller)
            .setImportant(true)
            .apply { if (photo != null) setIcon(IconCompat.createWithBitmap(photo)) }
            .build()
        val fullScreen = PendingIntent.getActivity(
            ctx, 11,
            Intent(ctx, IncomingCallActivity::class.java).putExtras(call.toBundle())
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_NO_USER_ACTION),
            flags()
        )
        val answer = openApp(ctx, "/connect?call=${call.id}&answer=1", 12, answer = true)
        val decline = PendingIntent.getBroadcast(
            ctx, 13,
            Intent(ctx, ActionReceiver::class.java).setAction(ActionReceiver.DECLINE).putExtra("id", call.id),
            flags()
        )
        return NotificationCompat.Builder(ctx, CH_CALLS)
            .setSmallIcon(R.drawable.ic_stat_call)
            .setContentTitle(call.caller)
            .setContentText(if (call.role.isNotBlank()) "${call.role} · مكالمة صوتية واردة" else "مكالمة صوتية واردة")
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setAutoCancel(false)
            .setTimeoutAfter(50_000)
            .setFullScreenIntent(fullScreen, true)
            .setContentIntent(fullScreen)
            .setColor(0xFF047857.toInt())
            .setStyle(NotificationCompat.CallStyle.forIncomingCall(person, decline, answer))
            .addPerson(person)
            .build()
    }

    fun ongoing(ctx: Context, caller: String): android.app.Notification {
        val hangup = PendingIntent.getBroadcast(
            ctx, 21, Intent(ctx, ActionReceiver::class.java).setAction(ActionReceiver.HANGUP), flags()
        )
        val person = Person.Builder().setName(caller.ifBlank { "مكالمة" }).build()
        return NotificationCompat.Builder(ctx, CH_ONGOING)
            .setSmallIcon(R.drawable.ic_stat_call)
            .setContentTitle(caller.ifBlank { "مكالمة جارية" })
            .setContentText("مكالمة جارية — اضغط للعودة")
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setOngoing(true)
            .setUsesChronometer(true)
            .setColor(0xFF047857.toInt())
            .setContentIntent(openApp(ctx, "", 22))
            .setStyle(NotificationCompat.CallStyle.forOngoingCall(person, hangup))
            .build()
    }

    fun missed(ctx: Context, call: CallInfo, chatUrl: String) {
        if (!NotificationManagerCompat.from(ctx).areNotificationsEnabled()) return
        val n = NotificationCompat.Builder(ctx, CH_MISSED)
            .setSmallIcon(R.drawable.ic_stat_call)
            .setContentTitle("مكالمة فائتة")
            .setContentText("من ${call.caller} — اضغط لمعاودة الاتصال")
            .setCategory(NotificationCompat.CATEGORY_MISSED_CALL)
            .setColor(0xFFDC2626.toInt())
            .setAutoCancel(true)
            .setContentIntent(openApp(ctx, chatUrl, 31))
            .build()
        try {
            NotificationManagerCompat.from(ctx).notify("missed-${call.id}", 1, n)
        } catch (_: SecurityException) { }
    }

    /** Messages already shown: Firebase and the background listener may both bring the same one. */
    private val shown = LinkedHashSet<String>()

    fun message(ctx: Context, title: String, body: String, url: String, tag: String, msgId: String = "") {
        if (!NotificationManagerCompat.from(ctx).areNotificationsEnabled()) return
        if (msgId.isNotBlank()) {
            synchronized(shown) {
                if (!shown.add(msgId)) return
                while (shown.size > 60) shown.remove(shown.first())
            }
        }
        val n = NotificationCompat.Builder(ctx, CH_MESSAGES)
            .setSmallIcon(R.drawable.ic_stat_call)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setColor(0xFF047857.toInt())
            .setAutoCancel(true)
            .setContentIntent(openApp(ctx, url, tag.hashCode()))
            .build()
        try {
            NotificationManagerCompat.from(ctx).notify(tag, 2, n)
        } catch (_: SecurityException) { }
    }
}
