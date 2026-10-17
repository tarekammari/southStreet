package tech.southstreet.connect

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.drawable.Icon
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.OutcomeReceiver
import android.telecom.CallAudioState
import android.telecom.CallEndpoint
import android.telecom.CallEndpointException
import android.telecom.Connection
import android.telecom.ConnectionRequest
import android.telecom.ConnectionService
import android.telecom.DisconnectCause
import android.telecom.PhoneAccount
import android.telecom.PhoneAccountHandle
import android.telecom.TelecomManager

/**
 * Connect calls inside Android's own calling system (a "self-managed"
 * ConnectionService), like WhatsApp or Signal: a Bluetooth headset or the car
 * can answer and hang up, the phone knows a call is going on (a GSM call
 * coming in, Do Not Disturb, the lock screen), and the call audio follows the
 * system's routes (earpiece, speaker, Bluetooth).
 *
 * The ringing screen, ringtone and the call itself stay ours (CallService,
 * IncomingCallActivity, the web page). Wherever Telecom is missing or says no,
 * everything works exactly as before: [incoming] returns false, and a refused
 * or silent Telecom falls back to ringing the old way.
 */
object Telecom {
    private const val ACCOUNT_ID = "ssconnect"
    private val main = Handler(Looper.getMainLooper())

    /** The one call Telecom knows about (Connect has one call at a time). */
    @Volatile var connection: CallConnection? = null
        private set

    @Volatile private var registered: Boolean? = null

    private fun handle(ctx: Context) = PhoneAccountHandle(ComponentName(ctx, ConnectConnectionService::class.java), ACCOUNT_ID)

    private fun manager(ctx: Context): TelecomManager? = ctx.getSystemService(TelecomManager::class.java)

    /** Registers the app's calling account once. False where self-managed calls are not available. */
    fun ready(ctx: Context): Boolean {
        registered?.let { return it }
        val ok = try {
            val app = ctx.applicationContext
            val tm = manager(app)
            tm?.registerPhoneAccount(
                PhoneAccount.builder(handle(app), "South Street Connect")
                    .setCapabilities(PhoneAccount.CAPABILITY_SELF_MANAGED)
                    .setSupportedUriSchemes(listOf(PhoneAccount.SCHEME_SIP))
                    .setIcon(Icon.createWithResource(app, R.drawable.ic_stat_call))
                    .build()
            )
            tm != null
        } catch (_: Exception) {
            false
        }
        registered = ok
        return ok
    }

    /**
     * Announces an incoming call to Telecom; it then asks us to show our ringing
     * screen ([CallConnection.onShowIncomingCallUi]). False = ring the old way now.
     */
    fun incoming(ctx: Context, call: CallInfo): Boolean {
        val app = ctx.applicationContext
        if (!ready(app)) return false
        return try {
            val tm = manager(app) ?: return false
            if (!tm.isIncomingCallPermitted(handle(app))) return false
            tm.addNewIncomingCall(handle(app), Bundle().apply { putBundle(TelecomManager.EXTRA_INCOMING_CALL_EXTRAS, call.toBundle()) })
            // Some phones accept the call but never come back: ring anyway after 3 s.
            main.postDelayed({ if (connection?.call?.id != call.id) CallService.ringNow(app, call) }, 3000)
            true
        } catch (_: Exception) {
            false
        }
    }

    /**
     * A call that did not ring through Telecom (dialled from here, or answered while
     * the app was on screen): register it so Bluetooth, the car and the system know.
     */
    fun track(ctx: Context, call: CallInfo) {
        pageCall = true
        if (connection != null || placing) return
        val app = ctx.applicationContext
        if (!ready(app)) return
        placing = true // placeCall answers later: register once
        try {
            val extras = Bundle().apply {
                putParcelable(TelecomManager.EXTRA_PHONE_ACCOUNT_HANDLE, handle(app))
                putBundle(TelecomManager.EXTRA_OUTGOING_CALL_EXTRAS, call.toBundle())
            }
            manager(app)?.placeCall(Uri.fromParts(PhoneAccount.SCHEME_SIP, call.id, null), extras)
        } catch (_: Exception) {
            placing = false // no system integration for this call; it still works
        }
    }

