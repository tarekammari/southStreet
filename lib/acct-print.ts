/** Body attribute modes for accountant @media print rules (accountant-theme.css). */
export type AcctPrintMode = 'treasury-full' | 'treasury-account' | 'treasury-recap';

export function triggerAcctPrint(mode: AcctPrintMode) {
  if (typeof document === 'undefined') return;
  document.body.dataset.acctPrint = mode;
  const cleanup = () => {
    delete document.body.dataset.acctPrint;
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  window.print();
}
