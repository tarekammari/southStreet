'use client';

/**
 * Voice calls for South Street Connect (WebRTC, audio only).
 *
 * Clear "telephone" voice:
 *  - microphone with echo cancellation, noise suppression and auto gain, mono;
 *  - Opus tuned for speech: mono, ~32 kb/s, in-band FEC (rebuilds short losses
 *    on weak 4G), no DTX (no choppy silences), 20 ms frames.
 * The audio flows directly between the two devices (or via the TURN relay);
 * /api/connect/call only carries the setup.
 *
 * Phone-grade behaviour on top:
 *  - end-to-end check: each side signs its encryption fingerprint and checks the
 *    other's, both screens show the same security code (lib/connect/e2e.ts);
 *  - «يرنّ…» only once the other device confirms it rings; no confirmation and no
 *    answer = "unreachable", not "missed";
 *  - a network change (Wi-Fi ↔ 4G) or a short drop restarts the network paths
 *    of the same call (ICE restart) instead of ending it;
 *  - call quality (loss, delay, jitter) for the signal bars.
 */
import { jsonAuthHeaders, authHeaders } from '@/lib/api-client';
import { renderRingtone, ringtoneSeconds, type RingtoneId } from './ringtones';
import { getRingtone, relayOnly } from './device-prefs';
import { fingerprintOf, rememberPeerKey, safetyCode, signSetup, verifySetup, type PeerKey, type SetupCheck } from './e2e';

export type CallPhase = 'idle' | 'calling' | 'ringing' | 'connecting' | 'active' | 'reconnecting' | 'ended';
/** `unreachable`: no device of the other person confirmed ringing; `elsewhere`: answered on my other device;
 *  `insecure`: the call setup failed the end-to-end check; `rate`: too many calls in a minute. */
export type CallEndReason = 'hangup' | 'declined' | 'missed' | 'unreachable' | 'busy' | 'failed' | 'remote-ended' | 'elsewhere' | 'insecure' | 'rate';

const AUDIO: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  channelCount: 1,
  sampleRate: 48000,
};

/** Opus settings for clear speech on every network. */
function tuneOpus(sdp: string): string {
  const pt = sdp.match(/a=rtpmap:(\d+) opus\/48000/i)?.[1];
  if (!pt) return sdp;
  const params = 'minptime=10;useinbandfec=1;usedtx=0;stereo=0;sprop-stereo=0;maxaveragebitrate=32000;maxplaybackrate=48000;cbr=0';
  const fmtp = new RegExp(`a=fmtp:${pt} ([^\\r\\n]*)`);
  sdp = fmtp.test(sdp) ? sdp.replace(fmtp, `a=fmtp:${pt} ${params}`) : sdp.replace(`a=rtpmap:${pt} opus/48000/2`, `a=rtpmap:${pt} opus/48000/2\r\na=fmtp:${pt} ${params}`);
  if (!/a=ptime:/.test(sdp)) sdp = sdp.replace(/(m=audio[^\r\n]*\r\n)/, '$1a=ptime:20\r\n');
  return sdp;
}

/** Fire-and-forget signal (hang-up, decline): the screen never waits for the server. */
function send(body: Record<string, unknown>) {
  void fetch('/api/connect/call', { method: 'POST', headers: jsonAuthHeaders(), body: JSON.stringify(body), keepalive: true }).catch(() => undefined);
}

async function api(body: Record<string, unknown>) {
  const res = await fetch('/api/connect/call', { method: 'POST', headers: jsonAuthHeaders(), body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'تعذّر الاتصال') as Error & { code?: string };
    err.code = data.code;
    throw err;
  }
  return data;
}

export type CallQuality = { level: 'good' | 'fair' | 'poor'; relayed: boolean; rttMs?: number; lossPct?: number };
/** End-to-end check of this call (lib/connect/e2e.ts) and the code both screens show. */
export type CallSecurity = { check: SetupCheck; code: string[] | null; peerKey: PeerKey | null };

