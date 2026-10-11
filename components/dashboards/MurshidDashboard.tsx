'use client';

/**
 * Guide workspace (portal → لوحة المرشد): the guide's own programs, his group
 * per program (travellers, passports, contact), check-ins per stage, a message
 * to the whole group, field tools and teaching Sakhr. Data: /api/guide.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  BedDouble,
  CalendarDays,
  Check,
  CheckCircle2,
  Compass,
  GraduationCap,
  Loader2,
  MapPin,
  MessageSquareText,
  Phone,
  Plane,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  Users,
} from 'lucide-react';
import { User } from '@/types';
import AiKnowledgeManager from '@/components/AiKnowledgeManager';
import { WhatsAppIcon } from '@/components/social/SocialIcons';
import { waLink } from '@/lib/social';
import { authHeaders, jsonAuthHeaders } from '@/lib/api-client';
import { parseTripDate } from '@/lib/booking-catalog';
import { GUIDE_STAGES, type GuideStageId } from '@/lib/guide-stages';
import type { GuideProgram } from '@/lib/guide';
import './guide.css';

interface MurshidDashboardProps {
  currentUser: User;
  /** Kept for compatibility with the portal; the group now comes from /api/guide. */
  pilgrims?: User[];
  onBroadcast?: () => void;
}

type View = 'group' | 'tools' | 'sakhr';
type GuideData = { guide: { name: string; title: string; photo: string } | null; programs: GuideProgram[]; notice?: string };

const STATE_LABEL: Record<GuideProgram['state'], string> = { upcoming: 'قادم', ongoing: 'جارٍ الآن', past: 'منتهٍ' };

function dateLabel(value: string, withYear = false): string {
  const d = parseTripDate(value);
  return d ? d.toLocaleDateString('ar-DZ', { day: 'numeric', month: 'long', ...(withYear ? { year: 'numeric' } : {}) }) : '—';
}

