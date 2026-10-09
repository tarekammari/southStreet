'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, Loader2, RefreshCw, Search, UserPlus, Users, X } from 'lucide-react';
import { inTab, memberState, relativeTime, roleLabel, roleTone, TABS, type Member, type TabId, type Viewer } from './teamModel';
import { loadTeam } from './teamApi';
import { MemberAvatar, SecretSheet, StateBadge, type Secret } from './TeamBits';
import MemberDrawer from './MemberDrawer';
import AddMemberWizard from './AddMemberWizard';
import './team.css';

const REFRESH_MS = 30_000;

/**
 * Team & accounts: one place for everyone who signs in — staff (profile +
 * login) and clients (login only). Light, table-first, with a details drawer
 * and a guided "add member" flow. Used in /admin and from the Tables menu.
 */
export default function TeamWorkspace({
  initialTab = 'team',
  variant = 'page',
  onClose,
}: {
  initialTab?: TabId;
  variant?: 'page' | 'modal';
  onClose?: () => void;
}) {
  const [members, setMembers] = useState<Member[]>([]);
  const [viewer, setViewer] = useState<Viewer>({ role: 'AGENCY_MANAGER', assignableRoles: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [tab, setTab] = useState<TabId>(initialTab);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [secret, setSecret] = useState<Secret | null>(null);
  const [toast, setToast] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null);

  useEffect(() => setTab(initialTab), [initialTab]);

  const refresh = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    const r = await loadTeam();
    if (r.ok) {
      setMembers(r.data.members);
      setViewer(r.data.viewer);
      setLoadError('');
    } else if (!silent) {
      setLoadError(r.error);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(true), REFRESH_MS);
    return () => window.clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    if (variant !== 'modal') return;
    document.body.classList.add('modal-open');
    return () => document.body.classList.remove('modal-open');
  }, [variant]);

  const showToast = useCallback((text: string, tone: 'ok' | 'error' = 'ok') => {
    setToast({ text, tone });
    window.setTimeout(() => setToast((t) => (t?.text === text ? null : t)), 3200);
  }, []);

  const counts = useMemo(() => {
    const out = {} as Record<TabId, number>;
    for (const t of TABS) out[t.id] = members.filter((m) => inTab(m, t.id)).length;
    return out;
  }, [members]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members
      .filter((m) => inTab(m, tab))
      .filter((m) => {
        if (!q) return true;
        return [m.name, m.email, m.username, m.phone, roleLabel(m), m.staff?.title, m.staff?.specialization]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q));
      })
      .sort((a, b) => {
        // Pending first, then online, then by name.
        const rank = (m: Member) => (memberState(m) === 'pending' ? 0 : m.isOnline ? 1 : 2);
        return rank(a) - rank(b) || a.name.localeCompare(b.name, 'ar');
      });
  }, [members, tab, query]);

  const selected = members.find((m) => m.id === selectedId) || null;
  const team = members.filter((m) => m.role !== 'PILGRIM_USER');
  const canAdd = viewer.assignableRoles.length > 0;

  const summary = [
    { label: 'أعضاء الفريق', value: team.length, tone: 'emerald' },
    { label: 'نشطون', value: team.filter((m) => memberState(m) === 'active').length, tone: 'blue' },
    { label: 'بانتظار الموافقة', value: counts.pending || 0, tone: 'amber', tab: 'pending' as TabId },
    { label: 'متصل الآن', value: counts.online || 0, tone: 'violet', tab: 'online' as TabId },
  ];

  return (
    <div className={`tm-root is-${variant}`} dir="rtl">
      <div className="tm-shell">
        <header className="tm-header">
          <div className="tm-title">
            <span className="tm-title-icon"><Users className="w-5 h-5" /></span>
            <div>
              <h1>الفريق والحسابات</h1>
              <p>كل من يدخل إلى المنصة: الطاقم بملفاتهم، والمعتمرون بحساباتهم.</p>
            </div>
          </div>
          <div className="tm-header-actions">
            <button type="button" className="tm-icon-btn" onClick={() => refresh(true)} aria-label="تحديث" title="تحديث">
              <RefreshCw className={`w-4 h-4${refreshing ? ' animate-spin' : ''}`} />
            </button>
            {canAdd ? (
              <button type="button" className="tm-btn is-primary" onClick={() => setAdding(true)}>
                <UserPlus className="w-4 h-4" /> إضافة عضو
              </button>
            ) : null}
            {onClose ? (
              <button type="button" className="tm-icon-btn" onClick={onClose} aria-label="إغلاق"><X className="w-4 h-4" /></button>
            ) : null}
          </div>
        </header>

        <div className="tm-summary">
          {summary.map((s) => (
            <button
              key={s.label}
              type="button"
              className={`tm-stat is-${s.tone}${s.tab && tab === s.tab ? ' is-active' : ''}`}
              onClick={() => s.tab && setTab(s.tab)}
              disabled={!s.tab}
            >
              <strong>{s.value}</strong>
              <span>{s.label}</span>
            </button>
          ))}
        </div>

        <div className="tm-toolbar">
          <nav className="tm-tabs" role="tablist" aria-label="تصفية الأعضاء">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                className={tab === t.id ? 'is-active' : ''}
                onClick={() => setTab(t.id)}
              >
                {t.label}
                <span className="tm-tab-count">{counts[t.id] || 0}</span>
              </button>
            ))}
          </nav>
          <label className="tm-search">
            <Search className="w-4 h-4" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ابحث بالاسم، الهاتف، البريد…" aria-label="بحث" />
            {query ? <button type="button" onClick={() => setQuery('')} aria-label="مسح البحث"><X className="w-3.5 h-3.5" /></button> : null}
          </label>
        </div>

        <section className="tm-card">
          {loading ? (
            <div className="tm-placeholder"><Loader2 className="w-5 h-5 animate-spin" /> جاري تحميل الفريق…</div>
          ) : loadError ? (
            <div className="tm-placeholder is-error">{loadError}<button type="button" className="tm-btn is-small" onClick={() => refresh()}>إعادة المحاولة</button></div>
          ) : visible.length === 0 ? (
            <div className="tm-placeholder">
              <Users className="w-8 h-8" />
              <strong>{query ? 'لا توجد نتائج مطابقة' : 'لا يوجد أعضاء هنا بعد'}</strong>
              {!query && canAdd && tab !== 'pending' && tab !== 'suspended' && tab !== 'online' ? (
                <button type="button" className="tm-btn is-primary is-small" onClick={() => setAdding(true)}><UserPlus className="w-4 h-4" /> إضافة عضو</button>
              ) : null}
            </div>
          ) : (
            <table className="tm-table">
              <thead>
                <tr>
                  <th>العضو</th>
                  <th className="is-hide-sm">الدور</th>
                  <th>الحالة</th>
                  <th className="is-hide-sm">الهاتف</th>
                  <th className="is-hide-md">آخر نشاط</th>
                  <th aria-label="فتح" />
                </tr>
              </thead>
              <tbody>
                {visible.map((m) => (
                  <tr
                    key={m.id}
                    tabIndex={0}
                    className={selectedId === m.id ? 'is-selected' : ''}
                    onClick={() => setSelectedId(m.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedId(m.id);
                      }
                    }}
                  >
                    <td>
                      <div className="tm-person">
                        <MemberAvatar member={m} />
                        <div>
                          <strong>{m.name}{m.id === viewer.id ? <span className="tm-you">أنت</span> : null}</strong>
                          <span dir="ltr">{m.staff?.title ? <bdi dir="rtl">{m.staff.title}</bdi> : m.email && !m.email.endsWith('@southstreet.dz') ? m.email : m.username}</span>
                          <em className={`tm-role is-${roleTone(m.role)} tm-person-role`}>{roleLabel(m)}</em>
                        </div>
                      </div>
                    </td>
                    <td className="is-hide-sm"><span className={`tm-role is-${roleTone(m.role)}`}>{roleLabel(m)}</span></td>
                    <td><StateBadge member={m} /></td>
                    <td className="is-hide-sm" dir="ltr">{m.phone || <span className="tm-empty-value">—</span>}</td>
                    <td className="is-hide-md">{m.isOnline ? <span className="tm-online">متصل الآن</span> : <span className="tm-muted">{relativeTime(m.lastActive)}</span>}</td>
                    <td className="tm-chevron"><ChevronLeft className="w-4 h-4" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      {selected ? (
        <MemberDrawer
          member={selected}
          viewer={viewer}
          onClose={() => setSelectedId(null)}
          onChanged={() => refresh(true)}
          onSecret={setSecret}
          onToast={showToast}
        />
      ) : null}

      {adding ? (
        <AddMemberWizard
          viewer={viewer}
          presetType={tab === 'clients' ? 'pilgrim' : tab === 'finance' ? 'accountant' : tab === 'staff' ? 'staff' : undefined}
          onClose={() => setAdding(false)}
          onToast={showToast}
          onCreated={(s) => {
            setAdding(false);
            setSecret(s);
            void refresh(true);
          }}
        />
      ) : null}

      {secret ? <SecretSheet secret={secret} onClose={() => setSecret(null)} /> : null}

      {toast ? <div className={`tm-toast is-${toast.tone}`} role="status">{toast.text}</div> : null}
    </div>
  );
}