type Handlers = {
  onPhase: (phase: CallPhase) => void;
  onEnd: (reason: CallEndReason) => void;
  onConnectedAt: (ts: number) => void;
  onQuality?: (q: CallQuality) => void;
  onSecurity?: (s: CallSecurity) => void;
};

type Restart = { restart: 'offer' | 'answer' | 'request'; sdp?: string };

/** Give up when the network has not come back within this time. */
const RECONNECT_GIVE_UP_MS = 30_000;

export class VoiceCall {
  id: string | null = null;
  private pc: RTCPeerConnection | null = null;
  private mic: MediaStream | null = null;
  private audio: HTMLAudioElement;
  private pollTimer = 0;
  private iceSince = 0;
  private pendingIce: RTCIceCandidateInit[] = [];
  private remoteSet = false;
  private finished = false;
  private wakeLock: { release: () => Promise<void> } | null = null;
  private phase: CallPhase = 'idle';
  // Who is who, and what each side really uses (for the signature check and the security code).
  private isCaller = false;
  private callerId = '';
  private calleeId = '';
  private offerSdp = '';
  private answerSdp = '';
  private offerKey: string | null = null;
  private answerKey: string | null = null;
  private remoteFp: string | null = null;
  private check: SetupCheck = 'unsigned';
  private peerKey: PeerKey | null = null;
  /** The callee's device confirmed it rings (otherwise an unanswered call was "unreachable"). */
  private rang = false;
  private connectedOnce = false;
  private reconnectSince = 0;
  private reconnectTimer = 0;
  private netTimer = 0;
  private statsTimer = 0;
  private lastLost = 0;
  private lastRecv = 0;
  private seenRestart = new Set<string>();
  /** Signalling messages are applied one at a time, in order. */
  private chain: Promise<void> = Promise.resolve();

  constructor(private iceServers: RTCIceServer[], private h: Handlers, private me: string) {
    this.audio = new Audio();
    this.audio.autoplay = true;
    (this.audio as any).playsInline = true;
  }

  private setPhase(phase: CallPhase) {
    if (this.phase === phase || this.finished) return;
    this.phase = phase;
    this.h.onPhase(phase);
  }

  private serial(fn: () => Promise<void> | void) {
    this.chain = this.chain.then(fn).catch(() => undefined);
    return this.chain;
  }

  private async setup() {
    this.mic = await navigator.mediaDevices.getUserMedia({ audio: AUDIO, video: false });
    // «إخفاء عنواني»: only through our relay, so the other side never sees this device's IP.
    const hasRelay = this.iceServers.some((s) => ([] as string[]).concat(s.urls).some((u) => /^turns?:/.test(u)));
    const pc = new RTCPeerConnection({
      iceServers: this.iceServers,
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
      iceCandidatePoolSize: 2,
      iceTransportPolicy: hasRelay && relayOnly() ? 'relay' : 'all',
    });
    this.pc = pc;
    for (const track of this.mic.getAudioTracks()) pc.addTrack(track, this.mic);
    // Prefer Opus where the browser lets us choose codecs.
    try {
      const tr = pc.getTransceivers()[0];
      const caps = (RTCRtpSender as any).getCapabilities?.('audio');
      if (tr && caps?.codecs && (tr as any).setCodecPreferences) {
        const opus = caps.codecs.filter((c: any) => /opus/i.test(c.mimeType));
        const rest = caps.codecs.filter((c: any) => !/opus/i.test(c.mimeType));
        (tr as any).setCodecPreferences([...opus, ...rest]);
      }
    } catch {
      /* default codec order is fine */
    }
    pc.ontrack = (e) => {
      this.audio.srcObject = e.streams[0] || new MediaStream([e.track]);
      void this.audio.play().catch(() => undefined);
    };
    pc.onicecandidate = (e) => {
      if (e.candidate && this.id) void api({ action: 'ice', id: this.id, candidate: JSON.stringify(e.candidate.toJSON()) }).catch(() => undefined);
    };
    pc.onconnectionstatechange = () => this.onConnection(pc.connectionState);
    // Wi-Fi ↔ mobile data: move the call to the new network at once instead of waiting for it to drop.
    window.addEventListener('online', this.onNetworkChange);
    (navigator as any).connection?.addEventListener?.('change', this.onNetworkChange);
    try {
      this.wakeLock = await (navigator as any).wakeLock?.request('screen');
    } catch {
      /* the screen may dim during the call */
    }
  }