export default function MurshidDashboard({ currentUser }: MurshidDashboardProps) {
  const [data, setData] = useState<GuideData | null>(null);
  const [error, setError] = useState('');
  const [view, setView] = useState<View>('group');
  const [selected, setSelected] = useState<string | null>(null);
  const [stage, setStage] = useState<GuideStageId>('airport');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [toast, setToast] = useState<{ text: string; bad?: boolean } | null>(null);

  const notify = (text: string, bad = false) => {
    setToast({ text, bad });
    window.setTimeout(() => setToast(null), 3200);
  };

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/guide', { headers: authHeaders(), cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'تعذّر التحميل');
      setData(json);
      setError('');
      setSelected((cur) => cur && json.programs.some((p: GuideProgram) => p.packageId === cur) ? cur : json.programs[0]?.packageId || null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const program = data?.programs.find((p) => p.packageId === selected) || null;
  const next = data?.programs.find((p) => p.state !== 'past') || null;

  const kpis = useMemo(() => {
    if (!data) return null;
    const active = data.programs.filter((p) => p.state !== 'past');
    const target = program || next;
    const missingPassports = target ? target.bookings.reduce((n, b) => n + b.travelers.filter((t) => !t.passport).length, 0) : 0;
    return {
      programs: active.length,
      pilgrims: target?.pilgrims || 0,
      days: next?.daysToStart ?? null,
      missingPassports,
    };
  }, [data, program, next]);

  const visible = useMemo(() => {
    if (!program) return [];
    const q = query.trim().toLowerCase();
    return program.bookings.filter((b) => !q || [b.name, b.number, b.phone, ...b.travelers.map((t) => t.name)].some((v) => String(v).toLowerCase().includes(q)));
  }, [program, query]);

  const stageDone = (id: GuideStageId) => (program ? program.bookings.filter((b) => b.checkins[id]).length : 0);

  const toggleCheckin = async (reservationId: string, done: boolean) => {
    if (!program) return;
    setBusy(reservationId);
    // Optimistic: tick at once, roll back if the server refuses.
    setData((d) => d && {
      ...d,
      programs: d.programs.map((p) => p.packageId !== program.packageId ? p : {
        ...p,
        bookings: p.bookings.map((b) => b.reservationId !== reservationId ? b : {
          ...b,
          checkins: done ? { ...b.checkins, [stage]: { at: Date.now(), by: currentUser.name } } : Object.fromEntries(Object.entries(b.checkins).filter(([k]) => k !== stage)),
        }),
      }),
    });
    try {
      const res = await fetch('/api/guide', { method: 'POST', headers: jsonAuthHeaders(), body: JSON.stringify({ action: 'checkin', packageId: program.packageId, reservationId, stage, done }) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'تعذّر الحفظ');
    } catch (err) {
      notify((err as Error).message, true);
      void load();
    } finally {
      setBusy(null);
    }
  };

  const sendGroupMessage = async () => {
    if (!program || !message.trim()) return;
    setBusy('message');
    try {
      const res = await fetch('/api/guide', { method: 'POST', headers: jsonAuthHeaders(), body: JSON.stringify({ action: 'message', packageId: program.packageId, text: message }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'تعذّر الإرسال');
      setMessage('');
      notify(`أُرسلت الرسالة إلى ${json.sent} معتمر في المحادثة`);
    } catch (err) {
      notify((err as Error).message, true);
    } finally {
      setBusy(null);
    }
  };

  // "الشيخ أحمد التجريبي" → "الشيخ أحمد": keep a title together with the first name.
  const nameParts = (data?.guide?.name || currentUser.name || '').trim().split(/\s+/);
  const firstName = /^(الشيخ|الشيخة|د\.?|الدكتور|الدكتورة|الأستاذ|الأستاذة|السيد|السيدة)$/.test(nameParts[0] || '') ? nameParts.slice(0, 2).join(' ') : nameParts[0] || '';
  const initial = (/^(الشيخ|الشيخة|د\.?|الدكتور|الدكتورة|الأستاذ|الأستاذة|السيد|السيدة)$/.test(nameParts[0] || '') ? nameParts[1] : nameParts[0])?.charAt(0) || 'م';

  return (
    <div className="gd" dir="rtl">
      <header className="gd-hero">
        <div className="gd-hero-id">
          {data?.guide?.photo ? <img src={data.guide.photo} alt="" className="gd-avatar" /> : <span className="gd-avatar is-initial">{initial}</span>}
          <div>
            <h1>مرحباً، {firstName}</h1>
            <p>{data?.guide?.title || 'مرشد الوكالة'} · لوحة المرافقة والإرشاد</p>
          </div>
        </div>
        {next ? (
          <div className="gd-next">
            <span>{next.state === 'ongoing' ? 'رحلتك جارية الآن' : 'رحلتك القادمة'}</span>
            <strong>{next.name}</strong>
            <em>{next.state === 'ongoing' ? `حتى ${dateLabel(next.endDate)}` : next.daysToStart === 0 ? 'الانطلاق اليوم' : `بعد ${next.daysToStart} يوماً · ${dateLabel(next.startDate)}`}</em>
          </div>
        ) : null}
      </header>

      <nav className="gd-tabs" role="tablist">
        {([['group', 'فوجي', Users], ['tools', 'أدوات الميدان', Compass], ['sakhr', 'تعليم صخر', GraduationCap]] as const).map(([id, label, Icon]) => (
          <button key={id} type="button" role="tab" aria-selected={view === id} className={view === id ? 'is-on' : ''} onClick={() => setView(id)}>
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
        <button type="button" className="gd-refresh" onClick={() => void load()} aria-label="تحديث"><RefreshCw className="w-4 h-4" /></button>
      </nav>

      {toast ? <p className={`gd-toast${toast.bad ? ' is-bad' : ''}`} role="status">{toast.text}</p> : null}

      {view === 'group' ? (
        !data && !error ? (
          <div className="gd-empty"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : error ? (
          <div className="gd-empty"><ShieldAlert className="w-7 h-7" /><p>{error}</p></div>
        ) : !data!.programs.length ? (
          <div className="gd-empty">
            <CalendarDays className="w-8 h-8" />
            <b>لا توجد برامج مسندة إليك بعد</b>
            <p>{data!.notice || 'عندما تُسند إليك الإدارة برنامجاً سيظهر هنا فوجك ومواعيده.'}</p>
          </div>
        ) : (
          <>
            {kpis ? (
              <section className="gd-kpis">
                <div><i><CalendarDays className="w-4 h-4" /></i><b>{kpis.programs}</b><small>برامجي الحالية</small></div>
                <div><i><Users className="w-4 h-4" /></i><b>{kpis.pilgrims}</b><small>معتمرون في الرحلة المختارة</small></div>
                <div><i><Plane className="w-4 h-4" /></i><b>{kpis.days === null ? '—' : kpis.days <= 0 ? 'الآن' : kpis.days}</b><small>{kpis.days !== null && kpis.days > 0 ? 'يوماً على الانطلاق' : 'الرحلة القادمة'}</small></div>
                <div className={kpis.missingPassports ? 'is-warn' : ''}><i><ShieldAlert className="w-4 h-4" /></i><b>{kpis.missingPassports}</b><small>جوازات غير مسجلة</small></div>
              </section>
            ) : null}

            <section className="gd-programs" aria-label="برامجي">
              {data!.programs.map((p) => (
                <button key={p.packageId} type="button" className={`gd-program${p.packageId === selected ? ' is-on' : ''} is-${p.state}`} onClick={() => setSelected(p.packageId)}>
                  <span className={`gd-state is-${p.state}`}>{STATE_LABEL[p.state]}</span>
                  <b>{p.name}</b>
                  <small>{dateLabel(p.startDate)} — {dateLabel(p.endDate, true)}</small>
                  <em><Users className="w-3.5 h-3.5" /> {p.pilgrims} معتمر</em>
                </button>
              ))}
            </section>

            {program ? (
              <>
                <section className="gd-info">
                  <div><CalendarDays className="w-4 h-4" /><span>{dateLabel(program.startDate)} — {dateLabel(program.endDate, true)}{program.durationDays ? ` · ${program.durationDays} يوماً` : ''}</span></div>
                  <div><Plane className="w-4 h-4" /><span>{[program.airline, program.departureCity].filter(Boolean).join(' · ') || '—'}</span></div>
                  <div><BedDouble className="w-4 h-4" /><span>{[program.makkahHotel, program.madinahHotel].filter(Boolean).join(' · ') || '—'}</span></div>
                </section>

                <section className="gd-stages" aria-label="مراحل التفقد">
                  <h2>تفقّد الفوج</h2>
                  <div className="gd-stage-list">
                    {GUIDE_STAGES.map((s) => {
                      const done = stageDone(s.id);
                      const total = program.bookings.length;
                      return (
                        <button key={s.id} type="button" className={`gd-stage${stage === s.id ? ' is-on' : ''}${total && done === total ? ' is-complete' : ''}`} onClick={() => setStage(s.id)}>
                          <span>{s.label}</span>
                          <b>{done}/{total}</b>
                          <i aria-hidden><i style={{ width: `${total ? Math.round((done / total) * 100) : 0}%` }} /></i>
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section className="gd-group">
                  <div className="gd-group-head">
                    <h2>الفوج <small>({program.bookings.length} حجز · {program.pilgrims} معتمر)</small></h2>
                    <label className="gd-search">
                      <Search className="w-4 h-4" />
                      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="بحث بالاسم أو الهاتف" />
                    </label>
                  </div>
                  {visible.length === 0 ? (
                    <p className="gd-muted">{program.bookings.length ? 'لا نتائج.' : 'لا حجوزات في هذا البرنامج بعد.'}</p>
                  ) : (
                    <ul className="gd-list">
                      {visible.map((b) => {
                        const done = Boolean(b.checkins[stage]);
                        return (
                          <li key={b.reservationId} className={done ? 'is-done' : ''}>
                            <div className="gd-person">
                              <span className="gd-person-initial">{b.name.charAt(0)}</span>
                              <div>
                                <b>{b.name}</b>
                                <small dir="ltr">{b.number}</small>
                                <span className="gd-tags">
                                  <em>{b.room}</em>
                                  <em className={b.confirmed ? 'is-ok' : 'is-wait'}>{b.confirmed ? 'مؤكد' : 'بانتظار التأكيد'}</em>
                                </span>
                              </div>
                            </div>
                            <ul className="gd-travelers">
                              {b.travelers.map((t, i) => (
                                <li key={`${t.name}-${i}`}>
                                  {t.name}
                                  <em className={t.passport ? 'is-ok' : 'is-warn'}>{t.passport ? 'الجواز مسجّل' : 'بلا جواز'}</em>
                                </li>
                              ))}
                            </ul>
                            <div className="gd-actions">
                              {b.phone ? (
                                <>
                                  <a href={`tel:${b.phone.replace(/\s+/g, '')}`} className="gd-icon" aria-label="اتصال" title="اتصال"><Phone className="w-4 h-4" /></a>
                                  <a href={waLink(b.phone)} target="_blank" rel="noreferrer" className="gd-icon is-wa" aria-label="واتساب" title="واتساب"><WhatsAppIcon /></a>
                                </>
                              ) : null}
                              <button type="button" className={`gd-check${done ? ' is-on' : ''}`} onClick={() => void toggleCheckin(b.reservationId, !done)} disabled={busy === b.reservationId} aria-pressed={done}>
                                {done ? <CheckCircle2 className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                                {done ? 'تم' : GUIDE_STAGES.find((s) => s.id === stage)?.label}
                              </button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>

                <section className="gd-message">
                  <h2><MessageSquareText className="w-4 h-4" /> رسالة إلى كل الفوج</h2>
                  <p>تصل إلى كل معتمر في هذا البرنامج في «المحادثة» داخل التطبيق.</p>
                  <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} maxLength={1000} placeholder="مثال: التجمع في بهو الفندق الساعة 4:30 فجراً للذهاب إلى الحرم، مع الإحرام." />
                  <div className="gd-message-actions">
                    {['التجمع في بهو الفندق بعد ساعة', 'الحافلة تنطلق بعد 30 دقيقة، كونوا جاهزين', 'تذكير: الالتزام بالمجموعة في الحرم'].map((q) => (
                      <button key={q} type="button" className="gd-chip" onClick={() => setMessage(q)}>{q}</button>
                    ))}
                    <button type="button" className="gd-send" onClick={() => void sendGroupMessage()} disabled={busy === 'message' || !message.trim() || !program.bookings.length}>
                      {busy === 'message' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} إرسال للفوج
                    </button>
                  </div>
                </section>
              </>
            ) : null}
          </>
        )
      ) : null}

      {view === 'tools' ? (
        <section className="gd-tools">
          <Link href="/guide#counter" className="gd-tool"><i><Compass className="w-5 h-5" /></i><b>عدّاد الطواف والسعي</b><small>عدّ الأشواط مع الأدعية أثناء مرافقة الفوج</small></Link>
          <Link href="/guide" className="gd-tool"><i><BookOpen className="w-5 h-5" /></i><b>دليل العمرة</b><small>المناسك خطوة بخطوة لمشاركته مع المعتمرين</small></Link>
          <Link href="/portal?tab=chat" className="gd-tool"><i><MessageSquareText className="w-5 h-5" /></i><b>المحادثة</b><small>رسائل المعتمرين والوكالة</small></Link>
          <Link href="/hotels" className="gd-tool"><i><MapPin className="w-5 h-5" /></i><b>الفنادق</b><small>عناوين الفنادق ومسافتها من الحرم</small></Link>
        </section>
      ) : null}

      {view === 'sakhr' ? (
        <AiKnowledgeManager
          userRole="murshid"
          userName={currentUser.name || 'المرشد الديني'}
          allowedCategories={['rituals', 'requirements', 'faq']}
          title="تعليم صخر (المناسك والإرشاد)"
          subtitle="أضف أحكام الإحرام وأوقات الطواف والتجمع وفتاوى المناسك الميدانية ليجيب بها صخر المعتمرين"
        />
      ) : null}
    </div>
  );
}
