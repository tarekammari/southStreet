'use client';

/**
 * Clients connecting with each other, the Facebook / WhatsApp way:
 * requests to accept, "people you may know", and adding someone by phone,
 * email or client code. Used by ConnectApp (contacts tab) and ChatView (menu).
 */
import { useEffect, useRef, useState } from 'react';
import { Check, Loader2, MoreVertical, Search, Sparkles, UserMinus, UserPlus, UserX, X } from 'lucide-react';
import { authHeaders, jsonAuthHeaders } from '@/lib/api-client';
import type { PeopleAction, PersonCard } from '@/lib/connect/people';

export type PeopleData = { requests: PersonCard[]; sent: PersonCard[]; blocked: PersonCard[]; suggestions: PersonCard[] };
export const EMPTY_PEOPLE: PeopleData = { requests: [], sent: [], blocked: [], suggestions: [] };

export async function peopleAction(id: string, action: PeopleAction): Promise<{ state?: string; error?: string }> {
  try {
    const res = await fetch('/api/connect/people', { method: 'POST', headers: jsonAuthHeaders(), body: JSON.stringify({ id, action }) });
    return await res.json();
  } catch {
    return { error: 'تعذّر الاتصال — حاول مرة أخرى' };
  }
}

const Avatar = ({ p, big }: { p: PersonCard; big?: boolean }) => (
  <span className={`cn-avatar${big ? ' is-big' : ''}`}>
    {p.photo ? <img src={p.photo} alt="" /> : p.name.charAt(0)}
    {p.online ? <i className="cn-dot" /> : null}
  </span>
);

/** One button that runs an action and shows a spinner meanwhile. */
function ActBtn({ className, label, icon, onRun }: { className: string; label: string; icon: React.ReactNode; onRun: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className={className}
      disabled={busy}
      aria-label={label}
      onClick={async () => {
        setBusy(true);
        await onRun();
        setBusy(false);
      }}
    >
      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
      <span>{label}</span>
    </button>
  );
}

