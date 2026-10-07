'use client';

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { normalizeIsoRange } from '@/lib/finance-period';
import {
  aggregateReceiptContracts,
  billedByProgramFromContracts,
  buildReceiptContractContext,
  collectedByProgramFromContracts,
  normalizeClientName,
  receiptContractTotals,
  type AggregatedReceiptContract,
} from '@/lib/receipt-contracts';
import { User, Receipt } from '@/types';
import { fmtCount, fmtMoney } from './money';
import { TRIP_TYPES, classifyTripType, tripTypeLabel } from '@/lib/finance-categories';
import ClientPaymentModal, { type Collectible } from './ClientPaymentModal';
import AcctPrintButton from './AcctPrintButton';
import AdminConfirmDialog from '@/components/admin/AdminConfirmDialog';
import {
  Disclosure,
  FilterDrawer,
  Kpi,
  PanelHeader,
  PrimaryButton,
  SearchField,
} from './ui';
import EntityAvatar, { EntityNameCell } from './EntityAvatar';
import { resolveClientAvatarFromIndex } from '@/lib/entity-avatar-display';
import { jsonAuthHeaders } from '@/lib/api-client';

function paidInFull(r: Receipt) {
  return (r.remainingAmount || 0) <= 0 || String(r.status || '').includes('خالص');
}

function isVoidReceipt(r: { status?: string | null }) {
  const s = String(r.status || '').trim();
  if (!s) return false;
  return s.toUpperCase() === 'VOID' || /ملغ/.test(s);
}

const clean = (s?: string | null) => String(s || '').trim();
const programLabel = (name: string) => (name || '—').trim() || '—';

/** عمرة stays religious programmes; anything else named is a programmed agency trip. */
function incomeLaneOf(packageName?: string | null): 'umrah' | 'agency' {
  const name = String(packageName || '').trim();
  if (/عمرة|umrah|حج|hajj/i.test(name)) return 'umrah';
  if (name && classifyTripType(name) === 'umrah' && !/رحلة|سياحة|trip|tour/i.test(name)) return 'umrah';
  return name ? 'agency' : 'umrah';
}

type ClientDrawerTab = 'overview' | 'contracts' | 'payments';

type ClientProfile = {
  key: string;
  name: string;
  code: string;
  contracts: AggregatedReceiptContract[];
  billed: number;
  collected: number;
  outstanding: number;
  paymentCount: number;
  lastPaymentDate: string;
  programs: string[];
};

function clientProfileKey(code?: string | null, name?: string | null) {
  const c = String(code || '').trim();
  if (c) return `code:${c}`;
  const n = normalizeClientName(name);
  return `name:${n || 'unknown'}`;
}

const CLIENT_DRAWER_TABS: { id: ClientDrawerTab; label: string }[] = [
  { id: 'overview', label: 'نظرة عامة' },
  { id: 'contracts', label: 'العقود' },
  { id: 'payments', label: 'الدفعات' },
];