  private onConnection(state: RTCPeerConnectionState) {
    if (this.finished) return;
    if (state === 'connected') {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectSince = 0;
      if (!this.connectedOnce) {
        this.connectedOnce = true;
        this.h.onConnectedAt(Date.now());
        this.startStats();
        void this.reportSecurity();
      }
      this.setPhase('active');
    } else if (state === 'disconnected' || state === 'failed') {
      if (!this.connectedOnce) {
        if (state === 'failed') this.hangup('failed');
        return;
      }
      // Like a phone: «جارٍ إعادة الاتصال…» while the call finds a new path.
      this.setPhase('reconnecting');
      this.reconnectSince ||= Date.now();
      window.clearTimeout(this.reconnectTimer);
      if (state === 'failed') void this.restart();
      else this.reconnectTimer = window.setTimeout(() => void this.restart(), 2500);
    }
  }

  private onNetworkChange = () => {
    if (!this.connectedOnce || this.finished) return;
    window.clearTimeout(this.netTimer);
    this.netTimer = window.setTimeout(() => void this.restart(true), 800);
  };

  /**
   * ICE restart: new network paths for the same encrypted call. Only the caller
   * makes the new offer (no collisions); the callee asks the caller to.
   */
  private async restart(force = false) {
    const pc = this.pc;
    if (this.finished || !pc || !this.id) return;
    if (!force && pc.connectionState === 'connected') return;
    if (this.reconnectSince && Date.now() - this.reconnectSince > RECONNECT_GIVE_UP_MS) return this.hangup('failed');
    window.clearTimeout(this.reconnectTimer);
    if (pc.connectionState !== 'connected') this.reconnectTimer = window.setTimeout(() => void this.restart(), 6000);
    if (!this.isCaller) return this.sendRestart({ restart: 'request' });
    try {
      const offer = await pc.createOffer({ iceRestart: true });
      await pc.setLocalDescription({ type: 'offer', sdp: tuneOpus(offer.sdp || '') });
      this.sendRestart({ restart: 'offer', sdp: pc.localDescription!.sdp });
    } catch {
      /* next attempt */
    }
  }

  private sendRestart(data: Restart) {
    if (this.id) void api({ action: 'restart', id: this.id, data }).catch(() => undefined);
  }

  private async onRestart(m: Restart, key: string) {
    if (this.seenRestart.has(key)) return; // came by the live stream and by polling
    this.seenRestart.add(key);
    const pc = this.pc;
    if (!pc || this.finished) return;
    if (m.restart === 'request') {
      if (this.isCaller) await this.restart(true);
      return;
    }
    // The encryption of a running call never changes: a reconnect with another fingerprint is refused.
    if (!m.sdp || fingerprintOf(m.sdp) !== this.remoteFp) return;
    try {
      if (m.restart === 'offer' && !this.isCaller) {
        await pc.setRemoteDescription({ type: 'offer', sdp: m.sdp });
        const answer = await pc.createAnswer();
        await pc.setLocalDescription({ type: 'answer', sdp: tuneOpus(answer.sdp || '') });
        this.sendRestart({ restart: 'answer', sdp: pc.localDescription!.sdp });
      } else if (m.restart === 'answer' && this.isCaller && pc.signalingState === 'have-local-offer') {
        await pc.setRemoteDescription({ type: 'answer', sdp: m.sdp });
      }
    } catch {
      /* the next attempt starts over */
    }
  }