/** Requests waiting for me — shown first, with one-tap accept. */
export function RequestList({ people, onAction }: { people: PersonCard[]; onAction: (id: string, a: PeopleAction) => Promise<void> }) {
  if (!people.length) return null;
  return (
    <>
      <h3 className="cn-group">طلبات التواصل <em className="cn-badge">{people.length}</em></h3>
      <ul>
        {people.map((p) => (
          <li key={p.id} className="cn-request">
            <div className="cn-row is-static">
              <Avatar p={p} />
              <span className="cn-row-main">
                <span className="cn-row-top"><b>{p.name}</b></span>
                <span className="cn-row-sub"><small>{p.reason || 'يريد التواصل معك'}</small></span>
                <span className="cn-req-actions">
                  <ActBtn className="cn-chip is-main" label="قبول" icon={<Check className="w-4 h-4" />} onRun={() => onAction(p.id, 'accept')} />
                  <ActBtn className="cn-chip" label="رفض" icon={<X className="w-4 h-4" />} onRun={() => onAction(p.id, 'decline')} />
                  <ActBtn className="cn-chip is-quiet" label="حظر" icon={<UserX className="w-4 h-4" />} onRun={() => onAction(p.id, 'block')} />
                </span>
              </span>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

/** "قد تعرفهم" — a horizontal row of cards, each with one "add" button. */
export function Suggestions({ people, onAction }: { people: PersonCard[]; onAction: (id: string, a: PeopleAction) => Promise<void> }) {
  const [sent, setSent] = useState<Record<string, boolean>>({});
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const list = people.filter((p) => !hidden[p.id]);
  if (!list.length) return null;
  return (
    <>
      <h3 className="cn-group"><Sparkles className="w-3.5 h-3.5" aria-hidden /> قد تعرفهم</h3>
      <div className="cn-suggest" role="list">
        {list.map((p) => (
          <div key={p.id} className="cn-suggest-card" role="listitem">
            <button type="button" className="cn-suggest-x" aria-label="إخفاء" onClick={() => setHidden((h) => ({ ...h, [p.id]: true }))}><X className="w-3.5 h-3.5" /></button>
            <Avatar p={p} big />
            <b>{p.name}</b>
            <small>{p.reason}</small>
            {sent[p.id] ? (
              <span className="cn-chip is-done"><Check className="w-4 h-4" /> تم الإرسال</span>
            ) : (
              <ActBtn
                className="cn-chip is-main"
                label="إضافة"
                icon={<UserPlus className="w-4 h-4" />}
                onRun={async () => {
                  await onAction(p.id, 'request');
                  setSent((s) => ({ ...s, [p.id]: true }));
                }}
              />
            )}
          </div>
        ))}
      </div>
    </>
  );
}

/** Requests I sent (cancel) and people I blocked (unblock) — small, at the bottom. */
export function SentAndBlocked({ sent, blocked, onAction }: { sent: PersonCard[]; blocked: PersonCard[]; onAction: (id: string, a: PeopleAction) => Promise<void> }) {
  if (!sent.length && !blocked.length) return null;
  return (
    <details className="cn-more">
      <summary>طلبات أرسلتها ({sent.length}){blocked.length ? ` · محظورون (${blocked.length})` : ''}</summary>
      <ul>
        {sent.map((p) => (
          <li key={p.id}>
            <div className="cn-row is-static">
              <Avatar p={p} />
              <span className="cn-row-main"><span className="cn-row-top"><b>{p.name}</b></span><span className="cn-row-sub"><small>بانتظار القبول</small></span></span>
            </div>
            <ActBtn className="cn-chip" label="إلغاء" icon={<X className="w-4 h-4" />} onRun={() => onAction(p.id, 'cancel')} />
          </li>
        ))}
        {blocked.map((p) => (
          <li key={p.id}>
            <div className="cn-row is-static">
              <Avatar p={p} />
              <span className="cn-row-main"><span className="cn-row-top"><b>{p.name}</b></span><span className="cn-row-sub"><small>محظور</small></span></span>
            </div>
            <ActBtn className="cn-chip" label="إلغاء الحظر" icon={<UserPlus className="w-4 h-4" />} onRun={() => onAction(p.id, 'unblock')} />
          </li>
        ))}
      </ul>
    </details>
  );
}

/** Find a client by exact phone, email or client code, then send a request. */
export function AddPersonSheet({ onClose, onAction, onOpenChat }: { onClose: () => void; onAction: (id: string, a: PeopleAction) => Promise<void>; onOpenChat: (id: string) => void }) {
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PersonCard | null | undefined>(undefined);
  const [state, setState] = useState('');
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim().length < 4) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/connect/people?q=${encodeURIComponent(q.trim())}`, { headers: authHeaders(), cache: 'no-store' });
      const data = await res.json();
      setResult(data.person || null);
      setState(data.person?.state || '');
    } catch {
      setResult(null);
    }
    setBusy(false);
  };

  const team = result && result.role !== 'PILGRIM_USER';

  return (
    <div className="cn-sheet" role="dialog" aria-modal="true" aria-label="إضافة شخص" onClick={onClose}>
      <div className="cn-sheet-card" onClick={(e) => e.stopPropagation()} dir="rtl">
        <header>
          <span className="cn-gate-icon is-small" aria-hidden><UserPlus className="w-5 h-5" /></span>
          <div>
            <h2>إضافة شخص</h2>
            <small>برقم الهاتف أو البريد الإلكتروني أو رمز العميل</small>
          </div>
          <button type="button" className="cn-icon" onClick={onClose} aria-label="إغلاق"><X className="w-5 h-5" /></button>
        </header>
        <form className="cn-find" onSubmit={search}>
          <Search className="w-4 h-4" aria-hidden />
          <input ref={input} value={q} onChange={(e) => { setQ(e.target.value); setResult(undefined); }} placeholder="0661 23 45 67" inputMode="email" autoComplete="off" dir="auto" />
          <button type="submit" className="cn-chip is-main" disabled={busy || q.trim().length < 4}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'بحث'}</button>
        </form>

        {result === null ? <p className="cn-sheet-note is-error">لا يوجد حساب بهذه المعلومات. تأكد من الرقم أو البريد.</p> : null}
        {result ? (
          <div className="cn-found">
            <Avatar p={result} big />
            <div>
              <b>{result.name}</b>
              <small>{team ? result.roleLabel : state === 'friend' ? 'في جهات اتصالك' : state === 'sent' ? 'تم إرسال الطلب' : state === 'received' ? 'أرسل لك طلباً' : 'عميل South Street'}</small>
            </div>
            {team || state === 'friend' ? (
              <button type="button" className="cn-chip is-main" onClick={() => { onOpenChat(result.id); onClose(); }}>مراسلة</button>
            ) : state === 'sent' ? (
              <span className="cn-chip is-done"><Check className="w-4 h-4" /> بانتظار القبول</span>
            ) : state === 'blocked' ? (
              <ActBtn className="cn-chip" label="إلغاء الحظر" icon={<UserPlus className="w-4 h-4" />} onRun={async () => { await onAction(result.id, 'unblock'); setState('none'); }} />
            ) : (
              <ActBtn
                className="cn-chip is-main"
                label={state === 'received' ? 'قبول' : 'إرسال طلب'}
                icon={<UserPlus className="w-4 h-4" />}
                onRun={async () => {
                  await onAction(result.id, 'request');
                  setState(state === 'received' ? 'friend' : 'sent');
                }}
              />
            )}
          </div>
        ) : null}
        <p className="cn-sheet-hint">يرى الشخص اسمك فقط ويقرر القبول. بعد القبول تظهران في «المفضّلون» عند بعضكما ويمكنكما المراسلة والاتصال.</p>
      </div>
    </div>
  );
}

/** ⋮ in a conversation with another client: remove from contacts or block. */
export function PersonMenu({ name, onAction }: { name: string; onAction: (a: PeopleAction) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState<PeopleAction | null>(null);
  return (
    <div className="cn-menu-wrap">
      <button type="button" className="cn-icon" onClick={() => { setOpen((o) => !o); setConfirm(null); }} aria-label="خيارات" aria-expanded={open}>
        <MoreVertical className="w-5 h-5" />
      </button>
      {open ? (
        <div className="cn-menu" role="menu">
          {confirm ? (
            <>
              <p>{confirm === 'block' ? `حظر ${name}؟ لن يستطيع مراسلتك أو الاتصال بك.` : `إزالة ${name} من جهاتك؟`}</p>
              <ActBtn className="cn-chip is-danger" label={confirm === 'block' ? 'حظر' : 'إزالة'} icon={<Check className="w-4 h-4" />} onRun={async () => { await onAction(confirm); setOpen(false); }} />
              <button type="button" className="cn-chip" onClick={() => setConfirm(null)}>تراجع</button>
            </>
          ) : (
            <>
              <button type="button" role="menuitem" onClick={() => setConfirm('remove')}><UserMinus className="w-4 h-4" /> إزالة من جهاتي</button>
              <button type="button" role="menuitem" className="is-danger" onClick={() => setConfirm('block')}><UserX className="w-4 h-4" /> حظر</button>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
