const fs = require('fs');
const path = require('path');
// load env without printing secrets
const envText = fs.readFileSync('.env','utf8');
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
  if (!m) continue;
  let v = m[2];
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1,-1);
  if (!(m[1] in process.env)) process.env[m[1]] = v;
}
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const db = new Database('south_street.db', { readonly: true });
const users = db.prepare("SELECT id, code, passwordHash, codeHash, username, email, loginEnabled, status, role FROM users WHERE role='accountant'").all();
const candidates = ['Admin@2026!','accountant','Accountant@2026!','ACC-404','SS-2283','password','SouthStreet@2026','demo','12345678','Accountant123','South@2026','acc12345','Accountant@123'];
for (const row of users) {
  console.log('USER', row.id, 'code=', row.code || '(empty)', 'loginEnabled=', row.loginEnabled, 'status=', row.status, 'hasPw=', !!row.passwordHash, 'hasCodeHash=', !!row.codeHash);
  for (const c of candidates) {
    try {
      if (row.passwordHash && bcrypt.compareSync(c, row.passwordHash)) console.log('MATCH_PASSWORD', row.id, c);
      if (row.codeHash && bcrypt.compareSync(c, row.codeHash)) console.log('MATCH_CODE', row.id, c);
    } catch (e) {}
  }
}
console.log('ONLINE_CARD_PAY_ENABLED=', process.env.ONLINE_CARD_PAY_ENABLED);
console.log('JWT_SECRET_SET=', Boolean(process.env.JWT_SECRET));
