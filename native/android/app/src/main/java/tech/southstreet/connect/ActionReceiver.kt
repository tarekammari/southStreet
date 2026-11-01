package tech.southstreet.connect

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Buttons of the call notifications: decline (ringing) and hang up (in call). */
class ActionReceiver : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
        when (intent.action) {
            DECLINE -> {
                val id = intent.getStringExtra("id") ?: return
                CallService.stop(ctx)
                IncomingCallActivity.close()
                Telecom.end(android.telecom.DisconnectCause.REJECTED)
                val pending = goAsync()
                Net.postJson("/api/connect/call", "{\"action\":\"decline\",\"id\":${Net.quote(id)}}") { pending.finish() }
            }
            HANGUP -> {
                // The call lives in the web page: ask it to hang up (it stops the service).
                if (!MainActivity.sendCallAction("hangup")) CallService.stop(ctx)
            }
        }
    }

    companion object {
        const val DECLINE = "tech.southstreet.connect.DECLINE"
        const val HANGUP = "tech.southstreet.connect.HANGUP"
    }
}
