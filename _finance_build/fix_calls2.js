const fs = require('fs');
const p = 'D:/data/south_street/lib/sqlite.ts';
let s = fs.readFileSync(p, 'utf8');
if (!s.includes('initFinanceTables(db);')) {
  s = s.replace(
    'migrateReceiptsTable(db);\r\n  } catch (migErr) {',
    'migrateReceiptsTable(db);\r\n    initFinanceTables(db);\r\n  } catch (migErr) {'
  );
  console.log('init', s.includes('initFinanceTables(db);'));
}
if (!s.includes('seedFinanceDefaults(db)')) {
  const needle = '  seedPageContent(db);\r\n}';
  const idx = s.lastIndexOf(needle);
  console.log('seed idx', idx);
  if (idx >= 0) {
    s =
      s.slice(0, idx) +
      "  seedPageContent(db);\r\n  try {\r\n    seedFinanceDefaults(db);\r\n  } catch (err) {\r\n    console.warn('[Finance seed]:', err);\r\n  }\r\n}" +
      s.slice(idx + needle.length);
    console.log('seed ok');
  }
}
fs.writeFileSync(p, s, 'utf8');
