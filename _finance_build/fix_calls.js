const fs = require('fs');
const p = 'D:/data/south_street/lib/sqlite.ts';
let s = fs.readFileSync(p, 'utf8');
if (!s.includes('initFinanceTables(db);')) {
  s = s.replace(
    'migrateReceiptsTable(db);\n  } catch (migErr) {',
    'migrateReceiptsTable(db);\n    initFinanceTables(db);\n  } catch (migErr) {'
  );
  console.log('added init call', s.includes('initFinanceTables(db);'));
} else console.log('init call exists');

if (!s.includes('seedFinanceDefaults(db)')) {
  const needle = '  seedPageContent(db);\n}';
  const idx = s.lastIndexOf(needle);
  if (idx >= 0) {
    s =
      s.slice(0, idx) +
      "  seedPageContent(db);\n  try {\n    seedFinanceDefaults(db);\n  } catch (err) {\n    console.warn('[Finance seed]:', err);\n  }\n}" +
      s.slice(idx + needle.length);
    console.log('added seed call');
  } else console.log('needle not found');
} else console.log('seed call exists');

fs.writeFileSync(p, s, 'utf8');