export default function ReceiptsPanel({ currentUser }: { currentUser: User }) {
  const searchParams = useSearchParams();
  const recapFrom = searchParams.get('from')?.slice(0, 10) || '';
  const recapTo = searchParams.get('to')?.slice(0, 10) || '';
  const recapPeriod = recapFrom && recapTo;
  const periodRange = recapPeriod ? normalizeIsoRange(recapFrom, recapTo) : null;

  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [bookings, setBookings] = useState<Collectible[]>([]);
  const [clientPayments, setClientPayments] = useState<
    Array<{
      receipt_id?: string;
      reservation_id?: string;
      customer_name?: string;
      customer_code?: string;
      status?: string;
    }>
  >([]);
  const [selected, setSelected] = useState<Receipt | null>(null);
  const [collect, setCollect] = useState<{ customer_name?: string; customer_code?: string } | null>(null);
  const [collectOpen, setCollectOpen] = useState(false);
  type KpiDrill = 'billed' | 'collected' | 'outstanding' | 'payments' | 'rate';
  const [kpiDrill, setKpiDrill] = useState<KpiDrill | null>(null);
  const [programDrill, setProgramDrill] = useState<{ source: 'billed' | 'collected'; program: string } | null>(
    null,
  );
  const [clientDrawerKey, setClientDrawerKey] = useState<string | null>(null);
  const [clientDrawerTab, setClientDrawerTab] = useState<ClientDrawerTab>('overview');
  const [hiddenClients, setHiddenClients] = useState<
    Array<{ key: string; name: string; code: string }>
  >([]);
  const [purgedClientKeys, setPurgedClientKeys] = useState<Set<string>>(new Set());
  const [showHiddenClients, setShowHiddenClients] = useState(false);
  const [payListFilter, setPayListFilter] = useState<'live' | 'void'>('live');
  const [incomeBusy, setIncomeBusy] = useState(false);
  const [confirmAct, setConfirmAct] = useState<
    null | {
      kind: 'void_receipt' | 'hide_client' | 'unhide_client' | 'purge_client';
      id: string;
      label: string;
      name?: string;
      code?: string;
    }
  >(null);

  const toggleDrill = (id: KpiDrill) => {
    setProgramDrill(null);
    setKpiDrill((d) => (d === id ? null : id));
  };
  const toggleProgramDrill = (source: 'billed' | 'collected', program: string) => {
    setProgramDrill((p) => (p?.source === source && p.program === program ? null : { source, program }));
  };

  const closeClientDrawer = useCallback(() => setClientDrawerKey(null), []);

  const openClientDrawer = useCallback((code: string | undefined, name: string) => {
    setClientDrawerKey(clientProfileKey(code, name));
    setClientDrawerTab('overview');
  }, []);

  const openClientFromContract = useCallback((c: AggregatedReceiptContract) => {
    openClientDrawer(c.pilgrimCode, clean(c.pilgrimName) || '—');
  }, [openClientDrawer]);

  const router = useRouter();
  const [trip, setTrip] = useState('');
  const [programme, setProgramme] = useState('');
  const [incomeLane, setIncomeLane] = useState<'all' | 'umrah' | 'agency'>('all');
  const [state, setState] = useState<'all' | 'settled' | 'partial'>('all');
  const [q, setQ] = useState('');
  const [avatarIndex, setAvatarIndex] = useState<Record<string, string>>({});

  const clientPhoto = useCallback(
    (code?: string | null, name?: string | null) => {
      const c = String(code || '').trim();
      const n = String(name || '').trim();
      if (c && avatarIndex[c]) return avatarIndex[c];
      if (c && avatarIndex[c.toUpperCase()]) return avatarIndex[c.toUpperCase()];
      if (n && avatarIndex[n]) return avatarIndex[n];
      return resolveClientAvatarFromIndex(avatarIndex, c, n);
    },
    [avatarIndex]
  );

  const fetchReceipts = useCallback(async () => {
    try {
      const [rec, cli] = await Promise.all([
        fetch('/api/receipts', { headers: jsonAuthHeaders() }),
        fetch('/api/finance/clients/payments?include_void=1', { headers: jsonAuthHeaders() }),
      ]);
      if (rec.ok) setReceipts(await rec.json());
      if (cli.ok) {
        const data = await cli.json();
        setBookings(data.reservations || []);
        setClientPayments(data.payments || []);
        setAvatarIndex(data.avatar_index || {});
        const hidden = Array.isArray(data.hidden_clients)
          ? data.hidden_clients.map((h: { key?: string; name?: string; code?: string }) => ({
              key: String(h.key || ''),
              name: String(h.name || ''),
              code: String(h.code || ''),
            })).filter((h: { key: string }) => h.key)
          : [];
        setHiddenClients(hidden);
        setPurgedClientKeys(
          new Set(
            (Array.isArray(data.purged_clients) ? data.purged_clients : [])
              .map((k: string) => String(k || ''))
              .filter(Boolean)
          )
        );
      }
    } catch {
      /* ignore */
    }
  }, []);

  const runIncomeAction = useCallback(async () => {
    if (!confirmAct || incomeBusy) return;
    const act = confirmAct;
    setIncomeBusy(true);
    try {
      let body: Record<string, unknown>;
      if (act.kind === 'void_receipt') {
        body = { action: 'void_receipt', receipt_id: act.id };
      } else if (act.kind === 'purge_client') {
        body = { action: 'purge_client', client_key: act.id, name: act.name, code: act.code };
      } else {
        body = {
          action: act.kind === 'hide_client' ? 'hide_client' : 'unhide_client',
          client_key: act.id,
          name: act.name,
          code: act.code,
        };
      }
      const res = await fetch('/api/finance/clients/payments', {
        method: 'POST',
        headers: jsonAuthHeaders(),
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'تعذّر تنفيذ العملية');

      if (act.kind === 'void_receipt') {
        setSelected(null);
        setReceipts((prev) =>
          prev.map((r) => (r.id === act.id ? { ...r, status: 'ملغاة' } : r))
        );
      }
      if (act.kind === 'hide_client') {
        setHiddenClients((prev) => {
          if (prev.some((h) => h.key === act.id)) return prev;
          return [...prev, { key: act.id, name: act.name || act.label, code: act.code || '' }];
        });
        closeClientDrawer();
      }
      if (act.kind === 'unhide_client') {
        setHiddenClients((prev) => prev.filter((h) => h.key !== act.id));
      }
      if (act.kind === 'purge_client') {
        setHiddenClients((prev) => prev.filter((h) => h.key !== act.id));
        setPurgedClientKeys((prev) => new Set([...prev, act.id]));
        closeClientDrawer();
      }
      setConfirmAct(null);
      await fetchReceipts();
    } catch (err: any) {
      window.alert(err?.message || 'تعذّر تنفيذ العملية');
    } finally {
      setIncomeBusy(false);
    }
  }, [confirmAct, incomeBusy, closeClientDrawer, fetchReceipts]);

  useEffect(() => {
    void fetchReceipts();
  }, [fetchReceipts]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (clientDrawerKey) return closeClientDrawer();
      setSelected(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [clientDrawerKey, closeClientDrawer]);

  /** Programmes actually present in the income rows drive the category filter. */
  const receiptsInScope = useMemo(() => {
    if (!periodRange) return receipts;
    return receipts.filter((r) => {
      const d = String(r.date || '').slice(0, 10);
      return d >= periodRange.from && d <= periodRange.to;
    });
  }, [receipts, periodRange]);

  const programmes = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of receiptsInScope) {
      const name = (r.packageName || '—').trim();
      map.set(name, (map.get(name) || 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [receiptsInScope]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return receiptsInScope
      .filter((r) => {
        if (isVoidReceipt(r)) return false;
        if (incomeLane !== 'all' && incomeLaneOf(r.packageName) !== incomeLane) return false;
        if (trip && classifyTripType(r.packageName) !== trip) return false;
        if (programme && (r.packageName || '—').trim() !== programme) return false;
        if (state === 'settled' && !paidInFull(r)) return false;
        if (state === 'partial' && paidInFull(r)) return false;
        if (!needle) return true;
        return (
          String(r.pilgrimName || '').toLowerCase().includes(needle) ||
          String(r.packageName || '').toLowerCase().includes(needle) ||
          String(r.id || '').toLowerCase().includes(needle)
        );
      })
      .sort((a, b) => (String(a.date || '') < String(b.date || '') ? 1 : -1));
  }, [receiptsInScope, trip, programme, state, q, incomeLane]);

  const liveClientPayments = useMemo(
    () => clientPayments.filter((p: any) => String(p.status || 'POSTED').toUpperCase() !== 'VOID'),
    [clientPayments]
  );

  const contractCtx = useMemo(
    () => buildReceiptContractContext(liveClientPayments, bookings),
    [liveClientPayments, bookings],
  );

  /** One contract = client + programme (or one reservation); multiple receipt rows = several payments. */
  const contracts = useMemo(() => aggregateReceiptContracts(rows, contractCtx), [rows, contractCtx]);

  const clientProfiles = useMemo(() => {
    const map = new Map<string, ClientProfile>();
    const ensure = (code: string | undefined, name: string) => {
      const key = clientProfileKey(code, name);
      if (purgedClientKeys.has(key)) return null;
      let p = map.get(key);
      if (!p) {
        p = {
          key,
          name: clean(name) || '—',
          code: String(code || '').trim(),
          contracts: [],
          billed: 0,
          collected: 0,
          outstanding: 0,
          paymentCount: 0,
          lastPaymentDate: '',
          programs: [],
        };
        map.set(key, p);
      }
      return p;
    };

    // Live contracts drive billed/collected — voiding a payment keeps the client row.
    for (const c of contracts) {
      const p = ensure(c.pilgrimCode, clean(c.pilgrimName) || '—');
      if (!p) continue;
      p.contracts.push(c);
      p.billed += c.contractTotal;
      p.collected += c.collected;
      p.outstanding += c.outstanding;
      p.paymentCount += c.payments.length;
      if (String(c.lastPaymentDate || '') > p.lastPaymentDate) p.lastPaymentDate = c.lastPaymentDate;
      if (!p.programs.includes(c.program)) p.programs.push(c.program);
      if (!p.code && c.pilgrimCode) p.code = c.pilgrimCode;
    }

    // Void-only clients (all payments cancelled) still appear in the directory.
    for (const r of receiptsInScope) {
      if (!isVoidReceipt(r)) continue;
      ensure(r.pilgrimCode || undefined, clean(r.pilgrimName) || '—');
    }

    // Bookings without receipts yet (e.g. accepted, awaiting deposit).
    for (const b of bookings) {
      const p = ensure(b.customer_code || undefined, clean(b.customer_name) || '—');
      if (!p) continue;
      if (b.package_name && !p.programs.includes(b.package_name)) p.programs.push(b.package_name);
      if (p.billed <= 0 && b.total > 0) {
        p.billed += b.total;
        p.outstanding += Math.max(0, b.remaining);
      }
    }

    return map;
  }, [contracts, receiptsInScope, bookings, purgedClientKeys]);

  const hiddenClientKeys = useMemo(() => new Set(hiddenClients.map((h) => h.key)), [hiddenClients]);

  const clientDirectory = useMemo(() => {
    if (showHiddenClients) {
      return hiddenClients
        .map((h) => {
          const live = clientProfiles.get(h.key);
          if (live) return live;
          return {
            key: h.key,
            name: h.name || '—',
            code: h.code || '',
            contracts: [],
            billed: 0,
            collected: 0,
            outstanding: 0,
            paymentCount: 0,
            lastPaymentDate: '',
            programs: [] as string[],
          } satisfies ClientProfile;
        })
        .sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    }
    return [...clientProfiles.values()]
      .filter((p) => !hiddenClientKeys.has(p.key) && !purgedClientKeys.has(p.key))
      .sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  }, [clientProfiles, hiddenClients, hiddenClientKeys, purgedClientKeys, showHiddenClients]);

  const activeClient = useMemo(() => {
    if (!clientDrawerKey) return null;
    return (
      clientProfiles.get(clientDrawerKey)
      || clientDirectory.find((p) => p.key === clientDrawerKey)
      || null
    );
  }, [clientDrawerKey, clientProfiles, clientDirectory]);
  const activeClientHidden = Boolean(clientDrawerKey && hiddenClientKeys.has(clientDrawerKey));

  const activeClientPayments = useMemo(() => {
    if (!activeClient) return [];
    const match = (r: Receipt) => {
      if (activeClient.code && String(r.pilgrimCode || '').trim() === activeClient.code) return true;
      return normalizeClientName(r.pilgrimName) === normalizeClientName(activeClient.name);
    };
    return receipts
      .filter(match)
      .filter((r) => (payListFilter === 'void' ? isVoidReceipt(r) : !isVoidReceipt(r)))
      .map((r) => ({
        ...r,
        program: programLabel(r.packageName),
      }))
      .sort((a, b) => (String(a.date || '') < String(b.date || '') ? 1 : -1));
  }, [activeClient, receipts, payListFilter]);

  const activeClientBookings = useMemo(() => {
    if (!activeClient) return [];
    return bookings.filter((b) => {
      if (activeClient.code && b.customer_code === activeClient.code) return true;
      return normalizeClientName(b.customer_name) === normalizeClientName(activeClient.name);
    });
  }, [activeClient, bookings]);

  const kpis = useMemo(() => {
    const t = receiptContractTotals(contracts);
    return {
      collected: t.collected,
      outstanding: t.outstanding,
      billed: t.billed,
      count: rows.length,
      settled: t.settled,
      rate: t.billed > 0 ? Math.round((t.collected / t.billed) * 1000) / 10 : 0,
    };
  }, [contracts, rows.length]);

  const contractsByProgram = useMemo(() => {
    const m = new Map<string, AggregatedReceiptContract[]>();
    for (const c of contracts) {
      const list = m.get(c.program) || [];
      list.push(c);
      m.set(c.program, list);
    }
    for (const list of m.values()) {
      list.sort(
        (a, b) =>
          b.contractTotal - a.contractTotal ||
          String(b.lastPaymentDate).localeCompare(String(a.lastPaymentDate)),
      );
    }
    return m;
  }, [contracts]);

  const billedByProgram = useMemo(() => billedByProgramFromContracts(contracts), [contracts]);
  const collectedByProgram = useMemo(() => collectedByProgramFromContracts(contracts), [contracts]);

  const programDrillContracts = useMemo(() => {
    if (!programDrill) return [];
    return contractsByProgram.get(programDrill.program) || [];
  }, [programDrill, contractsByProgram]);

  const programDrillTotal = useMemo(() => {
    if (!programDrill) return 0;
    if (programDrill.source === 'collected') {
      return programDrillContracts.reduce((acc, c) => acc + c.collected, 0);
    }
    return programDrillContracts.reduce((acc, c) => acc + c.contractTotal, 0);
  }, [programDrill, programDrillContracts]);

  const outstandingLines = useMemo(() => {
    return contracts
      .filter((c) => c.outstanding > 0)
      .map((c) => ({
        id: c.key,
        name: clean(c.pilgrimName) || '—',
        code: c.pilgrimCode,
        program: c.program,
        amount: c.outstanding,
        date: c.lastPaymentDate,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [contracts]);

  const paymentLines = useMemo(() => {
    return [...rows]
      .sort((a, b) => (String(a.date || '') < String(b.date || '') ? 1 : -1))
      .map((r) => ({
        id: r.id,
        date: r.date || '—',
        name: clean(r.pilgrimName) || '—',
        code: r.pilgrimCode,
        program: (r.packageName || '—').trim(),
        billed: r.totalAmount || 0,
        paid: r.paidAmount || 0,
        remaining: r.remainingAmount || 0,
      }));
  }, [rows]);

  const byTrip = useMemo(() => {
    return TRIP_TYPES.map((t) => ({
      id: t.id,
      label: t.label,
      count: receiptsInScope.filter((r) => classifyTripType(r.packageName) === t.id).length,
    })).filter((t) => t.count > 0);
  }, [receiptsInScope]);

  const openPayment = () => {
    setCollect(null);
    setCollectOpen(true);
  };

  const activeFilters = [
    trip ? tripTypeLabel(trip) : '',
    programme,
    state === 'settled' ? 'خالص' : state === 'partial' ? 'متبقٍ' : '',
    q.trim(),
  ].filter(Boolean);

  const clearFilters = () => {
    setTrip('');
    setProgramme('');
    setState('all');
    setQ('');
  };

  return (
    <div className="space-y-4">
      <PanelHeader
        compact
        title="المداخيل"
        action={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="inline-flex items-center px-4 py-2 rounded-xl acct-muted text-sm font-bold cursor-pointer"
              onClick={() => router.push('/book?onBehalf=1')}
            >
              عميل جديد
            </button>
            <PrimaryButton onClick={openPayment}>تحصيل</PrimaryButton>
          </div>
        }
      />

      {recapPeriod && periodRange ? (
        <p className="text-sm font-semibold acct-top-subtitle px-1 tabular-nums">
          {periodRange.from} → {periodRange.to}
        </p>
      ) : null}

      <div className="acct-seg" role="tablist" aria-label="نوع البرامج">
        {(
          [
            ['all', 'كل المداخيل'],
            ['umrah', 'برامج العمرة'],
            ['agency', 'رحلات الوكالة'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={incomeLane === id}
            className={incomeLane === id ? 'is-on' : ''}
            onClick={() => {
              setIncomeLane(id);
              setProgramme('');
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          className={`acct-chip ${!programme ? 'acct-chip-active' : ''}`}
          onClick={() => setProgramme('')}
        >
          كل البرامج
        </button>
        {programmes
          .filter(([name]) => incomeLane === 'all' || incomeLaneOf(name) === incomeLane)
          .map(([name, count]) => (
            <button
              key={name}
              type="button"
              className={`acct-chip ${programme === name ? 'acct-chip-active' : ''}`}
              onClick={() => setProgramme(programme === name ? '' : name)}
            >
              {name}
              <span className="opacity-80 tabular-nums">{count}</span>
            </button>
          ))}
      </div>

      <SearchField value={q} onChange={setQ} placeholder="بحث بالاسم أو البرنامج…" />

      <FilterDrawer
        activeCount={activeFilters.length}
        onClear={activeFilters.length ? clearFilters : undefined}
      >
        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" className={`acct-chip ${!trip ? 'acct-chip-active' : ''}`} onClick={() => setTrip('')}>
            كل الأنشطة
          </button>
          {byTrip.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`acct-chip ${trip === t.id ? 'acct-chip-active' : ''}`}
              onClick={() => setTrip(trip === t.id ? '' : t.id)}
            >
              {t.label}
              <span className="opacity-80 tabular-nums">{t.count}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" className={`acct-chip ${state === 'all' ? 'acct-chip-active' : ''}`} onClick={() => setState('all')}>
            الكل
          </button>
          <button type="button" className={`acct-chip ${state === 'settled' ? 'acct-chip-active' : ''}`} onClick={() => setState('settled')}>
            خالص
          </button>
          <button type="button" className={`acct-chip ${state === 'partial' ? 'acct-chip-active' : ''}`} onClick={() => setState('partial')}>
            متبقٍ
          </button>
        </div>
        <select
          className="acct-input text-sm max-w-md"
          value={programme}
          onChange={(e) => setProgramme(e.target.value)}
          aria-label="البرنامج"
        >
          <option value="">كل البرامج</option>
          {programmes.map(([name, count]) => (
            <option key={name} value={name}>
              {name} ({count})
            </option>
          ))}
        </select>
      </FilterDrawer>

      <Disclosure title="ملخص التحصيل" defaultOpen={false}>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
          <Kpi
            label="المفوتر"
            value={kpis.billed}
            tone="text-violet-700"
            delay={0}
            active={kpiDrill === 'billed'}
            onClick={() => toggleDrill('billed')}
          />
          <Kpi
            label="المحصّل"
            value={kpis.collected}
            tone="text-emerald-700"
            delay={0}
            active={kpiDrill === 'collected'}
            onClick={() => toggleDrill('collected')}
          />
          <Kpi
            label="المستحق"
            value={kpis.outstanding}
            tone="text-amber-700"
            delay={60}
            active={kpiDrill === 'outstanding'}
            onClick={() => toggleDrill('outstanding')}
          />
          <Kpi
            label="الدفعات"
            value={kpis.count}
            delay={120}
            active={kpiDrill === 'payments'}
            onClick={() => toggleDrill('payments')}
          />
          <Kpi
            label="التحصيل"
            value={`${kpis.rate}%`}
            tone="text-sky-700"
            delay={180}
            active={kpiDrill === 'rate'}
            onClick={() => toggleDrill('rate')}
          />
        </div>

        {kpiDrill === 'billed' ? (
          <div className="acct-kpi-detail acct-slide-down">
            <div className="acct-kpi-detail-head">تفصيل المفوتر — حسب البرنامج ({fmtMoney(kpis.billed)})</div>
            <table className="acct-kpi-detail-table">
              <thead>
                <tr>
                  <th>البرنامج</th>
                  <th className="acct-num">المبلغ</th>
                </tr>
              </thead>
              <tbody>
                {billedByProgram.map(([name, amount]) => {
                  const active =
                    programDrill?.source === 'billed' && programDrill.program === name;
                  return (
                    <tr
                      key={name}
                      className={`acct-kpi-detail-row-btn${active ? ' acct-kpi-detail-row-active' : ''}`}
                      onClick={() => toggleProgramDrill('billed', name)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          toggleProgramDrill('billed', name);
                        }
                      }}
                      tabIndex={0}
                      role="button"
                      aria-expanded={active}
                    >
                      <td>{name}</td>
                      <td className="acct-num font-bold text-violet-700">{fmtMoney(amount)}</td>
                    </tr>
                  );
                })}
                {billedByProgram.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="opacity-60">
                      لا إيصالات في الفترة
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
            {programDrill?.source === 'billed' ? (
              <div className="acct-kpi-detail-nested acct-slide-down">
                <div className="acct-kpi-detail-head">
                  عقود البرنامج — {programDrill.program} ({fmtMoney(programDrillTotal)})
                </div>
                <table className="acct-kpi-detail-table">
                  <thead>
                    <tr>
                      <th>آخر دفعة</th>
                      <th>العميل</th>
                      <th className="acct-num">المفوتر</th>
                      <th className="acct-num">المحصّل</th>
                      <th className="acct-num">المتبقي</th>
                      <th className="acct-num">الدفعات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {programDrillContracts.map((c) => {
                      const ck = clientProfileKey(c.pilgrimCode, c.pilgrimName);
                      const active = clientDrawerKey === ck;
                      return (
                        <tr
                          key={c.key}
                          className={`acct-kpi-detail-row-btn${active ? ' acct-kpi-detail-row-active' : ''}`}
                          onClick={() => openClientFromContract(c)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              openClientFromContract(c);
                            }
                          }}
                          tabIndex={0}
                          role="button"
                        >
                          <td className="whitespace-nowrap">{c.lastPaymentDate || '—'}</td>
                          <td>
                            <EntityNameCell
                              variant="client"
                              name={clean(c.pilgrimName) || '—'}
                              imageUrl={clientPhoto(c.pilgrimCode, c.pilgrimName)}
                            />
                          </td>
                          <td className="acct-num font-bold text-violet-700">{fmtMoney(c.contractTotal)}</td>
                          <td className="acct-num text-emerald-700">{fmtMoney(c.collected)}</td>
                          <td className="acct-num text-amber-700">{fmtMoney(c.outstanding)}</td>
                          <td className="acct-num text-xs">{fmtCount(c.payments.length)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        ) : null}

        {kpiDrill === 'collected' ? (
          <div className="acct-kpi-detail acct-slide-down">
            <div className="acct-kpi-detail-head">تفصيل المحصّل — حسب البرنامج ({fmtMoney(kpis.collected)})</div>
            <table className="acct-kpi-detail-table">
              <thead>
                <tr>
                  <th>البرنامج</th>
                  <th className="acct-num">المحصّل</th>
                </tr>
              </thead>
              <tbody>
                {collectedByProgram.map(([name, amount]) => {
                  const active =
                    programDrill?.source === 'collected' && programDrill.program === name;
                  return (
                    <tr
                      key={name}
                      className={`acct-kpi-detail-row-btn${active ? ' acct-kpi-detail-row-active' : ''}`}
                      onClick={() => toggleProgramDrill('collected', name)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          toggleProgramDrill('collected', name);
                        }
                      }}
                      tabIndex={0}
                      role="button"
                      aria-expanded={active}
                    >
                      <td>{name}</td>
                      <td className="acct-num font-bold text-emerald-700">{fmtMoney(amount)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {programDrill?.source === 'collected' ? (
              <div className="acct-kpi-detail-nested acct-slide-down">
                <div className="acct-kpi-detail-head">
                  تحصيل البرنامج — {programDrill.program} ({fmtMoney(programDrillTotal)})
                </div>
                <table className="acct-kpi-detail-table">
                  <thead>
                    <tr>
                      <th>آخر دفعة</th>
                      <th>العميل</th>
                      <th className="acct-num">المفوتر</th>
                      <th className="acct-num">المحصّل</th>
                      <th className="acct-num">المتبقي</th>
                      <th className="acct-num">الدفعات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {programDrillContracts.map((c) => {
                      const ck = clientProfileKey(c.pilgrimCode, c.pilgrimName);
                      const active = clientDrawerKey === ck;
                      return (
                        <tr
                          key={c.key}
                          className={`acct-kpi-detail-row-btn${active ? ' acct-kpi-detail-row-active' : ''}`}
                          onClick={() => openClientFromContract(c)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              openClientFromContract(c);
                            }
                          }}
                          tabIndex={0}
                          role="button"
                        >
                          <td className="whitespace-nowrap">{c.lastPaymentDate || '—'}</td>
                          <td>
                            <EntityNameCell
                              variant="client"
                              name={clean(c.pilgrimName) || '—'}
                              imageUrl={clientPhoto(c.pilgrimCode, c.pilgrimName)}
                            />
                          </td>
                          <td className="acct-num">{fmtMoney(c.contractTotal)}</td>
                          <td className="acct-num font-bold text-emerald-700">{fmtMoney(c.collected)}</td>
                          <td className="acct-num text-amber-700">{fmtMoney(c.outstanding)}</td>
                          <td className="acct-num text-xs">{fmtCount(c.payments.length)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        ) : null}

        {kpiDrill === 'outstanding' ? (
          <div className="acct-kpi-detail acct-slide-down">
            <div className="acct-kpi-detail-head">تفصيل المستحق — حسب العقد ({fmtMoney(kpis.outstanding)})</div>
            <table className="acct-kpi-detail-table">
              <thead>
                <tr>
                  <th>العميل / البرنامج</th>
                  <th>التاريخ</th>
                  <th className="acct-num">المتبقي</th>
                </tr>
              </thead>
              <tbody>
                {outstandingLines.map((line) => (
                  <tr
                    key={line.id}
                    className="acct-kpi-detail-row-btn"
                    role="button"
                    tabIndex={0}
                    onClick={() => openClientDrawer(line.code, line.name)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openClientDrawer(line.code, line.name);
                      }
                    }}
                  >
                    <td>
                      <EntityNameCell
                        variant="client"
                        name={line.name}
                        imageUrl={clientPhoto(line.code, line.name)}
                        meta={line.program}
                      />
                    </td>
                    <td className="whitespace-nowrap opacity-80">{line.date || '—'}</td>
                    <td className="acct-num font-bold text-amber-700">{fmtMoney(line.amount)}</td>
                  </tr>
                ))}
                {outstandingLines.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="opacity-60">
                      لا مبالغ مستحقة على الإيصالات المعروضة
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        ) : null}

        {kpiDrill === 'payments' ? (
          <div className="acct-kpi-detail acct-slide-down">
            <div className="acct-kpi-detail-head">
              تفصيل الدفعات — {fmtCount(kpis.count)} إيصال ({fmtCount(kpis.settled)} خالص)
            </div>
            <table className="acct-kpi-detail-table">
              <thead>
                <tr>
                  <th>التاريخ</th>
                  <th>العميل</th>
                  <th>البرنامج</th>
                  <th className="acct-num">مفوتر</th>
                  <th className="acct-num">محصّل</th>
                  <th className="acct-num">متبقٍ</th>
                </tr>
              </thead>
              <tbody>
                {paymentLines.map((line) => (
                  <tr
                    key={line.id}
                    className="acct-kpi-detail-row-btn"
                    role="button"
                    tabIndex={0}
                    onClick={() => openClientDrawer(line.code, line.name)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openClientDrawer(line.code, line.name);
                      }
                    }}
                  >
                    <td className="whitespace-nowrap">{line.date}</td>
                    <td>
                      <EntityNameCell
                        variant="client"
                        name={line.name}
                        imageUrl={clientPhoto(line.code, line.name)}
                      />
                    </td>
                    <td className="max-w-[8rem] truncate">{line.program}</td>
                    <td className="acct-num">{fmtMoney(line.billed)}</td>
                    <td className="acct-num text-emerald-700">{fmtMoney(line.paid)}</td>
                    <td className="acct-num text-amber-700">{fmtMoney(line.remaining)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {kpiDrill === 'rate' ? (
          <div className="acct-kpi-detail acct-slide-down">
            <div className="acct-kpi-detail-head">تفصيل نسبة التحصيل ({kpis.rate}%)</div>
            <table className="acct-kpi-detail-table">
              <tbody>
                <tr>
                  <td>إجمالي المفوتر</td>
                  <td className="acct-num font-bold">{fmtMoney(kpis.billed)}</td>
                </tr>
                <tr>
                  <td>المحصّل</td>
                  <td className="acct-num font-bold text-emerald-700">{fmtMoney(kpis.collected)}</td>
                </tr>
                <tr>
                  <td>المستحق (على الإيصالات)</td>
                  <td className="acct-num font-bold text-amber-700">{fmtMoney(kpis.outstanding)}</td>
                </tr>
                <tr>
                  <td>النسبة = المحصّل ÷ المفوتر</td>
                  <td className="acct-num font-bold text-sky-700">{kpis.rate}%</td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : null}
      </Disclosure>

      <Disclosure title={`دليل العملاء (${clientDirectory.length})`} defaultOpen>
        <div className="flex flex-wrap gap-1.5 mb-2">
          <button
            type="button"
            className={`acct-chip ${!showHiddenClients ? 'acct-chip-active' : ''}`}
            onClick={() => setShowHiddenClients(false)}
          >
            الظاهرة
          </button>
          <button
            type="button"
            className={`acct-chip ${showHiddenClients ? 'acct-chip-active' : ''}`}
            onClick={() => setShowHiddenClients(true)}
          >
            المخفية ({hiddenClients.length})
          </button>
        </div>
        <table className="acct-kpi-detail-table">
          <thead>
            <tr>
              <th>العميل</th>
              <th className="acct-num">مفوتر</th>
              <th className="acct-num">محصّل</th>
              <th className="acct-num">متبقٍ</th>
              {showHiddenClients ? <th className="acct-num">إجراء</th> : null}
            </tr>
          </thead>
          <tbody>
            {clientDirectory.map((p) => (
              <tr
                key={p.key}
                className={`acct-kpi-detail-row-btn${clientDrawerKey === p.key ? ' acct-kpi-detail-row-active' : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => {
                  setClientDrawerKey(p.key);
                  setClientDrawerTab('overview');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setClientDrawerKey(p.key);
                    setClientDrawerTab('overview');
                  }
                }}
              >
                <td>
                  <EntityNameCell
                    variant="client"
                    name={p.name}
                    imageUrl={clientPhoto(p.code, p.name)}
                    meta={p.programs.slice(0, 2).join(' · ')}
                  />
                </td>
                <td className="acct-num font-bold text-violet-700">{fmtMoney(p.billed)}</td>
                <td className="acct-num text-emerald-700">{fmtMoney(p.collected)}</td>
                <td className="acct-num text-amber-700">{fmtMoney(p.outstanding)}</td>
                {showHiddenClients ? (
                  <td className="acct-num" onClick={(e) => e.stopPropagation()}>
                    <div className="inline-flex flex-wrap gap-1 justify-end">
                      <button
                        type="button"
                        className="px-2 py-1 rounded-lg text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 cursor-pointer"
                        onClick={() =>
                          setConfirmAct({
                            kind: 'unhide_client',
                            id: p.key,
                            label: p.name,
                            name: p.name,
                            code: p.code,
                          })
                        }
                      >
                        إظهار
                      </button>
                      <button
                        type="button"
                        className="px-2 py-1 rounded-lg text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 cursor-pointer"
                        onClick={() =>
                          setConfirmAct({
                            kind: 'purge_client',
                            id: p.key,
                            label: p.name,
                            name: p.name,
                            code: p.code,
                          })
                        }
                      >
                        حذف نهائي
                      </button>
                    </div>
                  </td>
                ) : null}
              </tr>
            ))}
            {clientDirectory.length === 0 ? (
              <tr>
                <td colSpan={showHiddenClients ? 5 : 4} className="opacity-60 py-6 text-center">
                  {showHiddenClients ? 'لا عملاء مخفيين' : 'لا عملاء في الفترة'}
                </td>
              </tr>
            ) : null}
          </tbody>
          {!showHiddenClients && clientDirectory.length > 0 ? (
            <tfoot>
              <tr className="acct-kpi-detail-total">
                <td className="font-black">الإجمالي</td>
                <td className="acct-num font-black">{fmtMoney(kpis.billed)}</td>
                <td className="acct-num font-black text-emerald-700">{fmtMoney(kpis.collected)}</td>
                <td className="acct-num font-black text-amber-700">{fmtMoney(kpis.outstanding)}</td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </Disclosure>

      {clientDrawerKey && activeClient && (
        <div className="fixed inset-0 z-50 flex justify-start" dir="rtl">
          <button
            type="button"
            className="absolute inset-0 bg-black/40 acct-drawer-backdrop cursor-pointer border-0"
            aria-label="إغلاق"
            onClick={closeClientDrawer}
          />
          <aside
            className="relative z-10 h-full w-full max-w-2xl acct-card shadow-2xl flex flex-col acct-drawer-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="client-drawer-title"
          >
            <div className="p-4 border-b space-y-3" style={{ borderColor: 'var(--acct-border)' }}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex items-start gap-3">
                  <EntityAvatar
                    variant="client"
                    name={activeClient.name}
                    imageUrl={clientPhoto(activeClient.code, activeClient.name)}
                    size="lg"
                  />
                  <div className="min-w-0">
                    <h4 id="client-drawer-title" className="text-lg font-black truncate">
                      {activeClient.name}
                    </h4>
                    <div className="text-xs mt-1 flex flex-wrap items-center gap-2 opacity-70">
                      {activeClient.code ? (
                        <span className="font-mono">{activeClient.code}</span>
                      ) : null}
                      <span>{fmtCount(activeClient.contracts.length)} عقد</span>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="px-2.5 py-1.5 rounded-lg acct-muted text-sm font-bold cursor-pointer shrink-0"
                  onClick={closeClientDrawer}
                >
                  إغلاق
                </button>
              </div>

              <div className="acct-supplier-ledger-summary">
                <button
                  type="button"
                  className="acct-supplier-ledger-card"
                  onClick={() => setClientDrawerTab('contracts')}
                >
                  <span className="acct-supplier-ledger-label">المفوتر</span>
                  <span className="acct-supplier-ledger-value tabular-nums">{fmtMoney(activeClient.billed)}</span>
                </button>
                <button
                  type="button"
                  className="acct-supplier-ledger-card is-paid"
                  onClick={() => setClientDrawerTab('payments')}
                >
                  <span className="acct-supplier-ledger-label">المحصّل</span>
                  <span className="acct-supplier-ledger-value tabular-nums text-emerald-700">
                    {fmtMoney(activeClient.collected)}
                  </span>
                </button>
                <button
                  type="button"
                  className="acct-supplier-ledger-card is-balance"
                  onClick={() => setClientDrawerTab('contracts')}
                >
                  <span className="acct-supplier-ledger-label">المستحق</span>
                  <span className="acct-supplier-ledger-value tabular-nums text-amber-700">
                    {fmtMoney(activeClient.outstanding)}
                  </span>
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  className="flex-1 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold cursor-pointer"
                  onClick={() => {
                    setCollect({
                      customer_code: activeClient.code || undefined,
                      customer_name: activeClient.name,
                    });
                    setCollectOpen(true);
                  }}
                >
                  تحصيل
                </button>
                <button
                  type="button"
                  className="px-3 py-2 rounded-xl border text-sm font-bold cursor-pointer"
                  style={{ borderColor: 'var(--acct-border)' }}
                  onClick={() =>
                    setConfirmAct({
                      kind: activeClientHidden ? 'unhide_client' : 'hide_client',
                      id: activeClient.key,
                      label: activeClient.name,
                      name: activeClient.name,
                      code: activeClient.code,
                    })
                  }
                >
                  {activeClientHidden ? 'إظهار' : 'إخفاء'}
                </button>
                {activeClientHidden ? (
                  <button
                    type="button"
                    className="px-3 py-2 rounded-xl border text-sm font-bold cursor-pointer text-rose-700 border-rose-200 bg-rose-50"
                    onClick={() =>
                      setConfirmAct({
                        kind: 'purge_client',
                        id: activeClient.key,
                        label: activeClient.name,
                        name: activeClient.name,
                        code: activeClient.code,
                      })
                    }
                  >
                    حذف نهائي
                  </button>
                ) : null}
              </div>

              <div className="acct-seg" role="tablist">
                {CLIENT_DRAWER_TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={clientDrawerTab === t.id}
                    onClick={() => setClientDrawerTab(t.id)}
                    className={clientDrawerTab === t.id ? 'is-on' : ''}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {clientDrawerTab === 'overview' && (
                <div className="space-y-3 acct-fade-in">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                    <DrawerKpi label="آخر دفعة" value={activeClient.lastPaymentDate || '—'} />
                    <DrawerKpi label="عدد الدفعات" value={String(activeClient.paymentCount)} />
                    <DrawerKpi
                      label="نسبة التحصيل"
                      value={
                        activeClient.billed > 0
                          ? `${Math.round((activeClient.collected / activeClient.billed) * 1000) / 10}%`
                          : '—'
                      }
                    />
                  </div>
                  <div>
                    <div className="text-xs font-bold opacity-60 mb-1">البرامج</div>
                    <div className="flex flex-wrap gap-1.5">
                      {activeClient.programs.map((pr) => (
                        <span key={pr} className="acct-chip">
                          {pr}
                        </span>
                      ))}
                    </div>
                  </div>
                  {activeClientBookings.length > 0 ? (
                    <div>
                      <div className="text-xs font-bold opacity-60 mb-1">حجوزات مرتبطة</div>
                      <ul className="space-y-1 text-sm">
                        {activeClientBookings.map((b) => (
                          <li
                            key={b.reservation_id}
                            className="flex justify-between gap-2 py-1 border-b"
                            style={{ borderColor: 'var(--acct-border)' }}
                          >
                            <span className="min-w-0 truncate">{b.package_name}</span>
                            <span className="tabular-nums text-amber-700 shrink-0">
                              {fmtMoney(b.remaining)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              )}

              {clientDrawerTab === 'contracts' && (
                <table className="acct-kpi-detail-table acct-fade-in">
                  <thead>
                    <tr>
                      <th>البرنامج</th>
                      <th className="acct-num">مفوتر</th>
                      <th className="acct-num">محصّل</th>
                      <th className="acct-num">متبقٍ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeClient.contracts.map((c) => (
                      <tr key={c.key}>
                        <td>{c.program}</td>
                        <td className="acct-num">{fmtMoney(c.contractTotal)}</td>
                        <td className="acct-num text-emerald-700">{fmtMoney(c.collected)}</td>
                        <td className="acct-num text-amber-700">{fmtMoney(c.outstanding)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="acct-kpi-detail-total">
                      <td className="font-black">الإجمالي</td>
                      <td className="acct-num font-black">{fmtMoney(activeClient.billed)}</td>
                      <td className="acct-num font-black text-emerald-700">{fmtMoney(activeClient.collected)}</td>
                      <td className="acct-num font-black text-amber-700">{fmtMoney(activeClient.outstanding)}</td>
                    </tr>
                  </tfoot>
                </table>
              )}

              {clientDrawerTab === 'payments' && (
                <div className="space-y-2 acct-fade-in">
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      className={`acct-chip ${payListFilter === 'live' ? 'acct-chip-active' : ''}`}
                      onClick={() => setPayListFilter('live')}
                    >
                      الحية
                    </button>
                    <button
                      type="button"
                      className={`acct-chip ${payListFilter === 'void' ? 'acct-chip-active' : ''}`}
                      onClick={() => setPayListFilter('void')}
                    >
                      الملغاة
                    </button>
                  </div>
                  <ul className="space-y-1 text-sm">
                    {activeClientPayments.map((r) => {
                      const voided = isVoidReceipt(r);
                      return (
                        <li
                          key={r.id}
                          className={`flex items-center justify-between gap-2 py-2 border-b ${voided ? 'opacity-70' : ''}`}
                          style={{ borderColor: 'var(--acct-border)' }}
                        >
                          <button
                            type="button"
                            className="min-w-0 flex-1 text-right cursor-pointer bg-transparent border-0 p-0"
                            onClick={() => setSelected(r)}
                          >
                            <span className="font-bold block truncate">{r.program}</span>
                            <span className="text-[11px] opacity-60">
                              {r.date} · {voided ? 'ملغاة' : r.status || '—'}
                            </span>
                          </button>
                          <span className={`font-bold tabular-nums shrink-0 ${voided ? 'line-through text-slate-400' : 'text-emerald-700'}`}>
                            {fmtMoney(r.paidAmount || 0)}
                          </span>
                          {!voided ? (
                            <button
                              type="button"
                              className="shrink-0 px-2 py-1 rounded-lg text-[11px] font-bold text-rose-700 border border-rose-200 bg-rose-50 cursor-pointer"
                              onClick={() =>
                                setConfirmAct({
                                  kind: 'void_receipt',
                                  id: r.id,
                                  label: `${r.program} · ${fmtMoney(r.paidAmount || 0)}`,
                                })
                              }
                            >
                              إلغاء
                            </button>
                          ) : null}
                        </li>
                      );
                    })}
                    {activeClientPayments.length === 0 ? (
                      <li className="py-6 text-center opacity-60 text-xs">
                        {payListFilter === 'void' ? 'لا دفعات ملغاة' : 'لا دفعات'}
                      </li>
                    ) : null}
                  </ul>
                </div>
              )}
            </div>
          </aside>
        </div>
      )}

      {collectOpen && (
        <ClientPaymentModal
          preset={collect}
          onClose={() => {
            setCollectOpen(false);
            setCollect(null);
          }}
          onSaved={() => void fetchReceipts()}
        />
      )}

      {selected && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 acct-modal-backdrop"
          onClick={() => setSelected(null)}
        >
          <div className="w-full max-w-md acct-card rounded-2xl p-5 acct-modal" onClick={(e) => e.stopPropagation()}>
            <div className="text-center pb-4 border-b mb-4" style={{ borderColor: 'var(--acct-border)' }}>
              <EntityNameCell
                variant="client"
                name={selected.pilgrimName}
                imageUrl={clientPhoto(selected.pilgrimCode, selected.pilgrimName)}
                meta={selected.id}
              />
            </div>
            <div className="space-y-2 text-sm mb-4">
              <Line label="البرنامج" value={selected.packageName} />
              <Line label="التاريخ" value={selected.date} />
              <Line label="الدفع" value={selected.paymentMethod} />
            </div>
            <div className="acct-muted p-3.5 rounded-lg space-y-1.5 mb-4 text-sm">
              <div className="flex justify-between">
                <span>الإجمالي</span>
                <strong className="tabular-nums">{fmtMoney(selected.totalAmount)}</strong>
              </div>
              <div className="flex justify-between text-emerald-700">
                <span>المسدد</span>
                <strong className="tabular-nums">{fmtMoney(selected.paidAmount)}</strong>
              </div>
              <div className="flex justify-between text-amber-700">
                <span>المتبقي</span>
                <strong className="tabular-nums">{fmtMoney(selected.remainingAmount)}</strong>
              </div>
            </div>
            {isVoidReceipt(selected) ? (
              <p className="mb-3 text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-2.5 py-2">
                سند ملغى — خارج التحصيل والرصيد، ويبقى للأرشيف.
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <AcctPrintButton label="معاينة / طباعة" onClick={() => window.print()} />
              {!isVoidReceipt(selected) ? (
                <button
                  type="button"
                  onClick={() =>
                    setConfirmAct({
                      kind: 'void_receipt',
                      id: selected.id,
                      label: `${selected.packageName} · ${fmtMoney(selected.paidAmount || 0)}`,
                    })
                  }
                  className="px-4 py-2.5 rounded-lg text-sm font-bold text-rose-700 border border-rose-200 bg-rose-50 cursor-pointer"
                >
                  إلغاء السند
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="px-5 acct-muted font-bold py-2.5 rounded-lg text-sm cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      <AdminConfirmDialog
        open={Boolean(confirmAct)}
        danger={
          confirmAct?.kind === 'void_receipt'
          || confirmAct?.kind === 'hide_client'
          || confirmAct?.kind === 'purge_client'
        }
        busy={incomeBusy}
        title={
          confirmAct?.kind === 'void_receipt'
            ? 'إلغاء الدفعة / السند؟'
            : confirmAct?.kind === 'hide_client'
              ? 'إخفاء العميل من الدليل؟'
              : confirmAct?.kind === 'purge_client'
                ? 'حذف العميل نهائياً؟'
                : 'إظهار العميل في الدليل؟'
        }
        message={
          confirmAct?.kind === 'void_receipt'
            ? `تُسحب «${confirmAct.label}» من التحصيل والرصيد. العميل يبقى في الدليل، والدفعات الملغاة تُعرض من «الملغاة».`
            : confirmAct?.kind === 'hide_client'
              ? `يُخفى «${confirmAct?.label || ''}» من الدليل الظاهر. تجده لاحقاً في «المخفية» لإظهاره أو حذفه نهائياً.`
              : confirmAct?.kind === 'purge_client'
                ? `يُلغى كل سندات وتحصيلات «${confirmAct?.label || ''}» ويُحذف من الظاهرة والمخفية. لا يعود للدليل.`
                : `يُعاد «${confirmAct?.label || ''}» إلى دليل العملاء الظاهرة.`
        }
        confirmLabel={
          confirmAct?.kind === 'void_receipt'
            ? 'تأكيد الإلغاء'
            : confirmAct?.kind === 'hide_client'
              ? 'إخفاء'
              : confirmAct?.kind === 'purge_client'
                ? 'حذف نهائي'
                : 'إظهار'
        }
        onCancel={() => (incomeBusy ? undefined : setConfirmAct(null))}
        onConfirm={() => void runIncomeAction()}
      />
    </div>
  );
}

function DrawerKpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl px-3 py-2" style={{ background: 'var(--acct-input)' }}>
      <div className="text-[10px] font-bold opacity-60">{label}</div>
      <div className="text-sm font-black tabular-nums mt-0.5">{value}</div>
    </div>
  );
}

function Line({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-3 py-1 border-b" style={{ borderColor: 'var(--acct-border)' }}>
      <span className="opacity-70 shrink-0">{label}</span>
      <strong className="text-right min-w-0 truncate">{value || '—'}</strong>
    </div>
  );
}
