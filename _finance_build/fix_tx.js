const fs = require('fs');
const p = 'D:/data/south_street/lib/finance.ts';
let s = fs.readFileSync(p, 'utf8');

// Make recompute not use nested transaction wrapper issues - use savepoint-friendly loop without transaction()
s = s.replace(
  `  const upd = db.prepare('UPDATE finance_ledger SET running_balance = ? WHERE id = ?');\n  db.transaction(() => {\n    for (const r of rows) {\n      bal += signedAmount(r.direction, r.amount);\n      upd.run(bal, r.id);\n    }\n  })();\n  return bal;`,
  `  const upd = db.prepare('UPDATE finance_ledger SET running_balance = ? WHERE id = ?');\n  for (const r of rows) {\n    bal += signedAmount(r.direction, r.amount);\n    upd.run(bal, r.id);\n  }\n  return bal;`
);

// Remove outer transaction wrappers from payment helpers - do sequential ops then recompute once via createLedgerEntry
fs.writeFileSync(p, s, 'utf8');
console.log('fixed recompute');