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
 */
import { jsonAuthHeaders, authHeaders } from '@/lib/api-client';

export type CallPhase = 'idle' | 'calling' | 'ringing' | 'connecting' | 'active' | 'ended';
export type CallEndReason = 'hangup' | 'declined' | 'missed' | 'busy' | 'failed' | 'remote-ended';

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

type Handlers = {
  onPhase: (phase: CallPhase) => void;
  onEnd: (reason: CallEndReason) => void;
  onConnectedAt: (ts: number) => void;
};

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

  constructor(private iceServers: RTCIceServer[], private h: Handlers) {
    this.audio = new Audio();
    this.audio.autoplay = true;
    (this.audio as any).playsInline = true;
  }

  private async setup() {
    this.mic = await navigator.mediaDevices.getUserMedia({ audio: AUDIO, video: false });
    const pc = new RTCPeerConnection({ iceServers: this.iceServers, bundlePolicy: 'max-bundle', rtcpMuxPolicy: 'require' });
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
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        this.h.onPhase('active');
        this.h.onConnectedAt(Date.now());
      } else if (pc.connectionState === 'failed') {
        this.hangup('failed');
      }
    };
    try {
      this.wakeLock = await (navigator as any).wakeLock?.request('screen');
    } catch {
      /* the screen may dim during the call */
    }
  }

  /** Outgoing call. */
  async call(toUserId: string) {
    this.h.onPhase('calling');
    await this.setup();
    if (this.finished || !this.pc) return; // hung up while the microphone was opening
    const offer = await this.pc.createOffer({ offerToReceiveAudio: true });
    if (this.finished || !this.pc) return;
    await this.pc.setLocalDescription({ type: 'offer', sdp: tuneOpus(offer.sdp || '') });
    try {
      const res = await api({ action: 'start', to: toUserId, offer: this.pc.localDescription!.sdp });
      this.id = res.id;
    } catch (err) {
      if (this.finished) return;
      this.cleanup();
      this.h.onEnd((err as { code?: string }).code === 'BUSY' ? 'busy' : 'failed');
      throw err;
    }
    // Hung up while dialling: stop the other phone ringing.
    if (this.finished) return send({ action: 'end', id: this.id });
    this.startPolling();
  }

  /** Answer an incoming call (offer from /api/connect/poll). */
  async answer(callId: string, offerSdp: string) {
    this.id = callId;
    this.h.onPhase('connecting');
    await this.setup();
    await this.pc!.setRemoteDescription({ type: 'offer', sdp: offerSdp });
    this.remoteSet = true;
    const answer = await this.pc!.createAnswer();
    await this.pc!.setLocalDescription({ type: 'answer', sdp: tuneOpus(answer.sdp || '') });
    await api({ action: 'answer', id: callId, answer: this.pc!.localDescription!.sdp });
    this.startPolling();
  }

  /** Live event from /api/connect/stream: applied at once (polling stays as a backup). */
  async signal(e: { type: string; id: string; state?: string; answer?: string | null; candidate?: string; ts?: number }) {
    if (!this.id || e.id !== this.id || this.finished) return;
    if (e.type === 'ice' && e.candidate) {
      this.iceSince = Math.max(this.iceSince, Number(e.ts) || 0);
      await this.applyCandidate(e.candidate);
    } else if (e.type === 'call') {
      if (e.answer) await this.applyAnswer(e.answer);
      if (e.state === 'declined') this.end('declined');
      else if (e.state === 'missed') this.end('missed');
      else if (e.state === 'ended') this.end('remote-ended');
    }
  }

  private applying: Promise<void> | null = null;

  private async applyAnswer(sdp: string) {
    if (this.remoteSet || this.applying || !this.pc) return this.applying || undefined;
    const pc = this.pc;
    this.applying = (async () => {
      await pc.setRemoteDescription({ type: 'answer', sdp });
      this.remoteSet = true;
      this.h.onPhase('connecting');
      for (const c of this.pendingIce.splice(0)) await pc.addIceCandidate(c).catch(() => undefined);
    })();
    return this.applying;
  }

  private async applyCandidate(raw: string) {
    let init: RTCIceCandidateInit;
    try {
      init = JSON.parse(raw);
    } catch {
      return;
    }
    if (!this.remoteSet && this.applying) await this.applying.catch(() => undefined);
    if (this.remoteSet && this.pc) await this.pc.addIceCandidate(init).catch(() => undefined);
    else this.pendingIce.push(init);
  }

  static decline(callId: string) {
    send({ action: 'decline', id: callId });
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
        if (data.answer) await this.applyAnswer(data.answer);
        for (const c of data.candidates || []) {
          this.iceSince = Math.max(this.iceSince, Number(c.ts) || 0);
          await this.applyCandidate(c.candidate);
        }
        if (data.state === 'declined') return void this.end('declined');
        if (data.state === 'missed') return void this.end('missed');
        if (data.state === 'ended') return void this.end('remote-ended');
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
    this.mic?.getTracks().forEach((t) => t.stop());
    this.pc?.getSenders().forEach((s) => s.track?.stop());
    this.pc?.close();
    this.pc = null;
    this.audio.srcObject = null;
    void this.wakeLock?.release().catch(() => undefined);
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

/* ---------------- ringtone: "South Street" melody (synthesised, no audio file) ----------------
 * A bright marimba phrase answered by two bird-like chirps. It starts soft and
 * swells to full volume over ~10 s (like a phone that "rings louder"), through a
 * compressor so it is loud on small speakers without crackling. */

const NOTE = { E5: 659.25, G5: 783.99, A5: 880, C6: 1046.5, D6: 1174.66, E6: 1318.51 } as const;
const PHRASE: [number, keyof typeof NOTE, number][] = [
  [0.0, 'E5', 0.8], [0.16, 'G5', 0.7], [0.32, 'A5', 0.75], [0.48, 'C6', 0.9],
  [0.8, 'A5', 0.7], [0.96, 'C6', 0.75], [1.12, 'D6', 0.8], [1.28, 'E6', 1],
  [1.6, 'D6', 0.7], [1.76, 'C6', 0.7], [1.92, 'A5', 0.75], [2.08, 'G5', 0.85],
];
const RING_LOOP_S = 3.4;

let ringBus: GainNode | null = null;

function marimba(c: AudioContext, bus: AudioNode, freq: number, at: number, vel: number) {
  // Woody body: fundamental + a quick, bright 4th partial (the mallet "tock").
  const parts: [number, number, number][] = [[1, vel * 0.55, 0.9], [2, vel * 0.08, 0.35], [4, vel * 0.16, 0.09]];
  for (const [mul, peak, decay] of parts) {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.value = freq * mul;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(peak, at + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, at + decay);
    o.connect(g).connect(bus);
    o.start(at);
    o.stop(at + decay + 0.05);
  }
}

function chirp(c: AudioContext, bus: AudioNode, at: number, from: number, to: number, dur: number) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(from, at);
  o.frequency.exponentialRampToValueAtTime(to, at + dur * 0.7);
  o.frequency.exponentialRampToValueAtTime(from * 1.1, at + dur);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(0.22, at + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(bus);
  o.start(at);
  o.stop(at + dur + 0.02);
}

function playRingPhrase(c: AudioContext, bus: AudioNode) {
  const t = c.currentTime + 0.05;
  PHRASE.forEach(([dt, n, v]) => marimba(c, bus, NOTE[n], t + dt, v));
  chirp(c, bus, t + 2.42, 2600, 3900, 0.11);
  chirp(c, bus, t + 2.56, 2800, 4300, 0.1);
  chirp(c, bus, t + 2.74, 3000, 4600, 0.14);
}

function startRingtone() {
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
  bus.gain.exponentialRampToValueAtTime(0.35, now + 0.6); // soft start
  bus.gain.linearRampToValueAtTime(1, now + 10); // then swell to full volume
  const makeup = c.createGain();
  makeup.gain.value = 1.6;
  bus.connect(comp).connect(makeup).connect(c.destination);
  ringBus = bus;
  const play = () => {
    playRingPhrase(c, bus);
    navigator.vibrate?.([350, 150, 350, 150, 900]);
  };
  play();
  toneTimer = window.setInterval(play, RING_LOOP_S * 1000);
}

/** Ringback for the caller (440+480 Hz, 2 s on / 4 s off), or the melodic ringtone for the callee. */
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
  if (ringBus && toneCtx) {
    // Quick fade instead of a click, then cut the chain (silences notes already scheduled).
    const bus = ringBus;
    ringBus = null;
    const g = bus.gain as AudioParam & { cancelAndHoldAtTime?: (t: number) => void };
    if (g.cancelAndHoldAtTime) g.cancelAndHoldAtTime(toneCtx.currentTime);
    else g.cancelScheduledValues(toneCtx.currentTime);
    bus.gain.setTargetAtTime(0.0001, toneCtx.currentTime, 0.03);
    window.setTimeout(() => bus.disconnect(), 200);
  }
  navigator.vibrate?.(0);
}
