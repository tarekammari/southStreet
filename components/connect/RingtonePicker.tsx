'use client';

import { useEffect, useState } from 'react';
import { Check, ChevronDown, Music, Play, Square } from 'lucide-react';
import { RINGTONES, RINGTONE_GROUPS, DEFAULT_RINGTONE, type RingtoneGroup, type RingtoneId } from '@/lib/connect/ringtones';
import { getRingtone, saveRingtone } from '@/lib/connect/device-prefs';
import { previewRingtone, stopRingtonePreview, warmRingtone } from '@/lib/connect/rtc';

const GROUPS: RingtoneGroup[] = ['classic', 'space', 'nature'];

/**
 * «نغمة الرنين»: pick the tone incoming calls ring with on this device.
 * Tapping a tone picks it and plays it once; tapping it again stops it.
 * `busy`: a call is ringing or in progress, so nothing is played over it.
 */
export default function RingtonePicker({ busy }: { busy: boolean }) {
  const [chosen, setChosen] = useState<RingtoneId>(DEFAULT_RINGTONE);
  const [playing, setPlaying] = useState<RingtoneId | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setChosen(getRingtone());
    return () => stopRingtonePreview();
  }, []);

  useEffect(() => {
    if (busy) stopRingtonePreview();
  }, [busy]);

  const pick = (id: RingtoneId) => {
    setChosen(id);
    saveRingtone(id);
    warmRingtone(id);
    if (busy) return;
    if (playing === id) {
      stopRingtonePreview();
      return;
    }
    previewRingtone(id, () => setPlaying((p) => (p === id ? null : p)));
    setPlaying(id);
  };

  const current = RINGTONES.find((r) => r.id === chosen);

  return (
    <section className="cn-tones">
      <button type="button" className="cn-tones-head" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Music className="w-5 h-5" />
        <span>
          <b>نغمة الرنين</b>
          <small>{current?.name}</small>
        </span>
        <ChevronDown className={`w-5 h-5 cn-tones-chev${open ? ' is-open' : ''}`} />
      </button>
      {open ? (
        <div className="cn-tones-list">
          {GROUPS.map((g) => (
            <div key={g} role="radiogroup" aria-label={RINGTONE_GROUPS[g]}>
              <h3>{RINGTONE_GROUPS[g]}</h3>
              {RINGTONES.filter((r) => r.group === g).map((r) => (
                <button
                  key={r.id}
                  type="button"
                  role="radio"
                  aria-checked={chosen === r.id}
                  className={`cn-tone${chosen === r.id ? ' is-on' : ''}`}
                  onClick={() => pick(r.id)}
                >
                  <span className={`cn-tone-play is-${r.group}`} aria-hidden>
                    {playing === r.id ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </span>
                  <span className="cn-tone-text">
                    <b>{r.name}</b>
                    <small>{r.hint}</small>
                  </span>
                  {chosen === r.id ? <Check className="w-5 h-5 cn-tone-check" /> : null}
                </button>
              ))}
            </div>
          ))}
          <p className="cn-sheet-hint">{busy ? 'لا تُشغَّل المعاينة أثناء مكالمة.' : 'اضغط نغمة لاختيارها وسماعها. تُحفظ على هذا الجهاز.'}</p>
        </div>
      ) : null}
    </section>
  );
}