  /** Outgoing call. */
  async call(toUserId: string) {
    this.isCaller = true;
    this.callerId = this.me;
    this.calleeId = toUserId;
    this.setPhase('calling');
    await this.setup();
    if (this.finished || !this.pc) return; // hung up while the microphone was opening
    const offer = await this.pc.createOffer({ offerToReceiveAudio: true });
    if (this.finished || !this.pc) return;
    await this.pc.setLocalDescription({ type: 'offer', sdp: tuneOpus(offer.sdp || '') });
    this.offerSdp = this.pc.localDescription!.sdp;
    const signed = await signSetup('offer', this.offerSdp, this.callerId, this.calleeId).catch(() => ({}) as { key?: string; sig?: string });
    this.offerKey = signed.key || null;
    try {
      const res = await api({ action: 'start', to: toUserId, offer: this.offerSdp, ...signed });
      this.id = res.id;
    } catch (err) {
      if (this.finished) return;
      this.cleanup();
      const code = (err as { code?: string }).code;
      this.h.onEnd(code === 'BUSY' ? 'busy' : code === 'RATE' ? 'rate' : 'failed');
      throw err;
    }
    // Hung up while dialling: stop the other phone ringing.
    if (this.finished) return send({ action: 'end', id: this.id });
    this.startPolling();
  }

  /** Answer an incoming call (offer and the caller's signature from the live stream / poll). */
  async answer(callId: string, offerSdp: string, callerId: string, key?: string | null, sig?: string | null) {
    this.id = callId;
    this.isCaller = false;
    this.callerId = callerId;
    this.calleeId = this.me;
    this.setPhase('connecting');
    this.check = await verifySetup('offer', offerSdp, callerId, this.me, key, sig);
    if (this.check === 'invalid') return this.hangup('insecure'); // the setup was changed on the way
    this.offerSdp = offerSdp;
    this.offerKey = key || null;
    this.remoteFp = fingerprintOf(offerSdp);
    this.peerKey = await rememberPeerKey(callerId, key);
    await this.setup();
    if (this.finished || !this.pc) return;
    await this.pc.setRemoteDescription({ type: 'offer', sdp: offerSdp });
    this.remoteSet = true;
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription({ type: 'answer', sdp: tuneOpus(answer.sdp || '') });
    this.answerSdp = this.pc.localDescription!.sdp;
    const signed = await signSetup('answer', this.answerSdp, callerId, this.me).catch(() => ({}) as { key?: string; sig?: string });
    this.answerKey = signed.key || null;
    await api({ action: 'answer', id: callId, answer: this.answerSdp, ...signed });
    this.startPolling();
  }

  /** Live event from /api/connect/stream: applied at once, in order (polling stays as a backup). */
  signal(e: { type: string; id: string; state?: string; answer?: string | null; key?: string | null; sig?: string | null; ringingTs?: number | null; candidate?: string; ts?: number }) {
    if (!this.id || e.id !== this.id || this.finished) return;
    return this.serial(async () => {
      if (e.type === 'ice' && e.candidate) {
        this.iceSince = Math.max(this.iceSince, Number(e.ts) || 0);
        await this.applyCandidate(e.candidate, Number(e.ts) || 0);
      } else if (e.type === 'call') {
        if (e.ringingTs || e.state === 'ringing') this.markRinging();
        if (e.answer) await this.applyAnswer(e.answer, e.key, e.sig);
        this.applyState(e.state);
      }
    });
  }

  private markRinging() {
    if (!this.isCaller || this.rang) return;
    this.rang = true;
    if (this.phase === 'calling') this.setPhase('ringing');
  }

  private applyState(state?: string) {
    if (state === 'declined') this.end('declined');
    else if (state === 'missed') this.end(this.rang ? 'missed' : 'unreachable');
    else if (state === 'ended') this.end('remote-ended');
  }

  private applying: Promise<void> | null = null;

