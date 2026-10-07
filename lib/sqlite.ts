/**
 * SQLite connection bootstrap (better-sqlite3), schema init, and seeds.
 * Domain helpers live in `lib/db.ts` and call `getSqliteDb()` from here.
 */
import Database from 'better-sqlite3';
import { hashPassword } from './security';
import { wrapDatabaseWithEncryption, migratePlaintextToEncrypted } from './encrypted-sqlite';
import { initSecuritySchema } from './security-schema';
import { ensureDbFile, isServerlessHost, resolveDbPath } from './db-path';
import { bootstrapFiscalPeriodsForYear } from './finance-periods';
import { seedScfChartAccounts } from './scf-chart-seed';

let dbInstance: Database.Database | null = null;
let dbPathUsed: string | null = null;

export function getSqliteDb(): Database.Database {
  const DB_PATH = resolveDbPath();
  if (dbInstance && dbPathUsed === DB_PATH) {
    return dbInstance;
  }

  ensureDbFile(DB_PATH);

  const raw = new Database(DB_PATH);
  // WAL needs extra files; on serverless use a single journal file in /tmp
  raw.pragma(isServerlessHost() ? 'journal_mode = DELETE' : 'journal_mode = WAL');
  raw.pragma('foreign_keys = ON');

  dbInstance = wrapDatabaseWithEncryption(raw);
  dbPathUsed = DB_PATH;
  initTables(dbInstance);
  initSecuritySchema(dbInstance);
  try {
    seedDefaults(dbInstance);
  } catch (err) {
    console.warn('[Seed defaults]:', err);
  }
  try {
    seedPageContent(dbInstance);
  } catch (err) {
    console.warn('[Page content seed]:', err);
  }
  migratePlaintextToEncrypted(dbInstance);

  try {
    const accounts = require('./accounts') as typeof import('./accounts');
    accounts.backfillUserLookupHashes();
    accounts.backfillStaffAccounts();
    // The Super Admin is created once by `npm run admin:setup`, never re-seeded here.
  } catch (err) {
    console.warn('[Account backfill]:', err);
  }

  return dbInstance;
}

