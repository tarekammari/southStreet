'use client';

import { useState } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';
import { jsonAuthHeaders } from '@/lib/api-client';
import { VISA_LABEL, VISA_STATUSES, visaStatusOf, visaTone, type VisaStatus } from '@/lib/visa';

/** Request queue (tourist trips): staff move the client's visa forward. */
export default function VisaControl({ reservationId, status, note, onSaved }: { reservationId: string; status?: string; note?: string; onSaved?: () => void }) {
  const [value, setValue] = useState<VisaStatus>(visaStatusOf(status));
  const [text, setText] = useState(note || '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const save = async (next: VisaStatus, nextNote = text) => {
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch('/api/bookings/trip-details', {
        method: 'POST',
        headers: jsonAuthHeaders(),
        body: JSON.stringify({ action: 'visa', reservationId, status: next, note: nextNote }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'تعذّر الحفظ');
      setMsg('حُفظ ✓');
      onSaved?.();
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`visa-ctl is-${visaTone(value)}`}>
      <ShieldCheck aria-hidden />
      <label>
        التأشيرة
        <select
          value={value}
          disabled={busy}
          onChange={(e) => {
            const v = e.target.value as VisaStatus;
            setValue(v);
            void save(v);
          }}
        >
          {VISA_STATUSES.map((s) => <option key={s} value={s}>{VISA_LABEL[s]}</option>)}
        </select>
      </label>
      <input value={text} placeholder="ملاحظة للعميل (اختياري)" onChange={(e) => setText(e.target.value)} onBlur={() => text !== (note || '') && save(value, text)} />
      {busy ? <Loader2 className="animate-spin" aria-hidden /> : msg ? <small>{msg}</small> : null}
    </div>
  );
}
