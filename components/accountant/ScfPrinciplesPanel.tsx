'use client';

import {
  SCF_DEBIT_CREDIT_EXAMPLES,
  SCF_DO_LIST,
  SCF_DONT_LIST,
  SCF_PRINCIPLES_ROWS,
} from '@/lib/scf-principles-content';
import { SCF_LEGAL_NOTICE_AR, SCF_SOURCE_URL } from '@/lib/accountant-scf';
import { Disclosure, PanelHeader } from './ui';

export default function ScfPrinciplesPanel() {
  return (
    <div className="space-y-4">
      <PanelHeader compact title="المبادئ المحاسبية" subtitle="SCF — مرجع للمحاسب" />
      <p className="text-xs acct-top-subtitle px-1">{SCF_LEGAL_NOTICE_AR}</p>
      <a
        href={SCF_SOURCE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs font-bold text-sky-700 underline px-1"
      >
        الجريدة الرسمية (PDF)
      </a>

      <Disclosure title="المبادئ الأساسية" defaultOpen>
        <table className="acct-kpi-detail-table w-full">
          <thead>
            <tr>
              <th>المبدأ</th>
              <th>المرجع</th>
              <th>الأثر في التطبيق</th>
            </tr>
          </thead>
          <tbody>
            {SCF_PRINCIPLES_ROWS.map((r) => (
              <tr key={r.title}>
                <td className="font-bold">{r.title}</td>
                <td className="text-xs whitespace-nowrap">{r.ref}</td>
                <td className="text-xs">{r.effect}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Disclosure>

      <div className="grid md:grid-cols-2 gap-3">
        <Disclosure title="✅ افعل" defaultOpen>
          <ul className="text-sm space-y-2 list-disc pr-5">
            {SCF_DO_LIST.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </Disclosure>
        <Disclosure title="❌ لا تفعل" defaultOpen>
          <ul className="text-sm space-y-2 list-disc pr-5">
            {SCF_DONT_LIST.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </Disclosure>
      </div>

      <Disclosure title="أمثلة مدين / دائن" defaultOpen={false}>
        <div className="space-y-4">
          {SCF_DEBIT_CREDIT_EXAMPLES.map((ex) => (
            <div key={ex.title} className="acct-supplier-eval">
              <div className="text-sm font-black mb-2">{ex.title}</div>
              <table className="acct-kpi-detail-table w-full">
                <thead>
                  <tr>
                    <th>الحساب</th>
                    <th className="acct-num">مدين</th>
                    <th className="acct-num">دائن</th>
                  </tr>
                </thead>
                <tbody>
                  {ex.rows.map((row, i) => (
                    <tr key={i}>
                      <td>{row.account}</td>
                      <td className="acct-num">{row.debit || '—'}</td>
                      <td className="acct-num">{row.credit || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </Disclosure>
    </div>
  );
}
