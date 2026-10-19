'use client';

import { useState } from 'react';
import { Check, Loader2, Plus, ShieldCheck, Trash2, Users, X } from 'lucide-react';
import { jsonAuthHeaders } from '@/lib/api-client';
import { VISA_LABEL, VISA_STEPS, visaStatusOf, visaTone } from '@/lib/visa';
import type { Reservation, TravelerInfo } from '@/types';

const empty = (): TravelerInfo => ({ first_name: '', last_name: '', passport_number: '', passport_expiry: '', birth_date: '', gender: 'MALE', traveler_type: 'ADULT' });

/**
 * Client portal, tourist trip: who travels (names and passports, used for the
 * visa file) and where the visa stands. The agency moves the visa forward.
 */
export default function TripTravelersCard({ reservation, onChanged }: { reservation: Reservation; onChanged?: () => void }) {
  const [list, setList] = useState<TravelerInfo[]>(reservation.travelers?.length ? reservation.travelers : [empty()]);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const visa = visaStatusOf(reservation.visa_status);
  const stepIndex = VISA_STEPS.findIndex((s) => s.id === visa);
  const tone = visaTone(visa);

  const save = async () => {
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch('/api/bookings/trip-details', {
        method: 'POST',
        headers: jsonAuthHeaders(),
        body: JSON.stringify({ action: 'travelers', reservationId: reservation.reservation_id, travelers: list }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'تعذّر الحفظ');
      setMsg('حُفظت بيانات المسافرين ✓');
      setEditing(false);
      onChanged?.();
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  };

  const set = (i: number, p: Partial<TravelerInfo>) => setList((l) => l.map((t, j) => (j === i ? { ...t, ...p } : t)));

  return (
    <section className="ttv" dir="rtl">
      <div className={`ttv-visa is-${tone}`}>
        <h3><ShieldCheck aria-hidden /> التأشيرة — {VISA_LABEL[visa]}</h3>
        {visa === 'REFUSED' || visa === 'NOT_REQUIRED' ? (
          <p>{visa === 'REFUSED' ? 'رُفض طلب التأشيرة. تواصل مع الوكالة لمعرفة الخطوة التالية.' : 'هذه الوجهة لا تحتاج تأشيرة لجواز سفرك.'}</p>
        ) : (
          <ol className="ttv-steps">
            {VISA_STEPS.map((s, i) => (
              <li key={s.id} className={i < stepIndex ? 'is-done' : i === stepIndex ? 'is-now' : ''}>
                <span aria-hidden>{i < stepIndex ? <Check /> : i + 1}</span>
                <b>{s.label}</b>
                {i === stepIndex ? <small>{s.hint}</small> : null}
              </li>
            ))}
          </ol>
        )}
        {reservation.visa_note ? <p className="ttv-note">ملاحظة الوكالة: {reservation.visa_note}</p> : null}
      </div>

      <div className="ttv-trav">
        <header>
          <h3><Users aria-hidden /> المسافرون ({list.filter((t) => t.first_name).length})</h3>
          {!editing ? <button type="button" onClick={() => setEditing(true)}>تعديل</button> : null}
        </header>
        {!editing ? (
          <ul>
            {list.filter((t) => t.first_name).map((t, i) => (
              <li key={i}>
                <b>{`${t.first_name} ${t.last_name}`.trim()}</b>
                <small dir="ltr">{t.passport_number || '— جواز غير مسجّل'}{t.passport_expiry ? ` · ${t.passport_expiry}` : ''}</small>
              </li>
            ))}
          </ul>
        ) : (
          <div className="ttv-edit">
            {list.map((t, i) => (
              <div key={i} className="ttv-row">
                <input placeholder="الاسم" value={t.first_name} onChange={(e) => set(i, { first_name: e.target.value })} />
                <input placeholder="اللقب" value={t.last_name} onChange={(e) => set(i, { last_name: e.target.value })} />
                <input placeholder="رقم الجواز" dir="ltr" value={t.passport_number} onChange={(e) => set(i, { passport_number: e.target.value })} />
                <label>انتهاء الجواز<input type="date" value={t.passport_expiry} onChange={(e) => set(i, { passport_expiry: e.target.value })} /></label>
                <label>تاريخ الميلاد<input type="date" value={t.birth_date} onChange={(e) => set(i, { birth_date: e.target.value })} /></label>
                <select value={t.gender} onChange={(e) => set(i, { gender: e.target.value as TravelerInfo['gender'] })} aria-label="الجنس">
                  <option value="MALE">ذكر</option>
                  <option value="FEMALE">أنثى</option>
                </select>
                {list.length > 1 ? <button type="button" className="ttv-del" aria-label="حذف" onClick={() => setList((l) => l.filter((_, j) => j !== i))}><Trash2 /></button> : null}
              </div>
            ))}
            <div className="ttv-acts">
              <button type="button" onClick={() => setList((l) => [...l, empty()])}><Plus aria-hidden /> مسافر</button>
              <span />
              <button type="button" onClick={() => setEditing(false)}><X aria-hidden /> إلغاء</button>
              <button type="button" className="is-primary" disabled={busy} onClick={save}>{busy ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />} حفظ</button>
            </div>
          </div>
        )}
        {msg ? <p className="ttv-msg">{msg}</p> : null}
        <p className="ttv-fine">الأسماء كما في جواز السفر. تستعملها الوكالة لملف التأشيرة والتذاكر والفنادق.</p>
      </div>
    </section>
  );
}
