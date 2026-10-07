import { financeRecap } from '@/lib/finance';
import { normalizeIsoRange } from '@/lib/finance-period';
import { SCF_ESTIMATED_DISCLAIMER_AR } from '@/lib/scf-principles-content';

/** Same حساب النتائج as الملخص — class 7 revenue only; 411 stays on the bilan. */
export function estimatedResultatByNature(fromInput?: string, toInput?: string) {
  const { from, to } = normalizeIsoRange(fromInput, toInput);
  const recap = financeRecap({ from, to });
  return {
    disclaimer: SCF_ESTIMATED_DISCLAIMER_AR,
    from,
    to,
    statement: recap.statement,
  };
}

export function estimatedFinancialPosition(fromInput?: string, toInput?: string) {
  const { from, to } = normalizeIsoRange(fromInput, toInput);
  const recap = financeRecap({ from, to });
  const sheet = recap.balance_sheet;

  return {
    disclaimer: SCF_ESTIMATED_DISCLAIMER_AR,
    from,
    to,
    balance_sheet: sheet,
    actif: sheet.actif.map((l) => ({ code: l.scf_code, label: l.label, amount: l.amount })),
    passif: sheet.passif
      .filter((l) => l.id !== 'equity')
      .map((l) => ({ code: l.scf_code, label: l.label, amount: l.amount })),
    equity_stub: sheet.passif.find((l) => l.id === 'equity')?.amount ?? 0,
    total_actif: sheet.total_actif,
    total_passif: sheet.total_passif,
    balanced: Math.abs(sheet.total_actif - sheet.total_passif) < 1,
    note_ar: 'نفس الميزانية المعروضة في الملخص لهذه الفترة — مع تنبيه تقديري أعلاه.',
  };
}

export function scfEstimatedReport(fromInput?: string, toInput?: string) {
  const { from, to } = normalizeIsoRange(fromInput, toInput);
  const recap = financeRecap({ from, to });
  const disclaimer = SCF_ESTIMATED_DISCLAIMER_AR;
  const sheet = recap.balance_sheet;

  return {
    resultat: {
      disclaimer,
      from,
      to,
      statement: recap.statement,
    },
    position: {
      disclaimer,
      from,
      to,
      balance_sheet: sheet,
      actif: sheet.actif.map((l) => ({ code: l.scf_code, label: l.label, amount: l.amount })),
      passif: sheet.passif
        .filter((l) => l.id !== 'equity')
        .map((l) => ({ code: l.scf_code, label: l.label, amount: l.amount })),
      equity_stub: sheet.passif.find((l) => l.id === 'equity')?.amount ?? 0,
      total_actif: sheet.total_actif,
      total_passif: sheet.total_passif,
      balanced: Math.abs(sheet.total_actif - sheet.total_passif) < 1,
      note_ar: 'نفس الميزانية المعروضة في الملخص لهذه الفترة — مع تنبيه تقديري أعلاه.',
    },
  };
}