  private async applyAnswer(sdp: string, key?: string | null, sig?: string | null) {
    if (this.remoteSet || this.applying || !this.pc) return this.applying || undefined;
    const pc = this.pc;
    this.applying = (async () => {
      const check = await verifySetup('answer', sdp, this.callerId, this.calleeId, key, sig);
      if (check === 'invalid') return this.hangup('insecure');
      this.check = check;
      this.answerSdp = sdp;
      this.answerKey = key || null;
      this.remoteFp = fingerprintOf(sdp);
      this.peerKey = await rememberPeerKey(this.calleeId, key);
      await pc.setRemoteDescription({ type: 'answer', sdp });
      this.remoteSet = true;
      this.setPhase('connecting');
      for (const c of this.pendingIce.splice(0)) await pc.addIceCandidate(c).catch(() => undefined);
    })();
    return this.applying;
  }

  private async applyCandidate(raw: string, ts: number) {
    let init: RTCIceCandidateInit & Partial<Restart>;
    try {
      init = JSON.parse(raw);
    } catch {
      return;
    }
    if (typeof init.restart === 'string') return this.onRestart(init as Restart, `${ts}|${init.restart}`);
    if (!this.remoteSet && this.applying) await this.applying.catch(() => undefined);
    if (this.remoteSet && this.pc) await this.pc.addIceCandidate(init).catch(() => undefined);
    else this.pendingIce.push(init);
  }

  /** The security code (same on both phones = nobody in the middle). */
  private async reportSecurity() {
    if (!this.h.onSecurity) return;
    const code = await safetyCode(this.offerSdp, this.answerSdp, this.offerKey, this.answerKey).catch(() => null);
    if (!this.finished) this.h.onSecurity({ check: this.check, code, peerKey: this.peerKey });
  }

  /** Call quality every 2 s: lost packets, delay and jitter of the audio, and whether it goes through the relay. */
  private startStats() {
    const tick = async () => {
      const pc = this.pc;
      if (this.finished || !pc) return;
      try {
        const report = await pc.getStats();
        let pairId = '';
        report.forEach((r: any) => {
          if (r.type === 'transport' && r.selectedCandidatePairId) pairId = r.selectedCandidatePairId;
        });
        let rtt: number | undefined;
        let relayed = false;
        let lost = 0;
        let recv = 0;
        let jitter = 0;
        report.forEach((r: any) => {
          if (r.type === 'candidate-pair' && (r.id === pairId || (!pairId && r.nominated && r.state === 'succeeded'))) {
            rtt = r.currentRoundTripTime;
            relayed = report.get(r.localCandidateId)?.candidateType === 'relay' || report.get(r.remoteCandidateId)?.candidateType === 'relay';
          }
          if (r.type === 'inbound-rtp' && r.kind === 'audio') {
            lost = r.packetsLost || 0;
            recv = r.packetsReceived || 0;
            jitter = r.jitter || 0;
          }
        });
        const dLost = Math.max(0, lost - this.lastLost);
        const dRecv = Math.max(0, recv - this.lastRecv);
        this.lastLost = lost;
        this.lastRecv = recv;
        const lossPct = dLost + dRecv ? (dLost / (dLost + dRecv)) * 100 : 100;
        const rttMs = rtt !== undefined ? rtt * 1000 : undefined;
        const level: CallQuality['level'] =
          lossPct > 8 || (rttMs ?? 0) > 600 || jitter > 0.08 ? 'poor' : lossPct > 3 || (rttMs ?? 0) > 300 || jitter > 0.04 ? 'fair' : 'good';
        if (this.phase === 'active') this.h.onQuality?.({ level, relayed, rttMs, lossPct });
      } catch {
        /* next round */
      }
      this.statsTimer = window.setTimeout(tick, 2000);
    };
    this.statsTimer = window.setTimeout(tick, 2000);
  }

  static decline(callId: string) {
    send({ action: 'decline', id: callId });
  }

  /** The incoming call really rings on this device: the caller sees «يرنّ…». */
  static ringing(callId: string) {
    send({ action: 'ringing', id: callId });
  }

  setMuted(muted: boolean) {
    this.mic?.getAudioTracks().forEach((t) => (t.enabled = !muted));
  }

