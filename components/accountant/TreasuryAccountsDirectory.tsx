'use client';

import { TREASURY_KINDS } from '@/lib/finance-categories';
import { fmtCount, fmtMoney } from './money';
import type { TreasuryAccountRow } from './TreasuryAccountsTable';

const KIND_HINT: Record<string, string> = {
  CASH: 'صناديق نقدية',
  BANK: 'حسابات بنكية',
  CCP: 'حساب بريدي CCP',
  OTHER: 'خزائن أخرى',
};

export default function TreasuryAccountsDirectory({
  accounts,
  onOpenAccount,
}: {
  accounts: TreasuryAccountRow[];
  onOpenAccount?: (id: string) => void;
}) {
  const live = accounts.filter((a) => a.status === 'ACTIVE');

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {TREASURY_KINDS.map((kind) => {
        const rows = live
          .filter((a) => a.kind === kind.id)
          .sort((a, b) => a.name_ar.localeCompare(b.name_ar, 'ar'));
        const subtotal = rows.reduce((s, a) => s + (a.period_closing ?? a.balance), 0);
        const negative = subtotal < 0;
        return (
          <section
            key={kind.id}
            className="rounded-xl border overflow-hidden"
            style={{ borderColor: 'var(--acct-border)', background: 'var(--acct-card)' }}
          >
            <header
              className="flex items-center justify-between gap-3 px-3 py-2.5 border-b"
              style={{ borderColor: 'var(--acct-border)', background: 'var(--acct-muted-bg, rgba(0,0,0,0.02))' }}
            >
              <div className="min-w-0">
                <h4 className="text-sm font-black leading-tight">{kind.label}</h4>
                <p className="text-[10px] opacity-55 mt-0.5">{KIND_HINT[kind.id] || kind.label}</p>
              </div>
              <span
                className={`text-sm font-black tabular-nums shrink-0 ${negative ? 'text-rose-700' : 'text-violet-800'}`}
              >
                {fmtMoney(subtotal)}
              </span>
            </header>
            <ul className="divide-y divide-black/5">
              {rows.map((a) => {
                const bal = a.period_closing ?? a.balance;
                return (
                  <li key={a.id}>
                    <button
                      type="button"
                      className="w-full text-right px-3 py-2.5 hover:bg-black/[0.03] flex items-center justify-between gap-3 cursor-pointer transition-colors"
                      onClick={() => onOpenAccount?.(a.id)}
                    >
                      <span className="min-w-0 text-right">
                        <span className="font-bold text-sm truncate block">{a.name_ar}</span>
                        {(a.bank_name || a.account_no) && (
                          <span className="text-[10px] opacity-55 truncate block font-mono">
                            {[a.bank_name, a.account_no].filter(Boolean).join(' · ')}
                          </span>
                        )}
                      </span>
                      <span
                        className={`text-xs font-black tabular-nums shrink-0 ${bal < 0 ? 'text-rose-700' : 'text-slate-800'}`}
                      >
                        {fmtMoney(bal)}
                      </span>
                    </button>
                  </li>
                );
              })}
              {rows.length === 0 ? (
                <li className="text-xs opacity-45 px-3 py-4 text-center">— لا حساب مسجّل —</li>
              ) : null}
            </ul>
            <footer className="px-3 py-1.5 text-[10px] font-bold opacity-50 border-t border-black/5">
              {fmtCount(rows.length)} حساب
            </footer>
          </section>
        );
      })}
    </div>
  );
}
