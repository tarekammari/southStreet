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
        void this.hangup('failed');
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
    const offer = await this.pc!.createOffer({ offerToReceiveAudio: true });
    await this.pc!.setLocalDescription({ type: 'offer', sdp: tuneOpus(offer.sdp || '') });
    try {
      const res = await api({ action: 'start', to: toUserId, offer: this.pc!.localDescription!.sdp });
      this.id = res.id;
    } catch (err) {
      this.cleanup();
      this.h.onEnd((err as { code?: string }).code === 'BUSY' ? 'busy' : 'failed');
      throw err;
    }
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

  static async decline(callId: string) {
    await api({ action: 'decline', id: callId }).catch(() => undefined);
  }

  setMuted(muted: boolean) {
    this.mic?.getAudioTracks().forEach((t) => (t.enabled = !muted));
  }

  async hangup(reason: CallEndReason = 'hangup') {
    if (this.finished) return;
    if (this.id) await api({ action: 'end', id: this.id }).catch(() => undefined);
    this.cleanup();
    this.h.onEnd(reason);
  }

  private startPolling() {
    const tick = async () => {
      if (this.finished || !this.id) return;
      try {
        const res = await fetch(`/api/connect/call?id=${encodeURIComponent(this.id)}&since=${this.iceSince}`, { headers: authHeaders(), cache: 'no-store' });
        const data = await res.json();
        if (data.answer && !this.remoteSet && this.pc) {
          await this.pc.setRemoteDescription({ type: 'answer', sdp: data.answer });
          this.remoteSet = true;
          this.h.onPhase('connecting');
          for (const c of this.pendingIce.splice(0)) await this.pc.addIceCandidate(c).catch(() => undefined);
        }
        for (const c of data.candidates || []) {
          this.iceSince = Math.max(this.iceSince, Number(c.ts) || 0);
          let init: RTCIceCandidateInit;
          try {
            init = JSON.parse(c.candidate);
          } catch {
            continue;
          }
          if (this.remoteSet && this.pc) await this.pc.addIceCandidate(init).catch(() => undefined);
          else this.pendingIce.push(init);
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

/** Ringback for the caller (440+480 Hz, 2 s on / 4 s off) or ringer for the callee (louder, with vibration). */
export function startTone(kind: 'ringback' | 'ring') {
  stopTone();
  const play = () => {
    if (kind === 'ring') {
      burst([440, 480], 1, 0.22);
      window.setTimeout(() => burst([440, 480], 1, 0.22), 1200);
      navigator.vibrate?.([800, 400, 800]);
    } else {
      burst([440, 480], 2, 0.08);
    }
  };
  play();
  toneTimer = window.setInterval(play, kind === 'ring' ? 3500 : 6000);
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
  navigator.vibrate?.(0);
}
