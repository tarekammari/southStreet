const Database = require('better-sqlite3');
const db = new Database('south_street.db', { readonly: true });
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('TABLES', tables.map(t => t.name).join(','));
function cols(t){ try { return db.prepare('PRAGMA table_info('+t+')').all().map(c=>c.name).join(','); } catch(e){ return e.message; } }
['users','user','accounts','credentials','settings','app_settings'].forEach(t=>{
  const c=cols(t); if(!c.includes('no such')) console.log('COLS '+t+': '+c);
});
try {
  const rows = db.prepare("SELECT * FROM users WHERE lower(role) LIKE '%account%' OR lower(email) LIKE '%account%' OR id LIKE '%004%' OR id LIKE '%1787416483857%'").all();
  console.log('ACCOUNTANT_ROWS', rows.length);
  rows.forEach(r => {
    const safe = {};
    for (const [k,v] of Object.entries(r)) {
      if (/pass|secret|token|hash|ssenc/i.test(k) || (typeof v==='string' && v.startsWith('SSENC'))) {
        safe[k] = typeof v==='string' ? (v.slice(0,12)+'...len'+v.length) : '[redacted]';
      } else safe[k]=v;
    }
    console.log(JSON.stringify(safe));
  });
} catch(e) { console.log('users query err', e.message); }