function initTables(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE,
      codeHash TEXT,
      name TEXT NOT NULL,
      email TEXT,
      emailHash TEXT,
      username TEXT,
      usernameHash TEXT,
      passwordHash TEXT NOT NULL,
      role TEXT NOT NULL,
      roleName TEXT NOT NULL,
      status TEXT DEFAULT 'نشط',
      phone TEXT,
      avatar TEXT,
      room TEXT,
      createdAt TEXT,
      lastLoginIp TEXT,
      pcFingerprint TEXT,
      requiresFileKey INTEGER DEFAULT 0,
      staffId TEXT,
      qrSecretHash TEXT,
      loginEnabled INTEGER DEFAULT 1,
      googleId TEXT
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      userName TEXT NOT NULL,
      userEmail TEXT NOT NULL,
      userRole TEXT NOT NULL,
      ip TEXT,
      pcPrint TEXT,
      userAgent TEXT,
      loginTime TEXT,
      lastActive TEXT,
      endedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS access_requests (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      userName TEXT NOT NULL,
      userEmail TEXT NOT NULL,
      userRole TEXT NOT NULL,
      ip TEXT,
      pcPrint TEXT,
      userAgent TEXT,
      requestTime TEXT,
      status TEXT DEFAULT 'PENDING_APPROVAL'
    );

    CREATE TABLE IF NOT EXISTS ai_knowledge (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      title_ar TEXT NOT NULL,
      keywords TEXT NOT NULL,
      response_ar TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      updatedBy TEXT,
      updatedAt TEXT,
      qualityRating TEXT,
      modelAnswer TEXT,
      answerMode TEXT DEFAULT 'official_exact',
      matchStrategy TEXT DEFAULT 'keywords_or_title'
    );

    CREATE TABLE IF NOT EXISTS agency_settings (
      id TEXT PRIMARY KEY DEFAULT 'main',
      agency_name TEXT NOT NULL,
      legal_name TEXT,
      logo TEXT,
      description TEXT,
      address TEXT,
      city TEXT,
      country TEXT,
      phone TEXT,
      whatsapp TEXT,
      email TEXT,
      website TEXT,
      opening_hours TEXT,
      emergency_phone TEXT,
      supported_languages TEXT,
      default_currency TEXT DEFAULT 'DZD',
      timezone TEXT DEFAULT 'Africa/Algiers',
      google_client_id TEXT,
      security_key TEXT
    );

    CREATE TABLE IF NOT EXISTS seasons (
      season_id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      islamic_year TEXT,
      gregorian_year TEXT,
      name TEXT NOT NULL,
      start_date TEXT,
      end_date TEXT,
      status TEXT DEFAULT 'UPCOMING',
      description TEXT,
      official_information TEXT,
      agency_information TEXT
    );

    CREATE TABLE IF NOT EXISTS hotels (
      hotel_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      city TEXT NOT NULL,
      category TEXT NOT NULL,
      address TEXT,
      latitude REAL,
      longitude REAL,
      distance_from_haram TEXT,
      description TEXT,
      services TEXT,
      images TEXT,
      videos TEXT,
      status TEXT DEFAULT 'ACTIVE'
    );

    CREATE TABLE IF NOT EXISTS flights (
      flight_id TEXT PRIMARY KEY,
      airline TEXT NOT NULL,
      flight_number TEXT NOT NULL,
      departure_airport TEXT NOT NULL,
      arrival_airport TEXT NOT NULL,
      departure_datetime TEXT,
      arrival_datetime TEXT,
      baggage TEXT,
      status TEXT DEFAULT 'CONFIRMED'
    );

    CREATE TABLE IF NOT EXISTS morshids (
      morshid_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      roleName TEXT,
      specialization TEXT,
      experience_years INTEGER,
      languages TEXT,
      phone TEXT,
      avatar TEXT,
      rating REAL DEFAULT 4.9,
      status TEXT DEFAULT 'متاح',
      category TEXT DEFAULT 'religious_guide',
      image TEXT
    );

    CREATE TABLE IF NOT EXISTS packages (
      package_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      season_id TEXT,
      season_name TEXT,
      description TEXT,
      start_date TEXT,
      end_date TEXT,
      duration_days INTEGER,
      departure_city TEXT,
      departure_airport TEXT,
      arrival_airport TEXT,
      airline TEXT,
      makkah_hotel_id TEXT,
      makkah_hotel_name TEXT,
      makkah_hotel_dist TEXT,
      madinah_hotel_id TEXT,
      madinah_hotel_name TEXT,
      madinah_hotel_dist TEXT,
      hotel_category TEXT,
      morshid_id TEXT,
      morshid_name TEXT,
      included_services TEXT,
      excluded_services TEXT,
      booking_conditions TEXT,
      cancellation_policy TEXT,
      capacity INTEGER DEFAULT 40,
      reserved INTEGER DEFAULT 0,
      available INTEGER DEFAULT 40,
      status TEXT DEFAULT 'PUBLISHED',
      published INTEGER DEFAULT 1,
      image_url TEXT
    );

    CREATE TABLE IF NOT EXISTS package_prices (
      price_id TEXT PRIMARY KEY,
      package_id TEXT NOT NULL,
      room_type TEXT NOT NULL,
      traveler_type TEXT DEFAULT 'ADULT',
      currency TEXT DEFAULT 'DZD',
      amount REAL NOT NULL,
      FOREIGN KEY (package_id) REFERENCES packages(package_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS reservations (
      reservation_id TEXT PRIMARY KEY,
      reservation_number TEXT UNIQUE NOT NULL,
      customer_id TEXT,
      customer_name TEXT NOT NULL,
      customer_email TEXT,
      customer_phone TEXT,
      package_id TEXT NOT NULL,
      package_name TEXT NOT NULL,
      room_type TEXT,
      travelers_count INTEGER DEFAULT 1,
      travelers TEXT,
      total_price REAL,
      paid_amount REAL DEFAULT 0,
      payment_status TEXT DEFAULT 'UNPAID',
      reservation_status TEXT DEFAULT 'CONFIRMED',
      created_at TEXT,
      updated_at TEXT,
      extras TEXT,
      invoice TEXT,
      appointments TEXT,
      program TEXT
    );

    CREATE TABLE IF NOT EXISTS receipts (
      id TEXT PRIMARY KEY,
      pilgrimName TEXT NOT NULL,
      pilgrimCode TEXT,
      packageName TEXT NOT NULL,
      totalAmount REAL NOT NULL,
      paidAmount REAL NOT NULL,
      remainingAmount REAL NOT NULL,
      paymentMethod TEXT,
      date TEXT,
      accountantName TEXT,
      status TEXT DEFAULT 'مكتمل'
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      chatId TEXT NOT NULL,
      senderId TEXT NOT NULL,
      senderName TEXT NOT NULL,
      senderAvatar TEXT,
      senderRole TEXT,
      text TEXT NOT NULL,
      time TEXT,
      isUrgent INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      actorName TEXT NOT NULL,
      actorRole TEXT NOT NULL,
      action TEXT NOT NULL,
      details TEXT,
      ip TEXT
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      target_name TEXT,
      reviewer_name TEXT NOT NULL,
      reviewer_user_id TEXT,
      stars INTEGER NOT NULL,
      title TEXT,
      body TEXT NOT NULL,
      status TEXT DEFAULT 'PENDING',
      featured INTEGER DEFAULT 0,
      admin_reply TEXT,
      admin_reply_at TEXT,
      created_at TEXT,
      published_at TEXT
    );

    CREATE TABLE IF NOT EXISTS page_content (
      key TEXT PRIMARY KEY,
      section TEXT NOT NULL,
      title_ar TEXT,
      title_fr TEXT,
      title_en TEXT,
      content_ar TEXT,
      content_fr TEXT,
      content_en TEXT,
      image_url TEXT,
      updated_at TEXT
    );
  `);

  // Auto-migrate schema for existing tables if columns are missing
  try {
    const ensureColumn = (tbl: string, col: string, def: string) => {
      try {
        const cols = (db.prepare(`PRAGMA table_info(${tbl})`).all() as any[]).map((c: any) => c.name);
        if (cols.length > 0 && !cols.includes(col)) {
          db.exec(`ALTER TABLE ${tbl} ADD COLUMN ${col} ${def};`);
        }
      } catch (err) {
        console.warn(`[SQLite Migration]: Error adding column ${col} to ${tbl}:`, err);
      }
    };

    // 1. messages migrations
    ensureColumn('messages', 'chatId', "TEXT DEFAULT 'general'");
    ensureColumn('messages', 'senderAvatar', 'TEXT');
    ensureColumn('messages', 'isUrgent', 'INTEGER DEFAULT 0');

    // 2. users migrations
    ensureColumn('users', 'code', 'TEXT');
    ensureColumn('users', 'roleName', "TEXT DEFAULT 'عضو'");
    ensureColumn('users', 'phone', 'TEXT');
    ensureColumn('users', 'avatar', 'TEXT');
    ensureColumn('users', 'room', 'TEXT');
    ensureColumn('users', 'createdAt', 'TEXT');
    ensureColumn('users', 'lastLoginIp', 'TEXT');
    ensureColumn('users', 'pcFingerprint', 'TEXT');
    ensureColumn('users', 'requiresFileKey', 'INTEGER DEFAULT 0');
    ensureColumn('users', 'email', 'TEXT');
    ensureColumn('users', 'codeHash', 'TEXT');
    ensureColumn('users', 'emailHash', 'TEXT');
    ensureColumn('users', 'username', 'TEXT');
    ensureColumn('users', 'usernameHash', 'TEXT');
    ensureColumn('users', 'passwordHash', 'TEXT');
    ensureColumn('users', 'staffId', 'TEXT');
    ensureColumn('users', 'qrSecretHash', 'TEXT');
    ensureColumn('users', 'loginEnabled', 'INTEGER DEFAULT 1');
    ensureColumn('users', 'googleId', 'TEXT');
    ensureColumn('agency_settings', 'google_client_id', 'TEXT');
    ensureColumn('agency_settings', 'security_key', 'TEXT');
    ensureColumn('agency_settings', 'security_key_issued_at', 'TEXT');
    ensureColumn('morshids', 'review_count', 'INTEGER DEFAULT 0');
    ensureColumn('audit_logs', 'actorName', 'TEXT');
    ensureColumn('audit_logs', 'actorRole', 'TEXT');
    ensureColumn('audit_logs', 'timestamp', 'TEXT');
    ensureColumn('audit_logs', 'action', 'TEXT');
    ensureColumn('audit_logs', 'details', 'TEXT');
    ensureColumn('audit_logs', 'ip', 'TEXT');

    try {
      const userCols = (db.prepare('PRAGMA table_info(users)').all() as { name: string }[]).map((c) => c.name);
      const has = (name: string) => userCols.includes(name);
      if (has('code_hash')) {
        if (has('codeHash')) {
          db.exec(`UPDATE users SET code_hash = codeHash WHERE (code_hash IS NULL OR code_hash = '') AND IFNULL(codeHash, '') != ''`);
        }
        if (has('code')) {
          db.exec(`UPDATE users SET code_hash = code WHERE (code_hash IS NULL OR code_hash = '') AND IFNULL(code, '') != ''`);
        }
        db.exec(`UPDATE users SET code_hash = id WHERE code_hash IS NULL OR code_hash = ''`);
      }
    } catch (legacyErr) {
      console.warn('[SQLite Legacy Users]:', legacyErr);
    }

    // Expand legacy users.role CHECK to include agent; repair agent→manager collapses.
    try {
      const tableSqlRow = db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='users'`).get() as { sql?: string } | undefined;
      const tableSql = tableSqlRow?.sql || '';
      const hasRoleCheck = /CHECK\s*\(\s*role\s+IN/i.test(tableSql);
      const checkAllowsAgent = /['"]agent['"]/i.test(tableSql) || /['"]AGENCY_AGENT['"]/i.test(tableSql);
      const checkAllowsLoginRoles = /['"]AGENCY_AGENT['"]/.test(tableSql) && /['"]SUPER_ADMIN['"]/.test(tableSql);
      // Rebuild when legacy portal CHECK lacks LOGIN_ROLES even if 'agent' is already present.
      if (hasRoleCheck && (!checkAllowsAgent || !checkAllowsLoginRoles)) {
        const colsInfo = db.prepare('PRAGMA table_info(users)').all() as {
          cid: number; name: string; type: string; notnull: number; dflt_value: unknown; pk: number;
        }[];
        const colDefs = colsInfo.map((c) => {
          if (c.name === 'role') {
            return `"role" ${c.type || 'TEXT'} NOT NULL CHECK(role IN (
              'admin','manager','agent','murshid','accountant','pilgrim',
              'SUPER_ADMIN','AGENCY_MANAGER','AGENCY_AGENT','ACCOUNTANT','GUIDE_MURSHID','PILGRIM_USER'
            ))`;
          }
          const parts = [`"${c.name}" ${c.type || 'TEXT'}`];
          if (c.pk) parts.push('PRIMARY KEY');
          if (c.notnull && !c.pk) parts.push('NOT NULL');
          if (c.dflt_value !== null && c.dflt_value !== undefined) parts.push(`DEFAULT ${c.dflt_value}`);
          return parts.join(' ');
        });
        const colNames = colsInfo.map((c) => `"${c.name}"`).join(', ');
        db.exec('PRAGMA foreign_keys = OFF');
        db.exec('BEGIN');
        try {
          db.exec(`CREATE TABLE users__rbac_mig (${colDefs.join(', ')})`);
          db.exec(`INSERT INTO users__rbac_mig (${colNames}) SELECT ${colNames} FROM users`);
          db.exec('DROP TABLE users');
          db.exec('ALTER TABLE users__rbac_mig RENAME TO users');
          db.exec('COMMIT');
          console.log('[SQLite RBAC]: users.role CHECK extended to include agent');
        } catch (migInner) {
          db.exec('ROLLBACK');
          throw migInner;
        } finally {
          db.exec('PRAGMA foreign_keys = ON');
        }
      }

      // Repair rows collapsed by old agent→manager mapping
      try {
        const names = new Set((db.prepare('PRAGMA table_info(users)').all() as { name: string }[]).map((c) => c.name));
        const roleNameCol = names.has('roleName') ? 'roleName' : names.has('role_name') ? 'role_name' : null;
        const emailCol = names.has('email') ? 'email' : null;
        const userCol = names.has('username') ? 'username' : null;
        const reqKeyCol = names.has('requiresFileKey') ? 'requiresFileKey' : names.has('requires_file_key') ? 'requires_file_key' : null;
        const identity: string[] = [];
        if (roleNameCol) {
          identity.push(`${roleNameCol} LIKE '%موظف%'`);
          identity.push(`${roleNameCol} LIKE '%خدمة العملاء%'`);
        }
        if (emailCol) identity.push(`lower(IFNULL(${emailCol},'')) LIKE '%agent%'`);
        if (userCol) identity.push(`lower(IFNULL(${userCol},'')) IN ('agent','ss.agent')`);
        identity.push(`id = 'usr_agent'`);
        identity.push(`id LIKE '%a563a2%'`);
        if (identity.length) {
          const updateSql = `UPDATE users SET role = 'agent'${reqKeyCol ? `, ${reqKeyCol} = 0` : ''} WHERE (` + identity.join(' OR ') + `) AND role IN ('manager','AGENCY_MANAGER')`;
          db.prepare(updateSql).run();
        }
      } catch (repairErr) {
        console.warn('[SQLite RBAC agent repair]:', repairErr);
      }
    } catch (rbacErr) {
      console.warn('[SQLite RBAC Migration]:', rbacErr);
    }

    try {
      db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_hash ON users(usernameHash) WHERE usernameHash IS NOT NULL AND usernameHash != ''");
      db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_hash ON users(emailHash) WHERE emailHash IS NOT NULL AND emailHash != ''");
      db.exec('CREATE INDEX IF NOT EXISTS idx_users_staff ON users(staffId)');
    } catch (idxErr) {
      console.warn('[SQLite Index Notice]:', idxErr);
    }

    // 3. ai_knowledge migrations
    ensureColumn('ai_knowledge', 'is_active', 'INTEGER DEFAULT 1');
    ensureColumn('ai_knowledge', 'updatedBy', 'TEXT');
    ensureColumn('ai_knowledge', 'updatedAt', 'TEXT');
    ensureColumn('ai_knowledge', 'qualityRating', 'REAL');
    ensureColumn('ai_knowledge', 'modelAnswer', 'TEXT');
    ensureColumn('ai_knowledge', 'answerMode', "TEXT DEFAULT 'official_exact'");
    ensureColumn('ai_knowledge', 'matchStrategy', "TEXT DEFAULT 'keywords_or_title'");

    // 4. sessions migrations
    ensureColumn('sessions', 'pcPrint', 'TEXT');
    ensureColumn('sessions', 'userAgent', 'TEXT');
    ensureColumn('sessions', 'endedAt', 'TEXT');

    // 5. access_requests migrations
    ensureColumn('access_requests', 'pcPrint', 'TEXT');
    ensureColumn('access_requests', 'userAgent', 'TEXT');
    ensureColumn('access_requests', 'status', "TEXT DEFAULT 'PENDING_APPROVAL'");

    ensureColumn('reservations', 'updated_at', 'TEXT');
    ensureColumn('reservations', 'extras', 'TEXT');
    ensureColumn('reservations', 'invoice', 'TEXT');
    ensureColumn('reservations', 'appointments', 'TEXT');
    ensureColumn('reservations', 'program', 'TEXT');
    ensureColumn('reservations', 'agency_confirmed_at', 'TEXT');
    ensureColumn('reservations', 'agency_confirmed_by', 'TEXT');
    ensureColumn('reservations', 'document_verify_code', 'TEXT');
    ensureColumn('reservations', 'agency_note', 'TEXT');

    // receipts: legacy server.js used encrypted_data/iv; Next app needs flat columns
    migrateReceiptsTable(db);
    initFinanceTables(db);
    initScfPhase1Tables(db);
    migrateFinanceCategories(db);
  } catch (migErr) {
    console.warn('[SQLite Migration Notice]:', migErr);
  }
}

function initScfPhase1Tables(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS finance_scf_accounts (
      code TEXT PRIMARY KEY,
      label_ar TEXT NOT NULL,
      label_fr TEXT,
      class INTEGER NOT NULL,
      parent_code TEXT,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS finance_fiscal_periods (
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      closed_by TEXT,
      closed_at TEXT,
      reopened_by TEXT,
      reopened_at TEXT,
      PRIMARY KEY (year, month)
    );

    CREATE TABLE IF NOT EXISTS finance_audit_log (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      user_name TEXT,
      role TEXT,
      action TEXT NOT NULL,
      entity TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      before_json TEXT,
      after_json TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_finance_audit_created ON finance_audit_log(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_finance_audit_entity ON finance_audit_log(entity, entity_id);
  `);
  try {
    seedScfChartAccounts(db);
    bootstrapFiscalPeriodsForYear(new Date().getFullYear());
  } catch (err) {
    console.warn('[SCF Phase 1 seed]:', err);
  }
}

function initFinanceTables(db: Database.Database) {
  db.exec(`
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
      category TEXT DEFAULT 'other',
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
      category TEXT DEFAULT 'other',
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
      kind TEXT DEFAULT 'salary',
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

    CREATE TABLE IF NOT EXISTS finance_client_payments (
      id TEXT PRIMARY KEY,
      reservation_id TEXT,
      customer_name TEXT NOT NULL,
      customer_code TEXT,
      package_name TEXT,
      amount REAL NOT NULL,
      source_type TEXT DEFAULT 'INCOME',
      method TEXT,
      account_id TEXT,
      entry_date TEXT,
      note TEXT,
      ledger_id TEXT,
      receipt_id TEXT,
      created_by TEXT,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS finance_treasury_accounts (
      id TEXT PRIMARY KEY,
      name_ar TEXT NOT NULL,
      kind TEXT DEFAULT 'CASH',
      bank_name TEXT,
      account_no TEXT,
      opening_balance REAL DEFAULT 0,
      currency TEXT DEFAULT 'DZD',
      status TEXT DEFAULT 'ACTIVE',
      note TEXT,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS finance_assets (
      id TEXT PRIMARY KEY,
      name_ar TEXT NOT NULL,
      category TEXT DEFAULT 'other',
      quantity INTEGER DEFAULT 1,
      unit_cost REAL NOT NULL,
      total_cost REAL NOT NULL,
      purchase_date TEXT,
      supplier TEXT,
      useful_life_years INTEGER DEFAULT 5,
      status TEXT DEFAULT 'ACTIVE',
      note TEXT,
      ledger_id TEXT,
      created_by TEXT,
      created_at TEXT
    );
  `);
}


function migrateFinanceCategories(db: Database.Database) {
  const ensureColumn = (tbl: string, col: string, def: string) => {
    try {
      const tableCols = (db.prepare(`PRAGMA table_info(${tbl})`).all() as { name: string }[]).map((c) => c.name);
      if (tableCols.length > 0 && !tableCols.includes(col)) {
        db.exec(`ALTER TABLE ${tbl} ADD COLUMN ${col} ${def};`);
      }
    } catch (err) {
      console.warn(`[SQLite Migration]: Error adding column ${col} to ${tbl}:`, err);
    }
  };
  ensureColumn('finance_suppliers', 'category', "TEXT DEFAULT 'other'");
  ensureColumn('finance_ledger', 'category', "TEXT DEFAULT 'other'");
  // Treasury: which cash box or bank account a movement went through.
  ensureColumn('finance_ledger', 'account_id', 'TEXT');
  /** treasury = cash movement; accrual = Dr/Cr without treasury balance (e.g. supplier invoice). */
  ensureColumn('finance_ledger', 'entry_kind', "TEXT DEFAULT 'treasury'");
  ensureColumn('finance_service_costs', 'supplier_id', 'TEXT');
  ensureColumn('finance_service_costs', 'scf_code', "TEXT DEFAULT '613'");
  ensureColumn('finance_suppliers', 'scf_code', 'TEXT');
  ensureColumn('finance_suppliers', 'image_url', 'TEXT');
  ensureColumn('finance_supplier_invoices', 'amount_ht', 'REAL');
  ensureColumn('finance_supplier_invoices', 'discount', 'REAL DEFAULT 0');
  ensureColumn('finance_supplier_invoices', 'tax_rate', 'REAL DEFAULT 0');
  ensureColumn('finance_supplier_invoices', 'tax_amount', 'REAL DEFAULT 0');
  ensureColumn('finance_supplier_invoices', 'detail_json', 'TEXT');
  ensureColumn('finance_supplier_payments', 'status', "TEXT DEFAULT 'POSTED'");
  ensureColumn('finance_client_payments', 'status', "TEXT DEFAULT 'POSTED'");
  ensureColumn('packages', 'annex_options', 'TEXT');
  ensureColumn('finance_staff_salaries', 'kind', "TEXT DEFAULT 'salary'");
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS finance_hidden_clients (
        client_key TEXT PRIMARY KEY,
        name TEXT,
        code TEXT,
        hidden_at TEXT,
        hidden_by TEXT,
        status TEXT DEFAULT 'hidden'
      );
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS finance_purged_clients (
        client_key TEXT PRIMARY KEY,
        name TEXT,
        code TEXT,
        purged_at TEXT,
        purged_by TEXT
      );
    `);
  } catch (err) {
    console.warn('[SQLite Migration]: finance_hidden_clients', err);
  }

  try {
    db.exec(`UPDATE finance_suppliers SET category = 'other' WHERE category IS NULL OR TRIM(category) = ''`);
    db.exec(`UPDATE finance_ledger SET category = 'other' WHERE category IS NULL OR TRIM(category) = ''`);

    const demos: [string, string][] = [
      ['sup_demo_1', 'hotels'],
      ['sup_demo_2', 'airlines'],
      ['sup_demo_3', 'transport'],
      ['sup_demo_4', 'visa'],
      ['sup_demo_5', 'insurance'],
    ];
    const upd = db.prepare(`UPDATE finance_suppliers SET category = ? WHERE id = ? AND (category IS NULL OR category = 'other')`);
    for (const [id, cat] of demos) upd.run(cat, id);

    db.exec(`UPDATE finance_ledger SET category = 'cash_in' WHERE type = 'CASH_IN' AND (category IS NULL OR category = 'other')`);
    db.exec(`UPDATE finance_ledger SET category = 'cash_out' WHERE type = 'CASH_OUT' AND (category IS NULL OR category = 'other')`);
    db.exec(`UPDATE finance_ledger SET category = 'supplier_purchase' WHERE type = 'PURCHASE' AND (category IS NULL OR category = 'other')`);
    db.exec(`UPDATE finance_ledger SET category = 'services' WHERE type = 'SERVICE_SPEND' AND (category IS NULL OR category = 'other')`);
    db.exec(`UPDATE finance_ledger SET category = 'ops' WHERE type = 'EXPENSE' AND (category IS NULL OR category = 'other')`);

    db.exec(`UPDATE finance_suppliers SET scf_code = '604' WHERE (scf_code IS NULL OR TRIM(scf_code) = '') AND category IN ('hotels','airlines','transport','visa','catering','ground')`);
    db.exec(`UPDATE finance_suppliers SET scf_code = '616' WHERE (scf_code IS NULL OR TRIM(scf_code) = '') AND category = 'insurance'`);
    db.exec(`UPDATE finance_suppliers SET scf_code = '626' WHERE (scf_code IS NULL OR TRIM(scf_code) = '') AND category = 'telecom_it'`);
    db.exec(`UPDATE finance_suppliers SET scf_code = '625' WHERE (scf_code IS NULL OR TRIM(scf_code) = '') AND (category IS NULL OR category = 'other')`);
    db.exec(`UPDATE finance_service_costs SET scf_code = '613' WHERE scf_code IS NULL OR TRIM(scf_code) = ''`);
    db.exec(`UPDATE finance_staff_salaries SET kind = 'salary' WHERE kind IS NULL OR TRIM(kind) = ''`);
    if (seedDemoData()) seedTreasuryAccountsIfEmpty(db);
    const manarat = db
      .prepare(`SELECT images FROM hotels WHERE hotel_id = 'htl_manarat_gaza'`)
      .get() as { images?: string } | undefined;
    if (manarat?.images) {
      try {
        const url = (JSON.parse(manarat.images) as string[])[0];
        if (url) {
          db.prepare(
            `UPDATE finance_suppliers SET image_url = ? WHERE id = 'sup_demo_1' AND (image_url IS NULL OR TRIM(image_url) = '')`
          ).run(url);
        }
      } catch {
        /* ignore */
      }
    }
  } catch (err) {
    console.warn('[Finance category backfill]:', err);
  }
}

function seedTreasuryAccountsIfEmpty(db: Database.Database) {
  const cnt = (db.prepare('SELECT COUNT(*) as cnt FROM finance_treasury_accounts').get() as { cnt: number }).cnt;
  if (cnt > 0) return;
  const now = new Date().toISOString();
  const insert = db.prepare(`
    INSERT INTO finance_treasury_accounts (
      id, name_ar, kind, bank_name, account_no, opening_balance, currency, status, note, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'DZD', 'ACTIVE', ?, ?)
  `);
  const rows: [string, string, string, string, string, number, string][] = [
    ['trz_cash_main', 'صندوق الوكالة — المقر', 'CASH', '', '', 500_000, 'نقد يومي — مقر الجزائر'],
    ['trz_bank_cpa', 'حساب بنك CPA — العمليات', 'BANK', 'CPA Banque', '0123456789012345', 1_200_000, 'تحويلات موردين ورواتب'],
    ['trz_ccp_collect', 'حساب بريدي CCP — التحصيل', 'CCP', 'Algérie Poste', '0012345678 89', 350_000, 'تحصيلات العملاء'],
    ['trz_cash_makkah', 'صندوق مكة — الموسم', 'CASH', '', '', 80_000, 'مصروف ميداني بالحرم'],
    ['trz_cash_oran', 'صندوق فرع وهران', 'CASH', '', '', 120_000, ''],
  ];
  for (const [id, name, kind, bank, accNo, open, note] of rows) {
    insert.run(id, name, kind, bank, accNo, open, note, now);
  }
}

function seedFinanceDefaults(db: Database.Database) {
  seedTreasuryAccountsIfEmpty(db);
  const ledgerCount = (db.prepare('SELECT COUNT(*) as cnt FROM finance_ledger').get() as any).cnt;
  if (ledgerCount > 0) return;

  const now = new Date().toISOString();
  const d = (offsetDays: number) => {
    const x = new Date();
    x.setDate(x.getDate() + offsetDays);
    return x.toISOString().slice(0, 10);
  };

  const insertSupplier = db.prepare(`
    INSERT INTO finance_suppliers (id, code, name_ar, contact, payment_terms_days, status, created_at)
    VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?)
  `);
  const suppliers = [
    ['sup_demo_1', 'SUP-101', 'فندق منارات غزة — مكة', '+966 12 555 0101', 30],
    ['sup_demo_2', 'SUP-102', 'خطوط الجوية الجزائرية', '+213 21 500 200', 15],
    ['sup_demo_3', 'SUP-103', 'نقل الحافلات VIP الجزائر', '+213 550 44 33 22', 7],
    ['sup_demo_4', 'SUP-104', 'مكتب التأشيرات المعتمد', '+213 21 66 77 88', 10],
    ['sup_demo_5', 'SUP-105', 'تأمين السفر سوناطراك', '+213 23 11 22 33', 30],
  ];
  for (const s of suppliers) insertSupplier.run(...s, now);

  const insertInv = db.prepare(`
    INSERT INTO finance_supplier_invoices (
      id, supplier_id, invoice_no, invoice_date, due_date, amount, paid_amount, remaining, status, note, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const invoices = [
    ['sinv_demo_1', 'sup_demo_1', 'INV-HTL-901', d(-40), d(-10), 850000, 300000, 550000, 'PARTIAL', 'إقامة مجموعة أوت'],
    ['sinv_demo_2', 'sup_demo_2', 'INV-AIR-441', d(-25), d(5), 1200000, 0, 1200000, 'OPEN', 'تذاكر ذهاب وإياب'],
    ['sinv_demo_3', 'sup_demo_3', 'INV-BUS-112', d(-12), d(2), 180000, 180000, 0, 'PAID', 'نقل المطار'],
    ['sinv_demo_4', 'sup_demo_4', 'INV-VIS-77', d(-8), d(22), 95000, 0, 95000, 'OPEN', 'تأشيرات نسك'],
    ['sinv_demo_5', 'sup_demo_5', 'INV-INS-55', d(-5), d(25), 64000, 20000, 44000, 'PARTIAL', 'تأمين المجموعة'],
  ];
  for (const i of invoices) insertInv.run(...i, now);

  const insertPay = db.prepare(`
    INSERT INTO finance_supplier_payments (
      id, supplier_id, invoice_id, amount, method, payment_date, note, ledger_id, created_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 'seed', ?)
  `);
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

  const insertSal = db.prepare(`
    INSERT INTO finance_staff_salaries (
      id, morshid_id, staff_name, period_year, period_month, amount, status, paid_at, note, ledger_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)
  `);
  const year = new Date().getFullYear();
  const month = new Date().getMonth() + 1;
  insertSal.run('sal_demo_1', morshidId, morshidName, year, month, 120000, 'PENDING', null, 'راتب مرشد', now);
  insertSal.run('sal_demo_2', null, 'الأستاذة سارة بن علي', year, month, 95000, 'PENDING', null, 'تأشيرات', now);
  insertSal.run('sal_demo_3', null, 'السيد توفيق بوجمعة', year, month, 110000, 'PAID', d(-2), 'عمليات', now);
  insertSal.run('sal_demo_4', null, 'الأستاذ ياسين الفاسي', year, month, 130000, 'PENDING', null, 'محاسبة', now);
  insertSal.run('sal_demo_5', null, 'السيد كريم يوسفي', year, month > 1 ? month - 1 : 12, 90000, 'PAID', d(-28), 'إقامة', now);

  const insertSvc = db.prepare(`
    INSERT INTO finance_service_costs (
      id, name_ar, frequency, amount, next_due_date, provider, status, note, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)
  `);
  insertSvc.run('svc_demo_1', 'إيجار المقر الرئيسي', 'MONTHLY', 85000, d(12), 'مالك العقار — أودان', 'إيجار شهري', now);
  insertSvc.run('svc_demo_2', 'اشتراك الإنترنت والألياف', 'MONTHLY', 12000, d(5), 'اتصالات الجزائر', 'أعمال', now);
  insertSvc.run('svc_demo_3', 'صيانة المكيفات', 'QUARTERLY', 35000, d(20), 'شركة التبريد', 'صيانة دورية', now);
  insertSvc.run('svc_demo_4', 'رخصة السياحة السنوية', 'YEARLY', 150000, d(60), 'وزارة السياحة', 'تجديد', now);
  insertSvc.run('svc_demo_5', 'حملة إعلانات فيسبوك', 'ONE_OFF', 45000, d(3), 'وكالة إعلان', 'موسم أوت', now);
  insertSvc.run('svc_demo_6', 'كهرباء وماء المقر', 'MONTHLY', 18000, d(-2), 'سونلغاز / SEAAL', 'مستحق', now);

  const insertSvcPay = db.prepare(`
    INSERT INTO finance_service_payments (
      id, service_id, amount, method, payment_date, note, ledger_id, created_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, NULL, 'seed', ?)
  `);
  insertSvcPay.run('svcp_demo_1', 'svc_demo_1', 85000, 'BANK_TRANSFER', d(-18), 'إيجار الشهر الماضي', now);
  insertSvcPay.run('svcp_demo_2', 'svc_demo_2', 12000, 'CCP', d(-8), 'إنترنت', now);
  insertSvcPay.run('svcp_demo_3', 'svc_demo_6', 18000, 'CASH', d(-25), 'فواتير مرافق', now);
  insertSvcPay.run('svcp_demo_4', 'svc_demo_5', 45000, 'OTHER', d(-4), 'إعلان', now);

  const insertLed = db.prepare(`
    INSERT INTO finance_ledger (
      id, type, direction, amount, description, entry_date, status, receipt_id,
      counterparty, method, ref_table, ref_id, running_balance, created_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'POSTED', ?, ?, ?, ?, ?, 0, 'seed', ?)
  `);
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
  const rows = db.prepare(`
    SELECT id, direction, amount FROM finance_ledger WHERE status='POSTED'
    ORDER BY entry_date ASC, created_at ASC, id ASC
  `).all() as { id: string; direction: string; amount: number }[];
  let bal = 0;
  const upd = db.prepare('UPDATE finance_ledger SET running_balance = ? WHERE id = ?');
  for (const r of rows) {
    bal += r.direction === 'in' ? Math.abs(r.amount) : -Math.abs(r.amount);
    upd.run(bal, r.id);
  }
}

function migrateReceiptsTable(db: Database.Database) {
  const ensureColumn = (tbl: string, col: string, def: string) => {
    try {
      const tableCols = (db.prepare(`PRAGMA table_info(${tbl})`).all() as { name: string }[]).map((c) => c.name);
      if (tableCols.length > 0 && !tableCols.includes(col)) {
        db.exec(`ALTER TABLE ${tbl} ADD COLUMN ${col} ${def};`);
      }
    } catch (err) {
      console.warn(`[SQLite Migration]: Error adding column ${col} to ${tbl}:`, err);
    }
  };

  const cols = (db.prepare('PRAGMA table_info(receipts)').all() as { name: string }[]).map((c) => c.name);
  if (!cols.length) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS receipts (
        id TEXT PRIMARY KEY,
        pilgrimName TEXT NOT NULL,
        pilgrimCode TEXT,
        packageName TEXT NOT NULL,
        totalAmount REAL NOT NULL,
        paidAmount REAL NOT NULL,
        remainingAmount REAL NOT NULL,
        paymentMethod TEXT,
        date TEXT,
        accountantName TEXT,
        status TEXT DEFAULT 'مكتمل'
      );
    `);
    return;
  }

  const hasFlat = cols.includes('pilgrimName') && cols.includes('packageName');
  const isLegacyEnc = cols.includes('encrypted_data') && !hasFlat;

  if (isLegacyEnc) {
    db.exec(`ALTER TABLE receipts RENAME TO receipts_legacy_enc`);
    db.exec(`
      CREATE TABLE receipts (
        id TEXT PRIMARY KEY,
        pilgrimName TEXT NOT NULL,
        pilgrimCode TEXT,
        packageName TEXT NOT NULL,
        totalAmount REAL NOT NULL,
        paidAmount REAL NOT NULL,
        remainingAmount REAL NOT NULL,
        paymentMethod TEXT,
        date TEXT,
        accountantName TEXT,
        status TEXT DEFAULT 'مكتمل'
      );
    `);
    return;
  }

  ensureColumn('receipts', 'pilgrimName', 'TEXT');
  ensureColumn('receipts', 'pilgrimCode', 'TEXT');
  ensureColumn('receipts', 'packageName', 'TEXT');
  ensureColumn('receipts', 'totalAmount', 'REAL');
  ensureColumn('receipts', 'paidAmount', 'REAL');
  ensureColumn('receipts', 'remainingAmount', 'REAL');
  ensureColumn('receipts', 'paymentMethod', 'TEXT');
  ensureColumn('receipts', 'date', 'TEXT');
  ensureColumn('receipts', 'accountantName', 'TEXT');
  ensureColumn('receipts', 'status', "TEXT DEFAULT 'مكتمل'");
}

/**
 * Demo content (sample users with known passwords, staff, reviews, seasons,
 * programs, fake accounting balances) is only seeded when SEED_DEMO_DATA=1.
 * System setup (agency settings, page texts, chart of accounts, Sakhr's
 * knowledge base, firewall defaults) always initializes.
 */
const seedDemoData = () => process.env.SEED_DEMO_DATA === '1';

function seedDefaults(db: Database.Database) {
  const insertUser = db.prepare(`
    INSERT OR IGNORE INTO users (
      id, code, name, email, username, passwordHash, role, roleName, status, phone, avatar, room, createdAt, requiresFileKey, loginEnabled
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);

  const missing = (id: string) => !db.prepare('SELECT id FROM users WHERE id = ?').get(id);

  const defaultUsers = [
    () => missing('usr_guide') && ['usr_guide', 'GUIDE-777', 'الشيخ أحمد بن علي (المرشد الديني)', 'guide@southstreet.dz', 'guide', hashPassword('Guide@2026!'), 'GUIDE_MURSHID', 'مرشد ديني', 'APPROVED', '+213 544 44 33 22', 'أ', '', '2026-08-06T10:00:00Z', 0],
    () => missing('usr_accountant') && ['usr_accountant', 'ACC-404', 'الأستاذ ياسين الفاسي (محاسب الوكالة)', 'accountant@southstreet.dz', 'accountant', hashPassword('Accountant@2026!'), 'ACCOUNTANT', 'محاسب الوكالة', 'APPROVED', '+213 561 11 88 99', 'ي', '', '2026-08-07T11:00:00Z', 0],
    () => missing('usr_agent') && ['usr_agent', 'AGENT-101', 'سارة خالد (خدمة العملاء)', 'agent@southstreet.dz', 'agent', hashPassword('Agent@2026!'), 'AGENCY_AGENT', 'خدمة العملاء', 'APPROVED', '+213 557 00 11 22', 'س', '', '2026-08-08T09:30:00Z', 0],
    () => missing('usr_pilgrim_user') && ['usr_pilgrim_user', 'PILGRIM-101', 'عمر بن علي (معتمر معتمد)', 'user@southstreet.dz', 'pilgrim', hashPassword('User@2026!'), 'PILGRIM_USER', 'معتمر', 'APPROVED', '+213 559 88 77 66', 'م', '1402 - سويس أوتيل مكة', '2026-08-10T14:15:00Z', 0],
  ];

  db.transaction(() => {
    if (!seedDemoData()) return;
    for (const make of defaultUsers) {
      const u = make();
      if (u) insertUser.run(...u);
    }
  })();

  // Promote the seeded guide/accountant roles if they are still the old generic agent role
  db.prepare(`UPDATE users SET role = 'GUIDE_MURSHID' WHERE id = 'usr_guide' AND role = 'AGENCY_AGENT'`).run();
  db.prepare(`UPDATE users SET role = 'ACCOUNTANT' WHERE id = 'usr_accountant' AND role = 'AGENCY_AGENT'`).run();
  db.prepare(`
    UPDATE users
    SET role = 'AGENCY_AGENT', requiresFileKey = 0, roleName = COALESCE(NULLIF(roleName,''), 'خدمة العملاء')
    WHERE (id = 'usr_agent' OR lower(IFNULL(email,'')) = 'agent@southstreet.dz' OR lower(IFNULL(username,'')) = 'agent')
      AND role IN ('manager', 'AGENCY_MANAGER', 'agent')
  `).run();
  db.prepare(`UPDATE users SET role = 'AGENCY_AGENT', requiresFileKey = 0 WHERE role = 'agent'`).run();

  // Super Admin and Admin accounts are never seeded: the Super Admin comes from
  // `npm run admin:setup`, Admins are invited by the Super Admin.

  // Seed Agency Settings
  const agencyCount = (db.prepare('SELECT COUNT(*) as cnt FROM agency_settings').get() as any).cnt;
  if (agencyCount === 0) {
    db.prepare(`
      INSERT INTO agency_settings (id, agency_name, legal_name, logo, description, address, city, country, phone, whatsapp, email, website, opening_hours, emergency_phone, supported_languages, default_currency, timezone)
      VALUES ('main', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'ساوث ستريت للأسفار والعمرة',
      'شركة ساوث ستريت للسياحة والأسفار ذ.م.م',
      '/images/logo.png',
      'الوكالة المعتمدة الأولى لرحلات العمرة والحج المباشرة وتأطير المعتمرين بالجزائر',
      'شارع 01 نوفمبر 1954، الجزائر العاصمة',
      'الجزائر العاصمة',
      'الجزائر',
      '+213 21 55 44 33',
      '+213 550 12 34 56',
      'contact@southstreet.dz',
      'https://southstreet.dz',
      'الأحد - الخميس: 08:30 صباحاً - 17:30 مساءً',
      '+213 661 99 88 77',
      JSON.stringify(['العربية', 'الدارجة الجزائرية', 'Français', 'English']),
      'DZD',
      'Africa/Algiers'
    );
  }

  try {
    const envGoogle = (process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '').trim();
    if (envGoogle) {
      db.prepare(
        `UPDATE agency_settings SET google_client_id = ?
         WHERE id = 'main' AND (google_client_id IS NULL OR google_client_id = '')`
      ).run(envGoogle);
    }
  } catch {
    /* optional Google client id */
  }

  // Seed Morshids / Team
  const morshidCount = (db.prepare('SELECT COUNT(*) as cnt FROM morshids').get() as any).cnt;
  if (morshidCount === 0 && seedDemoData()) {
    const insertMorshid = db.prepare(`
      INSERT INTO morshids (morshid_id, name, roleName, specialization, experience_years, languages, phone, avatar, rating, status, category, image)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const morshidsData = [
      ['m1', 'الشيخ د. عبد الرحمن النوي', 'مرشد ديني أول — مكة المكرمة', 'دكتوراه في الفقه وأصوله. متفرغ لإلقاء الدروس التوجيهية وتوجيه ضيوف الرحمن في المناسك.', 16, JSON.stringify(['العربية', 'الفرنسية']), '+213 550 12 34 56', 'ع', 4.98, 'متاح في مكة المكرمة', 'religious_guide', '/api/staff-image/morshed_01.png'],
      ['m2', 'الشيخ محمد الطيب', 'مرشد المناسك والمزارات — المدينة المنورة', 'متخصص في الشروح التاريخية للمزارات بالمدينة المنورة ومرافقة الحجاج في الروضة الشريفة.', 12, JSON.stringify(['العربية', 'الإنجليزية']), '+213 551 98 76 54', 'م', 4.95, 'في المدينة المنورة', 'religious_guide', '/api/staff-image/morshed_02.png'],
      ['m3', 'الأستاذ فاروق بوزيد', 'مرشد ميداني وقائد مجموعات', 'يقود تفويج المجموعات في الحافلات والمطارات لضمان سلاسة حركة ضيوف الرحمن.', 10, JSON.stringify(['العربية', 'الأمازيغية', 'الفرنسية']), '+213 552 33 44 55', 'ف', 4.90, 'مرافق الرحلات الميدانية', 'field_guide', '/api/staff-image/morshed_03.png'],
      ['m4', 'الشيخ ياسين العلي', 'مرشد التوجيه الروحي والمتابعة', 'مختص بالتواصل الفوري والإجابة عن استفسارات وفتاوى المعتمرين والعائلات.', 9, JSON.stringify(['العربية']), '+213 553 66 77 88', 'ي', 4.92, 'متاح للاستشارات والفتاوى', 'religious_guide', '/api/staff-image/morshed_04.png'],
      ['f1', 'الأستاذة مريم', 'مرشدة شؤون النساء والمناسك', 'متخصصة في إرشاد الأخوات في أحكام الإحرام والزيارات النسائية بالروضة الشريفة.', 8, JSON.stringify(['العربية', 'الفرنسية']), '+213 554 11 22 33', 'م', 4.99, 'متاحة للأخوات والمعتمرات', 'women_guide', '/api/staff-image/morshed_women_01.png'],
      ['f2', 'الأستاذة عائشة الجزائري', 'مرشدة التوجيه ورعاية الأخوات', 'مرافقة المعتمرات في الصلوات والزيارات ومتابعة الخدمات الخاصة بالنساء وكبار السن.', 7, JSON.stringify(['العربية', 'الأمازيغية']), '+213 555 44 55 66', 'ع', 4.93, 'متاحة لرعاية الأخوات', 'women_guide', '/api/staff-image/morshed_women_02.png'],
      ['s1', 'الأستاذ أحمد المنصوري', 'المدير العام لوكالة ساوث ستريت', 'يشرف على التعاقدات الفندقية والخطوط الجوية وضمان تطبيق أعلى معايير الجودة والراحة.', 18, JSON.stringify(['العربية', 'الفرنسية', 'الإنجليزية']), '+213 21 55 44 33', 'أ', 5.00, 'إدارة الوكالة', 'staff', '/api/staff-image/director_agancy.png'],
      ['s2', 'السيد توفيق بوجمعة', 'مدير العمليات اللوجستية والنقل', 'مسؤول عن حجز الحافلات الحديثة VIP وتنسيق الرحلات الجوية ومواعيد الاستقبال.', 14, JSON.stringify(['العربية', 'الفرنسية']), '+213 556 77 88 99', 'ت', 4.90, 'عمليات النقل واللوجستيك', 'staff', '/api/staff-image/team_member_01.png'],
      ['s3', 'الأستاذة سارة بن علي', 'مسؤولة التأشيرات وتنسيق الرحلات', 'تتولى إصدار التأشيرات الإلكترونية وتصاريح تطبيق نسك ودعم المعتمرين.', 8, JSON.stringify(['العربية', 'الفرنسية', 'الإنجليزية']), '+213 557 00 11 22', 'س', 4.96, 'قسم التأشيرات وتصاريح نسك', 'staff', '/api/staff-image/team_member_06.png'],
      ['s4', 'السيد كريم يوسفي', 'منسق الإقامة والإعاشة الفندقية', 'مقيم بمكة والمدينة لمتابعة جودة الغرف والبوفيه المفتوح وتلبية كافة الطلبات الخاصة 24/7.', 11, JSON.stringify(['العربية', 'الإنجليزية']), '+213 558 33 22 11', 'ك', 4.88, 'مقيم بمكة والمدينة 24/7', 'staff', '/api/staff-image/team_member_08.png']
    ];

    db.transaction(() => {
      for (const m of morshidsData) {
        insertMorshid.run(...m);
      }
    })();
  }

  const reviewCount = (db.prepare('SELECT COUNT(*) as cnt FROM reviews').get() as any).cnt;
  if (reviewCount === 0 && seedDemoData()) {
    const insertReview = db.prepare(`
      INSERT INTO reviews (
        id, target_type, target_id, target_name, reviewer_name, reviewer_user_id,
        stars, title, body, status, featured, admin_reply, admin_reply_at, created_at, published_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const now = '2026-08-10T09:00:00Z';
    const reviewsSeed = [
      ['rev_agency_1', 'agency', 'main', 'وكالة ساوث ستريت', 'عمر بن علي', 'usr_pilgrim_user', 5, 'رحلة مرتبة من الألف إلى الياء', 'الفندق قريب من الحرم والتنظيم ممتاز من الاستقبال في المطار حتى العودة. أنصح العائلات بالتعامل معهم.', 'APPROVED', 1, 'سعداء بخدمتكم، حج مبرور إن شاء الله.', now, now, now],
      ['rev_agency_2', 'agency', 'main', 'وكالة ساوث ستريت', 'فاطمة الزهراء بن دحمان', '', 5, 'المرشدة النسائية كانت سنداً', 'رافقونا خطوة بخطوة في الطواف والسعي، والتعامل راقٍ وواضح في الأسعار.', 'APPROVED', 1, '', '', now, now],
      ['rev_agency_3', 'agency', 'main', 'وكالة ساوث ستريت', 'سليم بلحاج', '', 4, 'تنظيم جيد مع ملاحظة بسيطة', 'الباقة الاقتصادية قيمة مقابل السعر. الحافلة ممتازة. تأخر بسيط في الاستقبال تم حله بسرعة.', 'APPROVED', 0, 'شكراً لملاحظتكم وسنضبط مواعيد الاستقبال أكثر.', now, now, now],
      ['rev_staff_s1', 'staff', 's1', 'الأستاذ أحمد المنصوري', 'عبد القادر الوهراني', '', 5, 'متابعة الإدارة مباشرة', 'المدير كان يرد على الاستفسارات بنفسه وطمأن العائلة قبل السفر.', 'APPROVED', 1, '', '', now, now],
      ['rev_staff_m1', 'staff', 'm1', 'الشيخ د. عبد الرحمن النوي', 'محمد عبد الله', '', 5, 'شرح المناسك بوضوح', 'الشيخ يشرح بهدوء ويجيب عن الأسئلة في الحرم دون استعجال.', 'APPROVED', 0, '', '', now, now],
      ['rev_pending_1', 'agency', 'main', 'وكالة ساوث ستريت', 'خالد بن يوسف', '', 3, 'تجربة قيد المراجعة', 'الرحلة جيدة لكن أرغب أن تراجع الإدارة موضوع توزيع الغرف للعائلات.', 'PENDING', 0, '', '', now, ''],
    ];
    db.transaction(() => {
      for (const r of reviewsSeed) insertReview.run(...r);
    })();
    try {
      const { syncStaffRating } = require('./reviews') as typeof import('./reviews');
      syncStaffRating('s1');
      syncStaffRating('m1');
    } catch {}
  }

  // Seed Hotels
  const hotelCount = (db.prepare('SELECT COUNT(*) as cnt FROM hotels').get() as any).cnt;
  if (hotelCount === 0) {
    const insertHotel = db.prepare(`
      INSERT INTO hotels (hotel_id, name, city, category, address, latitude, longitude, distance_from_haram, description, services, images, videos, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const hotelsData = [
      ['htl_swissotel_makkah', 'فندق سويس أوتيل مكة (Swissôtel Makkah)', 'MAKKAH', 'VIP', 'مجمع أبراج البيت، صحن الحرم المكي الشريف', 21.4187, 39.8256, '50م فقط (دخول مباشر لصحن الحرم عبر مجمع الأبراج)', 'فندق فاخر خماسي النجوم يطل مباشرة على الكعبة المشرفة وصحن الحرم المكي.', JSON.stringify(['بوفيه مفتوح', 'واي فاي سريع', 'خدمة الغرف 24/7', 'دخول مباشر للمصلى', 'مصاعد سريعة']), JSON.stringify(['https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&auto=format&fit=crop']), JSON.stringify([]), 'ACTIVE'],
      ['htl_manarat_gaza', 'فندق منارات غزة مكة المكرمة', 'MAKKAH', '4_STAR', 'منطقة غزة، مكة المكرمة', 21.4245, 39.8312, '350م فقط عن صحن الحرم المكي', 'فندق حديث مميز بالقرب السريع من صحن الحرم وغرف واسعة للعائلات والأفراد.', JSON.stringify(['تكييف مركزي', 'شاشات مسطحة', 'خدمة حافلات عند الحاجة', 'مطعم إعاشة']), JSON.stringify(['https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800&auto=format&fit=crop']), JSON.stringify([]), 'ACTIVE'],
      ['htl_pullman_madinah', 'فندق بولمان زمزم المدينة المنورة', 'MADINAH', '5_STAR', 'المنطقة المركزية الشمالية، المدينة المنورة', 24.4672, 39.6111, 'خطوات معدودة عن المسجد النبوي الشريف وباب النساء', 'إقامة راقية ومباشرة بالمنطقة المركزية بالقرب من الروضة الشريفة.', JSON.stringify(['بوفيه مفتوح', 'إرشاد خاص', 'خدمات كبار السن', 'مركز رجال الأعمال']), JSON.stringify(['https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&auto=format&fit=crop']), JSON.stringify([]), 'ACTIVE']
    ];

    db.transaction(() => {
      for (const h of hotelsData) {
        insertHotel.run(...h);
      }
    })();
  }

  // Seed Seasons
  const seasonCount = (db.prepare('SELECT COUNT(*) as cnt FROM seasons').get() as any).cnt;
  if (seasonCount === 0 && seedDemoData()) {
    const insertSeason = db.prepare(`
      INSERT INTO seasons (season_id, type, islamic_year, gregorian_year, name, start_date, end_date, status, description, official_information, agency_information)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const seasonsData = [
      ['season_ramadan_2026', 'UMRAH', '1447', '2026', 'موسم عمرة رمضان المبارك 2026', '2026-03-01', '2026-04-05', 'CURRENT', 'رحلات مباشرة متتابعة طيلة شهر رمضان المبارك مع ليالي القدر في مكة المكرمة.', 'اشتراط التواجد المسبق قبل 48 ساعة بالمطار وتحليل الصحي المعترف به.', 'فنادق 5 نجوم على بعد خطوات من صحن الحرم المكي الشريف.'],
      ['season_august_2026', 'UMRAH', '1448', '2026', 'موسم عمرة أوت المميز 2026', '2026-08-15', '2026-09-10', 'OPEN', 'باقة اقتصادية عائلية ومباشرة من الجزائر العاصمة، وهران، وعنابة.', 'جواز سفر بيومتري صالح 6 أشهر وزوج صور خلفية بيضاء.', 'إقامة بفندق منارات غزة 350م فقط عن صحن الحرم المكي.'],
      ['season_hajj_1447', 'HAJJ', '1447', '2026', 'موسم الحج الإداري والمباشر 1447هـ', '2026-05-15', '2026-06-25', 'UPCOMING', 'حملة الحج المعتمدة رسمياً للتكفل التام بالحجاج بالمشاعر المقدسة (منى وعرفات).', 'التسجيل يتبع القرعة الرسمية للديوان الوطني للحج والعمرة.', 'مخيمات VIP مجددة ومكيفة بمنى مع إعاشة كاملة وتأطير علماء شريعة.']
    ];

    db.transaction(() => {
      for (const s of seasonsData) {
        insertSeason.run(...s);
      }
    })();
  }

  // Seed Packages & Prices
  const pkgCount = (db.prepare('SELECT COUNT(*) as cnt FROM packages').get() as any).cnt;
  if (pkgCount === 0 && seedDemoData()) {
    const insertPkg = db.prepare(`
      INSERT INTO packages (
        package_id, name, type, season_id, season_name, description, start_date, end_date, duration_days,
        departure_city, departure_airport, arrival_airport, airline, makkah_hotel_id, makkah_hotel_name, makkah_hotel_dist,
        madinah_hotel_id, madinah_hotel_name, madinah_hotel_dist, hotel_category, morshid_id, morshid_name,
        included_services, excluded_services, booking_conditions, cancellation_policy, capacity, reserved, available,
        status, published, image_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertPrice = db.prepare(`
      INSERT INTO package_prices (price_id, package_id, room_type, traveler_type, currency, amount)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    db.transaction(() => {
      insertPkg.run(
        'pkg_august_economy_2026', 'باقة أوت الاقتصادية المميزة (طيران مباشر)', 'ECONOMY', 'season_august_2026', 'موسم عمرة أوت 2026',
        'رحلة عمرة مباشرة اقتصادية مريحة تشمل طيران مباشر، فندق منارات غزة 350م من صحن الحرم المكي، وتنقلات VIP.',
        '2026-08-15', '2026-08-29', 15, 'الجزائر العاصمة / وهران / عنابة', 'مطار هواري بومدين (ALG)', 'مطار الأمير محمد بن عبد العزيز (MED)',
        'الخطوط الجوية الجزائرية والخطوط السعودية', 'htl_manarat_gaza', 'فندق منارات غزة مكة', '350م فقط عن صحن الحرم المكي',
        'htl_pullman_madinah', 'فندق بولمان زمزم المدينة', 'خطوات عن المسجد النبوي', '4 نجوم / 5 نجوم', 'm1', 'الشيخ د. عبد الرحمن النوي',
        JSON.stringify(['تأشيرة العمرة الإلكترونية النسك', 'تذكرة الطيران المباشر ذهاباً وإياداً', 'الإقامة بالفنادق المذكورة مع الإفطار', 'التنقلات الداخلية بحافلات سياحية VIP مكيفة', 'زيارات المزارات بالمدينة المنورة ومكة المكرمة', 'مرشد ديني ومرافقة صحية طوال الرحلة']),
        JSON.stringify(['مصاريف الجواز والتطعيمات الشخصية', 'المشتريات والهدايا الشخصية']),
        JSON.stringify(['دفع 30% دفعة أولى عند الحجز', 'تسديد المتبقي 15 يوماً قبل موعد السفر']),
        'إلغاء مجاني حتى 20 يوماً قبل السفر، يخصم قيمة التبتيل بعد صدور التأشيرة.',
        45, 28, 17, 'PUBLISHED', 1, 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&auto=format&fit=crop'
      );

      insertPrice.run('prc_aug_quad', 'pkg_august_economy_2026', 'QUAD', 'ADULT', 'DZD', 215000);
      insertPrice.run('prc_aug_triple', 'pkg_august_economy_2026', 'TRIPLE', 'ADULT', 'DZD', 235000);
      insertPrice.run('prc_aug_double', 'pkg_august_economy_2026', 'DOUBLE', 'ADULT', 'DZD', 265000);
      insertPrice.run('prc_aug_single', 'pkg_august_economy_2026', 'SINGLE', 'ADULT', 'DZD', 320000);

      insertPkg.run(
        'pkg_mawlid_vip_2026', 'باقة المولد النبوي VIP (سويس أوتيل برج الساعة)', 'VIP', 'season_ramadan_2026', 'موسم عمرة المولد VIP',
        'إقامة VIP مطلة ومباشرة على صحن الحرم المكي بفندق سويس أوتيل برج الساعة (50م فقط)، مع إعاشة بوفيه فاخر وتأطير شرعي خاص.',
        '2026-09-12', '2026-09-27', 15, 'الجزائر العاصمة', 'مطار هواري بومدين (ALG)', 'مطار الملك عبد العزيز (JED)',
        'الخطوط السعودية (Saudia VIP)', 'htl_swissotel_makkah', 'فندق سويس أوتيل مكة برج الساعة', '50م فقط عن صحن الحرم (دخول مباشر)',
        'htl_pullman_madinah', 'فندق بولمان زمزم المدينة', 'خطوات عن المسجد النبوي', '5 نجوم VIP', 'm2', 'الشيخ محمد الطيب',
        JSON.stringify(['تأشيرة العمرة الإلكترونية السريعة', 'تذكرة طيران VIP على الخطوط السعودية', 'إعاشة بوفيه مفتوح فاخر بفندق سويس أوتيل', 'استخراج تصريح الروضة الشريفة بنسك', 'استقبال خاص بسيارات VIP في مطار جدة والمدينة']),
        JSON.stringify(['مصاريف التطعيم الشخصية']),
        JSON.stringify(['دفع 40% عند التأكيد وارفاق نسخة الجواز']),
        'استرجاع كامل المبلغ في حال إلغاء الرحلة من الطرف الرسمي.',
        30, 21, 9, 'PUBLISHED', 1, 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800&auto=format&fit=crop'
      );

      insertPrice.run('prc_mwl_quad', 'pkg_mawlid_vip_2026', 'QUAD', 'ADULT', 'DZD', 295000);
      insertPrice.run('prc_mwl_triple', 'pkg_mawlid_vip_2026', 'TRIPLE', 'ADULT', 'DZD', 325000);
      insertPrice.run('prc_mwl_double', 'pkg_mawlid_vip_2026', 'DOUBLE', 'ADULT', 'DZD', 375000);
      insertPrice.run('prc_mwl_single', 'pkg_mawlid_vip_2026', 'SINGLE', 'ADULT', 'DZD', 480000);
    })();
  }

  // Seed AI Knowledge
  const insertRule = db.prepare(`
    INSERT OR REPLACE INTO ai_knowledge (id, category, title_ar, keywords, response_ar, is_active, updatedBy, updatedAt, answerMode, matchStrategy)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const rules = [
    ['rule_august_package', 'packages', 'باقة أوت الاقتصادية المميزة', JSON.stringify(['أوت', 'اقتصادية', '215000', '215,000', 'منارات غزة']), '🕋 **باقة أوت المميزة (215,000 دج):**\n• طيران مباشر بدون توقف من الجزائر، وهران، وعنابة.\n• إقامة فاخرة بفندق منارات غزة (350م فقط عن صحن الحرم المكي).\n• مرافقة دينية وصحية مستمرة طوال الـ 15 يوماً.', 1, 'admin@southstreet.dz', new Date().toISOString(), 'official_exact', 'keywords_or_title'],
    ['rule_mawlid_package', 'packages', 'باقة المولد النبوي VIP', JSON.stringify(['المولد', 'vip', '295000', '295,000', 'سويس أوتيل', 'برج الساعة']), '🌟 **باقة المولد النبوي VIP (295,000 دج):**\n• إقامة VIP بفندق سويس أوتيل برج الساعة (50م فقط عن صحن الحرم).\n• إعاشة بوفيه مفتوح واستقبال وتوديع VIP مع تأطير ديني خاص.', 1, 'admin@southstreet.dz', new Date().toISOString(), 'official_exact', 'keywords_or_title'],
    ['rule_passport_docs', 'requirements', 'شروط والوثائق المطلوبة للتسجيل', JSON.stringify(['شروط', 'وثائق', 'جواز', 'ملف', 'أوراق', 'تلقيح', 'شروط التسجيل']), '📋 **شروط وأوراق التقديم للعمرة 2026:**\n1. جواز سفر بيومتري صالح لأكثر من 6 أشهر.\n2. عدد 2 صور شمسية خلفية بيضاء.\n3. شهادة التلقيح المعتمدة.\n4. دفع عربون تأكيد الحجز (30% أو دفع كامل عبر CCP/بريدي موب).', 1, 'manager@southstreet.dz', new Date().toISOString(), 'official_exact', 'keywords_or_title'],
    ['rule_umrah_steps', 'rituals', 'مناسك العمرة الأربعة وأحكامها', JSON.stringify(['مناسك', 'خطوات', 'طواف', 'سعي', 'إحرام', 'تحلل', 'ميقات', 'كيف أعتمر']), '🕋 **مناسك العمرة خطوة بخطوة:**\n1. **الإحرام** مع النية والتلبية من الميقات.\n2. **طواف القدوم** 7 أشواط حول الكعبة المشرفة ابتداءً من الحجر الأسود.\n3. **السعي بين الصفا والمروة** 7 أشواط.\n4. **الحلق أو التقصير** للتحلل من الإحرام.\n💡 يرافقك المرشد الديني الشيخ د. عبد الرحمن النوي خطوة بخطوة في كل منسك.', 1, 'guide@southstreet.dz', new Date().toISOString(), 'official_exact', 'keywords_or_title'],
    ['rule_finance_ccp', 'pricing', 'طرق الدفع والتحويل البنكي والتقسيط', JSON.stringify(['دفع', 'تحويل', 'ccp', 'بريدي موب', 'تقسيط', 'سند', 'فاتورة', 'وصل']), '💳 **طرق الدفع المعتمدة بوكالة ساوث ستريت:**\n• الدفع نقداً أو بشيك في مقر الوكالة.\n• التحويل الفوري عبر تطبيق بريدي موب (BaridiMob).\n• التحويل البريدي لحساب الوكالة الجاري (CCP).\n• **تسهيلات التقسيط الميسر:** خطة دفع شهرية مرنة من 2 إلى 10 أشهر بدون فوائد.\n🧾 يصدر المحاسب المالي (الأستاذ ياسين الفاسي) سند قبض رقمي فوري.', 1, 'accountant@southstreet.dz', new Date().toISOString(), 'official_exact', 'keywords_or_title'],
    ['rule_director_info', 'requirements', 'المدير العام لوكالة ساوث ستريت', JSON.stringify(['المدير', 'مدير', 'مدير الوكالة', 'من هو المدير', 'المدير العام', 'المؤسس', 'صاحب الوكالة', 'رئيس الوكالة', 'director', 'manager']), '👔 **المدير العام والمؤسس لوكالة ساوث ستريت للأسفار والعمرة:**\n\n• **الاسم الكامل:** الأستاذ طارق العماري (المدير العام ورئيس مجلس الإدارة).\n• **الخبرة القيادية:** أكثر من 18 سنة في إدارة رحلات الحج والعمرة والتعاقدات الفندقية والخطوط الجوية.\n• **المهام والمتابعة:** الإشراف المباشر على راحة ضيوف الرحمن والتأطير الفندقي والصحي 24/7.\n📞 **للتواصل المباشر مع الإدارة العامة:** +213 21 55 44 33 | 📧 admin@southstreet.dz', 1, 'admin@southstreet.dz', new Date().toISOString(), 'official_exact', 'keywords_or_title'],
    ['rule_accountant_info', 'pricing', 'المحاسب المالي وقسم الحسابات', JSON.stringify(['المحاسب', 'محاسب', 'من هو المحاسب', 'محاسب الوكالة', 'المالية', 'قسم المالية', 'سند القبض', 'الفواتير', 'accountant']), '💼 **المحاسب المالي الرئيسي بوكالة ساوث ستريت:**\n\n• **الاسم الكامل:** الأستاذ ياسين الفاسي (محاسب الوكالة المعتمد ورئيس قسم المالية).\n• **المهام المالية:** اعتماد التحويلات البنكية، متابعة دفعات المعتمرين، إصدار سندات القبض الرقمية، وتنظيم جدولة التقسيط الميسر من 2 إلى 10 أشهر.\n• **الهاتف المباشر للمحاسب:** +213 561 11 88 99 | 📧 accountant@southstreet.dz\n🧾 يصدر المحاسب سند قبض رقمي فور كل قسط أو دفعة.', 1, 'accountant@southstreet.dz', new Date().toISOString(), 'official_exact', 'keywords_or_title'],
    ['rule_agency_location', 'requirements', 'مقر وعنوان القيادة والإدارة العامة للوكالة', JSON.stringify(['عنوان', 'العنوان', 'مقر', 'المقر', 'أين', 'اين', 'موقع', 'مكان', 'الاتجاه', 'اتجاه', 'اتجاهات', 'مكتب', 'الجزائر العاصمة', 'address', 'location']), '📍 **عنوان ومقر القيادة والإدارة العامة لوكالة ساوث ستريت:**\n\n🏢 **المقر الرئيسي (الجزائر العاصمة):** شارع 01 نوفمبر 1954 (ساوث ستريت)، الجزائر العاصمة.\n🧭 **الاتجاه والموقع:** بجوار ساحة أودان ومحطة هواري بومدين / الجزائر العاصمة.\n⏰ **أوقات العمل:** الأحد إلى الخميس من 08:30 صباحاً إلى 17:30 مساءً.\n🌐 **المكاتب المعتمدة:** فرع الجزائر العاصمة، فرع وهران، وفرع عنابة.\n📞 **هاتف الاستقبال:** +213 21 55 44 33 | 💬 **واتساب:** +213 550 12 34 56', 1, 'admin@southstreet.dz', new Date().toISOString(), 'official_exact', 'keywords_or_title'],
    ['rule_installments_facility', 'pricing', 'تسهيلات الدفع والتقسيط الميسر من 2 إلى 10 أشهر', JSON.stringify(['تقسيط', 'التقسيط', 'تسهيلات', 'دفعات', 'أشهر', 'اشهر', 'بالتقسيط', '2 الى 10', 'من 2 الى 10', 'شروط التقسيط', 'اقساط', 'أقساط', 'ميسر', 'installment', 'installments']), '💳 **تسهيلات الدفع والتقسيط الميسر بوكالة ساوث ستريت (من 2 إلى 10 أشهر):**\n\nتقدم وكالة ساوث ستريت خيار **التقسيط المريح بدون فوائد** لجميع باقات العمرة والحج لعام 2026:\n\n1. **فترة التقسيط المرنة:** يمكنك تقسيط تكلفة العمرة على فترة تتراوح من **شهريين (2) حتى 10 أشهر كاملة**.\n2. **الدفعة الأولى:** تسديد دفعة تسقيع أولى (من 20% إلى 30%) عند حجز وتثبيت الملف.\n3. **طرق السداد:** أسباب ودفعات شهرية ميسرة عبر بريدي موب (BaridiMob)، التحويل البريدي CCP، أو نقداً بمقر الوكالة.\n4. **سندات القبض الرقمية:** إصدار سند قبض رقمي فور كل قسط شهري معتمد من المحاسب المالي الأستاذ ياسين الفاسي.\n\nتفضل بزيارة المقر أو التواصل مع المحاسب لتنسيق جدول أقساطك المريحة!', 1, 'accountant@southstreet.dz', new Date().toISOString(), 'official_exact', 'keywords_or_title'],
    ['rule_mahram_women', 'rituals', 'حكم المحرم للمرأة في العمرة', JSON.stringify(['محرم', 'المحرم', 'محram', 'بدون محرم', 'المرأة', 'مرأة', 'تعتمر', 'معتمرة', 'نساء', 'سفر المرأة', 'mahram']), '🧕 **حكم المحرم للمرأة في العمرة — إرشادات وكالة ساوث ستريت:**\n\n1. **الأصل الشرعي:** جمهور العلماء يرى **وجوب وجود محرم** للمرأة في سفر العمرة والحج إذا تجاوزت مسافة القصر، وفق الأحوال المعتبرة في الفقه.\n2. **متطلبات التأشيرة السعودية:** تطبيق **نسك** ووزارة الحج يشترط عادةً **مرافقة محرم** أو مجموعة نسائية معتمدة حسب اللوائح المعمول بها لكل موسم — يُرجى التحقق من الشروط الرسمية وقت التسجيل.\n3. **سياسة الوكالة:** وكالة ساوث ستريت **تلتزم بالأنظمة الرسمية** ولا تقبل تسجيل ملفات مخالفة لاشتراطات التأشيرة. ننصح المعتمرات بمرافقة محرم أو الانضمام لمجموعة نسائية منظمة عبر الوكالة.\n4. **استثناءات واستفسارات:** للحالات الخاصة (كبار السن، المرض، ظروف عائلية)، تواصل مع **المرشدة الدينية** أو الإدارة لتقييم الملف.\n\n📞 **للاستشارة:** +213 21 55 44 33 | 💬 المرشدة: عبر بوابة الوكالة → المحادثة', 1, 'guide@southstreet.dz', new Date().toISOString(), 'official_exact', 'keywords_or_title']
  ];

  db.transaction(() => {
    for (const r of rules) {
      insertRule.run(...r);
    }
  })();

  seedPageContent(db);
  try {
    if (seedDemoData()) seedFinanceDefaults(db);
  } catch (err) {
    console.warn('[Finance seed]:', err);
  }
}

type PageContentSeed = [string, string, string, string, string, string, string, string, string];

const PAGE_CONTENT_SEEDS: PageContentSeed[] = [
  ['hero_banner', 'homepage',
    'عمرة تليق بطمأنينتكم.',
    'Une Omra à la hauteur de votre sérénité.',
    'An Umrah worthy of your peace of mind.',
    'عرض شهر أوت 2026 — طيران مباشر وإقامة بجوار الحرم.',
    'Offre août 2026 — vol direct et hébergement près de la Haram.',
    'August 2026 offer — direct flight and stay next to the Haram.',
    ''],
  ['nav_promo', 'homepage',
    'خدمتكم شرف نعتز به وكالة ساوث ستريت — رفيقكم الموثوق لأداء العمرة والحج بأعلى درجات الرفاهية والاطمئنان.',
    'South Street — votre compagnon de confiance pour l\'Omra et le Hajj.',
    'South Street — your trusted companion for Umrah and Hajj.',
    '', '', '', ''],
  ['about_section', 'homepage',
    'طاقم الوكالة والمرشدون الميدانيون',
    'L\'équipe de l\'agence et les guides sur le terrain',
    'The agency team and field guides',
    'نخبة من الإداريين والعلماء المرشدين لمرافقتك طوال مراحل رحلة العمرة والحج.',
    'Une élite d\'administrateurs et de savants pour vous accompagner tout au long du voyage.',
    'A dedicated team of administrators and scholars to accompany you throughout the journey.',
    ''],
  ['programs_section', 'homepage',
    'مواعيد الانطلاق',
    'Dates de départ',
    'Departure dates',
    'هذه تواريخ البرامج نفسها. افتح أي تاريخ لترى الفندق والسعر وتحجز.',
    'Ce sont les dates des mêmes programmes. Ouvrez une date pour l\'hôtel, le prix et la réservation.',
    'These are the dates of the same programs. Open a date for the hotel, price, and booking.',
    ''],
  ['promo_billboard', 'homepage',
    'رحلة طيران مباشرة إلى البقاع المقدسة',
    'Vol direct vers les Lieux Saints',
    'Direct flight to the Holy Land',
    '', '', '', '/images/AIR_ALGERIA.webp'],
  ['footer_newsletter', 'footer',
    'لا تفوّتوا جديدنا',
    'Ne manquez pas nos actualités',
    'Don\'t miss our updates',
    'أدخلوا بريدكم الإلكتروني للأخبار وتحديثات الرحلات',
    'Entrez votre e-mail pour les actualités et les mises à jour des voyages.',
    'Enter your email for news and trip updates.',
    ''],
];

const LEGACY_PAGE_TITLES: Record<string, string> = {
  hero_banner: 'رحلتك إلى بيت الله الحرام بشعور ملؤه السكينة والإيمان',
  about_section: 'لماذا تختار وكالة ساوث ستريت للعمرة والحج؟',
  programs_section: 'اختر رحلتك القادمة',
};

function seedPageContent(db: Database.Database) {
  const now = new Date().toISOString();
  const insertIgnore = db.prepare(`
    INSERT OR IGNORE INTO page_content (key, section, title_ar, title_fr, title_en, content_ar, content_fr, content_en, image_url, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const getTitle = db.prepare('SELECT title_ar FROM page_content WHERE key = ?');
  const updateLegacy = db.prepare(`
    UPDATE page_content
    SET section = ?, title_ar = ?, title_fr = ?, title_en = ?, content_ar = ?, content_fr = ?, content_en = ?, image_url = ?, updated_at = ?
    WHERE key = ?
  `);

  for (const row of PAGE_CONTENT_SEEDS) {
    try {
      insertIgnore.run(row[0], row[1], row[2], row[3], row[4], row[5], row[6], row[7], row[8], now);
      const existing = getTitle.get(row[0]) as { title_ar?: string } | undefined;
      if (existing && LEGACY_PAGE_TITLES[row[0]] && existing.title_ar === LEGACY_PAGE_TITLES[row[0]]) {
        updateLegacy.run(row[1], row[2], row[3], row[4], row[5], row[6], row[7], row[8], now, row[0]);
      }
    } catch (err) {
      console.warn('[Page content seed]', row[0], err);
    }
  }
}
