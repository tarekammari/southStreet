'use client';

import { SCF_LEGAL_NOTICE_AR, SCF_SOURCE_URL } from '@/lib/accountant-scf';

export default function ScfFootnote({ extra }: { extra?: string }) {
  return (
    <p className="acct-scf-footnote text-[0.6875rem] leading-relaxed text-[var(--md-on-surface-variant)] mt-3 px-1">
      {extra ? <span className="block mb-1">{extra}</span> : null}
      {SCF_LEGAL_NOTICE_AR}{' '}
      <a href={SCF_SOURCE_URL} target="_blank" rel="noopener noreferrer" className="acct-fin-link underline">
        JORADP 2009
      </a>
    </p>
  );
}
