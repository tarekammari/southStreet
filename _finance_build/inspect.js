const fs = require('fs');
const p = 'D:/data/south_street/lib/sqlite.ts';
let s = fs.readFileSync(p, 'utf8');
const i = s.indexOf('migrateReceiptsTable(db)');
console.log('idx', i);
console.log(JSON.stringify(s.slice(i, i+80)));
const j = s.lastIndexOf('seedPageContent(db)');
console.log('seed idx', j);
console.log(JSON.stringify(s.slice(j, j+40)));
