const fs = require('fs');
const path = require('path');
const root = 'D:/data/south_street';
function w(rel, content) {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf8');
  console.log('W', rel, fs.statSync(full).size);
}

const sqlitePath = path.join(root, 'lib/sqlite.ts');
let sqlite = fs.readFileSync(sqlitePath, 'utf8');

if (!sqlite.includes('initFinanceTables')) {
  sqlite = sqlite.replace(
    '    migrateReceiptsTable(db);\n  } catch (migErr) {',
    `    migrateReceiptsTable(db);\n    initFinanceTables(db);\n  } catch (migErr) {`
  );

  const financeBlock = `
function initFinanceTables(db: Database.Database) {
  db.exec(\`
    CREATE TABLE IF NOT EXISTS finance_ledger (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      direction TEXT NOT NULL,
      amount REAL NOT NULL,
      description TEXT,
      entry_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'POSTED',
      receipt_id TEXT,
      counterparty TEXT,
      method TEXT,
      ref_table TEXT,
      ref_id TEXT,
      running_balance REAL DEFAULT 0,
      created_by TEXT,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS finance_suppliers (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE,
      name_ar TEXT NOT NULL,
      contact TEXT,
      payment_terms_days INTEGER DEFAULT 30,
      status TEXT DEFAULT 'ACTIVE',
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS finance_supplier_invoices (
      id TEXT PRIMARY KEY,
      supplier_id TEXT NOT NULL,
      invoice_no TEXT,
      invoice_date TEXT,
      due_date TEXT,
      amount REAL NOT NULL,
      paid_amount REAL DEFAULT 0,
      remaining REAL NOT NULL,
      status TEXT DEFAULT 'OPEN',
      note TEXT,
      created_at TEXT,
      FOREIGN KEY (supplier_id) REFERENCES finance_suppliers(id)
    );

    CREATE TABLE IF NOT EXISTS finance_supplier_payments (
      id TEXT PRIMARY KEY,
      supplier_id TEXT NOT NULL,
      invoice_id TEXT,
      amount REAL NOT NULL,
      method TEXT NOT NULL,
      payment_date TEXT,
      note TEXT,
      ledger_id TEXT,
      created_by TEXT,
      created_at TEXT,
      FOREIGN KEY (supplier_id) REFERENCES finance_suppliers(id)
    );

    CREATE TABLE IF NOT EXISTS finance_staff_salaries (
      id TEXT PRIMARY KEY,
      morshid_id TEXT,
      staff_name TEXT NOT NULL,
      period_year INTEGER NOT NULL,
      period_month INTEGER NOT NULL,
      amount REAL NOT NULL,
      status TEXT DEFAULT 'PENDING',
      paid_at TEXT,
      note TEXT,
      ledger_id TEXT,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS finance_service_costs (
      id TEXT PRIMARY KEY,
      name_ar TEXT NOT NULL,
      frequency TEXT NOT NULL,
      amount REAL NOT NULL,
      next_due_date TEXT,
      provider TEXT,
      status TEXT DEFAULT 'ACTIVE',
      note TEXT,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS finance_service_payments (
      id TEXT PRIMARY KEY,
      service_id TEXT NOT NULL,
      amount REAL NOT NULL,
      method TEXT NOT NULL,
      payment_date TEXT,
      note TEXT,
      ledger_id TEXT,
      created_by TEXT,
      created_at TEXT,
      FOREIGN KEY (service_id) REFERENCES finance_service_costs(id)
    );
  \`);
}

function seedFinanceDefaults(db: Database.Database) {
  const ledgerCount = (db.prepare('SELECT COUNT(*) as cnt FROM finance_ledger').get() as any).cnt;
  if (ledgerCount > 0) return;

  const now = new Date().toISOString();
  const d = (offsetDays: number) => {
    const x = new Date();
    x.setDate(x.getDate() + offsetDays);
    return x.toISOString().slice(0, 10);
  };

  const insertSupplier = db.prepare(\`
    INSERT INTO finance_suppliers (id, code, name_ar, contact, payment_terms_days, status, created_at)
    VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?)
  \`);
  const suppliers = [
    ['sup_demo_1', 'SUP-101', 'فندق منارات غزة — مكة', '+966 12 555 0101', 30],
    ['sup_demo_2', 'SUP-102', 'خطوط الجوية الجزائرية', '+213 21 500 200', 15],
    ['sup_demo_3', 'SUP-103', 'نقل الحافلات VIP الجزائر', '+213 550 44 33 22', 7],
    ['sup_demo_4', 'SUP-104', 'مكتب التأشيرات المعتمد', '+213 21 66 77 88', 10],
    ['sup_demo_5', 'SUP-105', 'تأمين السفر سوناطراك', '+213 23 11 22 33', 30],
  ];
  for (const s of suppliers) insertSupplier.run(...s, now);

  const insertInv = db.prepare(\`
    INSERT INTO finance_supplier_invoices (
      id, supplier_id, invoice_no, invoice_date, due_date, amount, paid_amount, remaining, status, note, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  \`);
  const invoices = [
    ['sinv_demo_1', 'sup_demo_1', 'INV-HTL-901', d(-40), d(-10), 850000, 300000, 550000, 'PARTIAL', 'إقامة مجموعة أوت'],
    ['sinv_demo_2', 'sup_demo_2', 'INV-AIR-441', d(-25), d(5), 1200000, 0, 1200000, 'OPEN', 'تذاكر ذهاب وإياب'],
    ['sinv_demo_3', 'sup_demo_3', 'INV-BUS-112', d(-12), d(2), 180000, 180000, 0, 'PAID', 'نقل المطار'],
    ['sinv_demo_4', 'sup_demo_4', 'INV-VIS-77', d(-8), d(22), 95000, 0, 95000, 'OPEN', 'تأشيرات نسك'],
    ['sinv_demo_5', 'sup_demo_5', 'INV-INS-55', d(-5), d(25), 64000, 20000, 44000, 'PARTIAL', 'تأمين المجموعة'],
  ];
  for (const i of invoices) insertInv.run(...i, now);

  const insertPay = db.prepare(\`
    INSERT INTO finance_supplier_payments (
      id, supplier_id, invoice_id, amount, method, payment_date, note, ledger_id, created_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 'seed', ?)
  \`);
  insertPay.run('spay_demo_1', 'sup_demo_1', 'sinv_demo_1', 300000, 'BANK_TRANSFER', d(-20), 'دفعة أولى فندق', now);
  insertPay.run('spay_demo_2', 'sup_demo_3', 'sinv_demo_3', 180000, 'CASH', d(-10), 'سداد كامل نقل', now);
  insertPay.run('spay_demo_3', 'sup_demo_5', 'sinv_demo_5', 20000, 'CCP', d(-3), 'عربون تأمين', now);
  insertPay.run('spay_demo_4', 'sup_demo_2', null, 150000, 'CHECK', d(-15), 'دفعة جزئية طيران بدون فاتورة', now);

  let morshidId: string | null = null;
  let morshidName = 'الشيخ د. عبد الرحمن النوي';
  try {
    const m = db.prepare('SELECT morshid_id, name FROM morshids LIMIT 1').get() as any;
    if (m) { morshidId = m.morshid_id; morshidName = m.name; }
  } catch { /* morshids optional */ }

  const insertSal = db.prepare(\`
    INSERT INTO finance_staff_salaries (
      id, morshid_id, staff_name, period_year, period_month, amount, status, paid_at, note, ledger_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)
  \`);
  const year = new Date().getFullYear();
  const month = new Date().getMonth() + 1;
  insertSal.run('sal_demo_1', morshidId, morshidName, year, month, 120000, 'PENDING', null, 'راتب مرشد', now);
  insertSal.run('sal_demo_2', null, 'الأستاذة سارة بن علي', year, month, 95000, 'PENDING', null, 'تأشيرات', now);
  insertSal.run('sal_demo_3', null, 'السيد توفيق بوجمعة', year, month, 110000, 'PAID', d(-2), 'عمليات', now);
  insertSal.run('sal_demo_4', null, 'الأستاذ ياسين الفاسي', year, month, 130000, 'PENDING', null, 'محاسبة', now);
  insertSal.run('sal_demo_5', null, 'السيد كريم يوسفي', year, month > 1 ? month - 1 : 12, 90000, 'PAID', d(-28), 'إقامة', now);

  const insertSvc = db.prepare(\`
    INSERT INTO finance_service_costs (
      id, name_ar, frequency, amount, next_due_date, provider, status, note, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)
  \`);
  insertSvc.run('svc_demo_1', 'إيجار المقر الرئيسي', 'MONTHLY', 85000, d(12), 'مالك العقار — أودان', 'إيجار شهري', now);
  insertSvc.run('svc_demo_2', 'اشتراك الإنترنت والألياف', 'MONTHLY', 12000, d(5), 'اتصالات الجزائر', 'أعمال', now);
  insertSvc.run('svc_demo_3', 'صيانة المكيفات', 'QUARTERLY', 35000, d(20), 'شركة التبريد', 'صيانة دورية', now);
  insertSvc.run('svc_demo_4', 'رخصة السياحة السنوية', 'YEARLY', 150000, d(60), 'وزارة السياحة', 'تجديد', now);
  insertSvc.run('svc_demo_5', 'حملة إعلانات فيسبوك', 'ONE_OFF', 45000, d(3), 'وكالة إعلان', 'موسم أوت', now);
  insertSvc.run('svc_demo_6', 'كهرباء وماء المقر', 'MONTHLY', 18000, d(-2), 'سونلغاز / SEAAL', 'مستحق', now);

  const insertSvcPay = db.prepare(\`
    INSERT INTO finance_service_payments (
      id, service_id, amount, method, payment_date, note, ledger_id, created_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, NULL, 'seed', ?)
  \`);
  insertSvcPay.run('svcp_demo_1', 'svc_demo_1', 85000, 'BANK_TRANSFER', d(-18), 'إيجار الشهر الماضي', now);
  insertSvcPay.run('svcp_demo_2', 'svc_demo_2', 12000, 'CCP', d(-8), 'إنترنت', now);
  insertSvcPay.run('svcp_demo_3', 'svc_demo_6', 18000, 'CASH', d(-25), 'فواتير مرافق', now);
  insertSvcPay.run('svcp_demo_4', 'svc_demo_5', 45000, 'OTHER', d(-4), 'إعلان', now);

  const insertLed = db.prepare(\`
    INSERT INTO finance_ledger (
      id, type, direction, amount, description, entry_date, status, receipt_id,
      counterparty, method, ref_table, ref_id, running_balance, created_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'POSTED', ?, ?, ?, ?, ?, 0, 'seed', ?)
  \`);
  const ledgerRows: any[] = [
    ['led_demo_1', 'CASH_IN', 'in', 215000, 'تحصيل سند قبض — باقة أوت', d(-30), null, 'معتمر', 'CCP', 'receipts', null],
    ['led_demo_2', 'CASH_IN', 'in', 295000, 'تحصيل سند قبض — باقة VIP', d(-22), null, 'معتمر', 'BANK_TRANSFER', 'receipts', null],
    ['led_demo_3', 'PURCHASE', 'out', 300000, 'دفعة مورد: فندق منارات غزة', d(-20), null, 'فندق منارات غزة — مكة', 'BANK_TRANSFER', 'finance_supplier_payments', 'spay_demo_1'],
    ['led_demo_4', 'PURCHASE', 'out', 180000, 'دفعة مورد: نقل الحافلات VIP', d(-10), null, 'نقل الحافلات VIP الجزائر', 'CASH', 'finance_supplier_payments', 'spay_demo_2'],
    ['led_demo_5', 'SERVICE_SPEND', 'out', 85000, 'خدمة: إيجار المقر الرئيسي', d(-18), null, 'مالك العقار — أودان', 'BANK_TRANSFER', 'finance_service_payments', 'svcp_demo_1'],
    ['led_demo_6', 'EXPENSE', 'out', 25000, 'مصاريف مكتبية وقرطاسية', d(-14), null, 'مكتبة النور', 'CASH', null, null],
    ['led_demo_7', 'CASH_OUT', 'out', 110000, 'راتب: السيد توفيق بوجمعة', d(-2), null, 'السيد توفيق بوجمعة', 'CASH', 'finance_staff_salaries', 'sal_demo_3'],
    ['led_demo_8', 'CASH_IN', 'in', 150000, 'عربون مجموعة جديدة', d(-6), null, 'معتمر', 'CCP', null, null],
  ];
  for (const r of ledgerRows) insertLed.run(...r, now);

  // running balances
  const rows = db.prepare(\`
    SELECT id, direction, amount FROM finance_ledger WHERE status='POSTED'
    ORDER BY entry_date ASC, created_at ASC, id ASC
  \`).all() as { id: string; direction: string; amount: number }[];
  let bal = 0;
  const upd = db.prepare('UPDATE finance_ledger SET running_balance = ? WHERE id = ?');
  for (const r of rows) {
    bal += r.direction === 'in' ? Math.abs(r.amount) : -Math.abs(r.amount);
    upd.run(bal, r.id);
  }
}
`;

  sqlite = sqlite.replace(
    'function migrateReceiptsTable(db: Database.Database) {',
    financeBlock + '\nfunction migrateReceiptsTable(db: Database.Database) {'
  );

  if (!sqlite.includes('seedFinanceDefaults(db)')) {
    sqlite = sqlite.replace(
      '  seedPageContent(db);\n}',
      '  seedPageContent(db);\n  try {\n    seedFinanceDefaults(db);\n  } catch (err) {\n    console.warn(\'[Finance seed]:\', err);\n  }\n}'
    );
  }

  fs.writeFileSync(sqlitePath, sqlite, 'utf8');
  console.log('patched sqlite.ts', fs.statSync(sqlitePath).size);
} else {
  console.log('sqlite already has finance');
}