  /** Ends at once on this phone; the other side is told in the background. */
  hangup(reason: CallEndReason = 'hangup') {
    if (this.finished) return;
    const id = this.id;
    this.cleanup();
    this.h.onEnd(reason);
    if (id) send({ action: 'end', id });
  }

  private startPolling() {
    const tick = async () => {
      if (this.finished || !this.id) return;
      try {
        const res = await fetch(`/api/connect/call?id=${encodeURIComponent(this.id)}&since=${this.iceSince}`, { headers: authHeaders(), cache: 'no-store' });
        const data = await res.json();
        await this.serial(async () => {
          if (data.ringingTs) this.markRinging();
          if (data.answer) await this.applyAnswer(data.answer, data.key, data.sig);
          for (const c of data.candidates || []) {
            this.iceSince = Math.max(this.iceSince, Number(c.ts) || 0);
            await this.applyCandidate(c.candidate, Number(c.ts) || 0);
          }
          this.applyState(data.state);
        });
      } catch {
        /* network blip: try again */
      }
      // Fast while setting up, slower once the audio flows.
      this.pollTimer = window.setTimeout(tick, this.pc?.connectionState === 'connected' ? 2500 : 700);
    };
    void tick();
  }

  private end(reason: CallEndReason) {
    if (this.finished) return;
    this.cleanup();
    this.h.onEnd(reason);
  }

  private cleanup() {
    this.finished = true;
    window.clearTimeout(this.pollTimer);
    window.clearTimeout(this.reconnectTimer);
    window.clearTimeout(this.netTimer);
    window.clearTimeout(this.statsTimer);
    window.removeEventListener('online', this.onNetworkChange);
    (navigator as any).connection?.removeEventListener?.('change', this.onNetworkChange);
    this.mic?.getTracks().forEach((t) => t.stop());
    this.pc?.getSenders().forEach((s) => s.track?.stop());
    this.pc?.close();
    this.pc = null;
    this.audio.srcObject = null;
    void this.wakeLock?.release().catch(() => undefined);
    this.phase = 'ended';
    this.h.onPhase('ended');
  }
}

/* ---------------- classic telephone tones (no audio files) ---------------- */

let toneCtx: AudioContext | null = null;
let toneTimer = 0;
let toneNodes: OscillatorNode[] = [];

function ctx(): AudioContext {
  toneCtx ||= new (window.AudioContext || (window as any).webkitAudioContext)();
  if (toneCtx.state === 'suspended') void toneCtx.resume();
  return toneCtx;
}

function burst(freqs: number[], seconds: number, volume: number) {
  const c = ctx();
  const gain = c.createGain();
  gain.gain.value = volume;
  gain.connect(c.destination);
  toneNodes = freqs.map((f) => {
    const o = c.createOscillator();
    o.frequency.value = f;
    o.connect(gain);
    o.start();
    o.stop(c.currentTime + seconds);
    return o;
  });
}

/* ---------------- ringtones (lib/connect/ringtones.ts) ----------------
 * The chosen tone is rendered once into a seamless loop and played on repeat.
 * It starts soft and swells to full volume over ~10 s (like a phone that
 * "rings louder"), through a compressor so it is loud on small speakers
 * without crackling. */

const RENDER_RATE = 48000;
const rendered = new Map<RingtoneId, Float32Array>();

function samples(id: RingtoneId): Float32Array {
  let s = rendered.get(id);
  if (!s) {
    s = renderRingtone(id, RENDER_RATE);
    rendered.set(id, s);
  }
  return s;
}

/** Renders the chosen ringtone while the app is idle, so an incoming call rings at once. */
export function warmRingtone(id: RingtoneId = getRingtone()) {
  const run = () => void samples(id);
  const idle = (window as unknown as { requestIdleCallback?: (fn: () => void, o?: { timeout: number }) => void }).requestIdleCallback;
  if (idle) idle(run, { timeout: 4000 });
  else window.setTimeout(run, 1500);
}

let ringBus: GainNode | null = null;
let ringSource: AudioBufferSourceNode | null = null;
let previewDone: (() => void) | null = null;