    /** Telecom would not register the call (e.g. during an emergency call): it simply goes on without. */
    internal fun placeFailed() {
        placing = false
    }

    /** The page had a call and it is over. (Its first "no call" report on opening is ignored.) */
    fun pageEnded() {
        if (!pageCall) return
        end()
    }

    /** The page reports the call connected (also remembered for a call Telecom registers late). */
    @Volatile private var pageActive = false
    @Volatile private var pageCall = false
    @Volatile private var placing = false

    fun active() {
        pageActive = true
        connection?.let { c -> main.post { if (c.state != Connection.STATE_ACTIVE) c.setActive() } }
    }

    /** How the call ended, from the server's call state. */
    fun causeOf(state: String): Int = when (state) {
        "missed" -> DisconnectCause.MISSED
        "declined" -> DisconnectCause.REJECTED
        "active" -> if (Build.VERSION.SDK_INT >= 29) DisconnectCause.ANSWERED_ELSEWHERE else DisconnectCause.OTHER
        else -> DisconnectCause.REMOTE
    }

    /** The call is over (hung up, declined, missed, answered elsewhere). */
    fun end(cause: Int = DisconnectCause.LOCAL) {
        pageActive = false
        pageCall = false
        placing = false
        val c = connection ?: return
        connection = null
        main.post {
            c.setDisconnected(DisconnectCause(cause))
            c.destroy()
        }
    }

    /** «مكبّر الصوت»: true when Telecom owns the call audio and moved it. */
    fun route(speaker: Boolean): Boolean {
        val c = connection ?: return false
        main.post { c.route(speaker) }
        return true
    }

    internal fun attach(c: CallConnection, outgoing: Boolean) {
        connection?.takeIf { it !== c }?.let { old ->
            old.setDisconnected(DisconnectCause(DisconnectCause.CANCELED))
            old.destroy()
        }
        connection = c
        if (outgoing) placing = false
        if (outgoing && pageActive) c.setActive()
    }

    internal fun detach(c: CallConnection) {
        if (connection === c) connection = null
    }
}

/** One Connect call as Telecom sees it. Buttons on headsets / cars / watches arrive here. */
class CallConnection(private val ctx: Context, val call: CallInfo) : Connection() {
    private var endpoints: List<CallEndpoint> = emptyList()

    init {
        connectionProperties = PROPERTY_SELF_MANAGED
        audioModeIsVoip = true
        connectionCapabilities = CAPABILITY_MUTE
        setAddress(Uri.fromParts(PhoneAccount.SCHEME_SIP, call.id, null), TelecomManager.PRESENTATION_ALLOWED)
        setCallerDisplayName(call.caller, TelecomManager.PRESENTATION_ALLOWED)
    }

    /** Telecom agrees the phone may ring: our own call screen and ringtone. */
    override fun onShowIncomingCallUi() {
        CallService.ringNow(ctx, call)
    }

    /** Answer from the call screen's twin in the system, a Bluetooth headset, the car… */
    override fun onAnswer() {
        setActive()
        // The call screen is up: it opens the app (Android lets a visible screen do that).
        if (IncomingCallActivity.answerFromSystem()) return
        CallService.stop(ctx)
        // The same way as the call screen's own «رد»: the app opens on this call and answers it.
        ctx.startActivity(
            Intent(ctx, MainActivity::class.java)
                .putExtra(MainActivity.EXTRA_URL, "/connect?call=${call.id}&answer=1")
                .putExtra(MainActivity.EXTRA_ANSWER, true)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        )
    }

    override fun onAnswer(videoState: Int) = onAnswer()

    override fun onReject() {
        decline()
        finish(DisconnectCause.REJECTED)
    }

