package tech.southstreet.connect

import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

/**
 * High-priority data messages from the server (lib/connect/push.ts).
 * A call starts CallService: full-screen call screen + looping ringtone, even
 * when the app is closed and the phone is locked.
 */
class ConnectMessagingService : FirebaseMessagingService() {

    override fun onMessageReceived(message: RemoteMessage) {
        val data = message.data
        when (data["kind"]) {
            "call" -> {
                // The app is open on screen: the page rings and shows the call itself.
                if (MainActivity.visible) return
                CallInfo.from(data)?.let { CallService.ring(this, it) }
            }
            "call-end" -> {
                val id = data["callId"] ?: return
                if (CallService.current == id) {
                    CallService.stop(this)
                    IncomingCallActivity.close()
                }
                if (data["outcome"] == "missed") {
                    CallInfo.from(data)?.let { Notify.missed(this, it, data["url"] ?: "/connect") }
                }
            }
            "message" -> {
                if (MainActivity.visible) return
                Notify.message(this, data["title"] ?: "South Street Connect", data["body"] ?: "", data["url"] ?: "/connect", data["tag"] ?: "chat")
            }
        }
    }

    override fun onNewToken(token: String) {
        Prefs.saveToken(this, token)
        Prefs.registerToken(this)
    }
}