function playRingtone(id: RingtoneId, preview: boolean) {
  const c = ctx();
  const now = c.currentTime;
  const comp = c.createDynamicsCompressor();
  comp.threshold.value = -20;
  comp.knee.value = 10;
  comp.ratio.value = 5;
  comp.attack.value = 0.003;
  comp.release.value = 0.25;
  const bus = c.createGain();
  bus.gain.setValueAtTime(0.0001, now);
  if (preview) {
    bus.gain.exponentialRampToValueAtTime(0.8, now + 0.15);
  } else {
    bus.gain.exponentialRampToValueAtTime(0.35, now + 0.6); // soft start
    bus.gain.linearRampToValueAtTime(1, now + 10); // then swell to full volume
  }
  const makeup = c.createGain();
  makeup.gain.value = 1.6;
  bus.connect(comp).connect(makeup).connect(c.destination);
  const data = samples(id);
  const buffer = c.createBuffer(1, data.length, RENDER_RATE);
  buffer.getChannelData(0).set(data);
  const src = c.createBufferSource();
  src.buffer = buffer;
  src.loop = !preview; // a preview plays the loop once
  src.connect(bus);
  src.start(now + 0.02);
  ringBus = bus;
  ringSource = src;
  if (preview) {
    src.onended = () => {
      if (ringSource === src) stopTone();
    };
    return;
  }
  const buzz = () => navigator.vibrate?.([350, 150, 350, 150, 900]);
  buzz();
  toneTimer = window.setInterval(buzz, ringtoneSeconds(id) * 1000);
}

function startRingtone() {
  playRingtone(getRingtone(), false);
}

/** Plays a ringtone once (the picker); `onEnd` runs when it finishes or is stopped. */
export function previewRingtone(id: RingtoneId, onEnd: () => void) {
  stopTone();
  playRingtone(id, true);
  previewDone = onEnd;
}

/** Stops a preview, never a real call ringing. */
export function stopRingtonePreview() {
  if (previewDone) stopTone();
}

/** Ringback for the caller (440+480 Hz, 2 s on / 4 s off), or the chosen ringtone for the callee. */
export function startTone(kind: 'ringback' | 'ring') {
  stopTone();
  if (kind === 'ring') {
    startRingtone();
    return;
  }
  const play = () => burst([440, 480], 2, 0.08);
  play();
  toneTimer = window.setInterval(play, 6000);
}

export function stopTone() {
  window.clearInterval(toneTimer);
  toneNodes.forEach((o) => {
    try {
      o.stop();
    } catch {
      /* already stopped */
    }
  });
  toneNodes = [];
  const done = previewDone;
  previewDone = null;
  const src = ringSource;
  ringSource = null;
  if (ringBus && toneCtx) {
    // Quick fade instead of a click, then cut the chain (silences notes already scheduled).
    const bus = ringBus;
    ringBus = null;
    const g = bus.gain as AudioParam & { cancelAndHoldAtTime?: (t: number) => void };
    if (g.cancelAndHoldAtTime) g.cancelAndHoldAtTime(toneCtx.currentTime);
    else g.cancelScheduledValues(toneCtx.currentTime);
    bus.gain.setTargetAtTime(0.0001, toneCtx.currentTime, 0.03);
    window.setTimeout(() => {
      try {
        src?.stop();
      } catch {
        /* already ended */
      }
      bus.disconnect();
    }, 200);
  }
  navigator.vibrate?.(0);
  done?.();
}

/** New message in another chat: a soft two-note "ding" (quiet, short, no file). */
export function playMessageSound() {
  try {
    const c = ctx();
    const t = c.currentTime + 0.01;
    for (const [at, f] of [[0, 1318.51], [0.09, 1760]] as const) {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t + at);
      g.gain.exponentialRampToValueAtTime(0.12, t + at + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + at + 0.35);
      o.connect(g).connect(c.destination);
      o.start(t + at);
      o.stop(t + at + 0.4);
    }
  } catch {
    /* sound is a bonus */
  }
}