    /** Hang up from outside the app (headset, car, or the phone answering a GSM call instead). */
    override fun onDisconnect() {
        if (state == STATE_RINGING) decline()
        else if (!MainActivity.sendCallAction("hangup")) CallService.stop(ctx)
        finish(DisconnectCause.LOCAL)
    }

    override fun onAbort() = onDisconnect()

    private fun decline() {
        CallService.stop(ctx)
        IncomingCallActivity.close()
        Net.postJson("/api/connect/call", "{\"action\":\"decline\",\"id\":${Net.quote(call.id)}}")
    }

    private fun finish(cause: Int) {
        Telecom.detach(this)
        setDisconnected(DisconnectCause(cause))
        destroy()
    }

    override fun onAvailableCallEndpointsChanged(available: MutableList<CallEndpoint>) {
        endpoints = available.toList()
    }

    /** Earpiece (or the headset in use) vs loudspeaker, through Telecom. */
    fun route(speaker: Boolean) {
        if (Build.VERSION.SDK_INT >= 34) {
            val wanted = if (speaker) {
                endpoints.firstOrNull { it.endpointType == CallEndpoint.TYPE_SPEAKER }
            } else {
                endpoints.firstOrNull { it.endpointType == CallEndpoint.TYPE_BLUETOOTH || it.endpointType == CallEndpoint.TYPE_WIRED_HEADSET }
                    ?: endpoints.firstOrNull { it.endpointType == CallEndpoint.TYPE_EARPIECE }
            } ?: return
            requestCallEndpointChange(wanted, ctx.mainExecutor, object : OutcomeReceiver<Void, CallEndpointException> {
                override fun onResult(result: Void?) {}
                override fun onError(error: CallEndpointException) {}
            })
        } else {
            @Suppress("DEPRECATION")
            val routes = callAudioState?.supportedRouteMask ?: 0
            @Suppress("DEPRECATION")
            setAudioRoute(
                when {
                    speaker -> CallAudioState.ROUTE_SPEAKER
                    routes and CallAudioState.ROUTE_BLUETOOTH != 0 -> CallAudioState.ROUTE_BLUETOOTH
                    else -> CallAudioState.ROUTE_WIRED_OR_EARPIECE
                }
            )
        }
    }
}

/** Telecom's door into the app (declared in the manifest, bound only by the system). */
class ConnectConnectionService : ConnectionService() {

    /** Our call details: Telecom hands the extras over directly or still wrapped, depending on the version. */
    private fun callOf(request: ConnectionRequest?, key: String): CallInfo? =
        CallInfo.from(request?.extras?.getBundle(key)) ?: CallInfo.from(request?.extras)

    override fun onCreateIncomingConnection(account: PhoneAccountHandle?, request: ConnectionRequest?): Connection? {
        val call = callOf(request, TelecomManager.EXTRA_INCOMING_CALL_EXTRAS)
            ?: return Connection.createFailedConnection(DisconnectCause(DisconnectCause.ERROR))
        return CallConnection(applicationContext, call).apply {
            setRinging()
            Telecom.attach(this, outgoing = false)
        }
    }

    /** Telecom said no (e.g. an emergency call): ring the old way. */
    override fun onCreateIncomingConnectionFailed(account: PhoneAccountHandle?, request: ConnectionRequest?) {
        callOf(request, TelecomManager.EXTRA_INCOMING_CALL_EXTRAS)?.let { CallService.ringNow(applicationContext, it) }
    }

    override fun onCreateOutgoingConnection(account: PhoneAccountHandle?, request: ConnectionRequest?): Connection? {
        val call = callOf(request, TelecomManager.EXTRA_OUTGOING_CALL_EXTRAS)
            ?: return Connection.createFailedConnection(DisconnectCause(DisconnectCause.ERROR))
        return CallConnection(applicationContext, call).apply {
            setDialing()
            Telecom.attach(this, outgoing = true)
        }
    }

    override fun onCreateOutgoingConnectionFailed(account: PhoneAccountHandle?, request: ConnectionRequest?) {
        Telecom.placeFailed()
    }
}
