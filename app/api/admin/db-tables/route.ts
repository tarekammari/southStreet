import { NextRequest, NextResponse } from 'next/server';
import { getSqliteDb } from '@/lib/sqlite';
import { getDatabase, saveDatabase, AiKnowledgeRule } from '@/lib/db';
import { getColumnLabelAr } from '@/lib/table-column-labels';
import { ensurePackageRoomPrices } from '@/lib/package-options';
import { normalizePackageStatus, toFeaturedFlag } from '@/lib/package-status';
import { requireRole, requireStepUp, ADMINS } from '@/lib/staff-gate';
import {
  ADMIN_TABLES,
  canReadTable,
  canWriteTable,
  STEP_UP_DELETE_TABLES,
} from '@/lib/admin-tables';
import { inspectDelete, disableStaffLogin } from '@/lib/admin-delete-guards';

export const dynamic = 'force-dynamic';

/**
 * Generic table editor. Admins edit content tables; the Super Admin can also
 * read the audit log and receipts. Accounts, agency settings (which hold
 * security material) and messages have dedicated, permission-checked screens
 * and are never reachable from here.
 *
 * The list of tables, their labels and who may read / write them lives in
 * lib/admin-tables.ts so the chat menu and this route can never disagree.
 */
const ALLOWED_TABLES: Record<string, string> = Object.fromEntries(
  Object.entries(ADMIN_TABLES).map(([name, t]) => [name, t.label])
);

const canRead = canReadTable;
const canWrite = canWriteTable;

const DEFAULT_PAGE = 150;
const MAX_PAGE = 500;

/** `available` is always capacity − reserved, and `published` must follow `status`. */
function syncPackageDerived(db: any, packageId: string) {
  db.prepare(
    `UPDATE packages
        SET available = MAX(COALESCE(capacity, 0) - COALESCE(reserved, 0), 0),
            published = CASE WHEN UPPER(COALESCE(status, '')) = 'PUBLISHED' THEN 1 ELSE 0 END
      WHERE package_id = ?`
  ).run(packageId);
}

/** Canonical status / featured flag for programme rows, whatever was typed. */
function normalizePackageInput(rowData: Record<string, any>) {
  if ('status' in rowData) {
    const status = normalizePackageStatus(rowData.status);
    if (status) rowData.status = status;
  }
  if ('featured' in rowData) rowData.featured = toFeaturedFlag(rowData.featured);
}

/** Only one programme is the home-page hero offer. */
function keepSingleFeatured(db: any, packageId: string, rowData: Record<string, any>) {
  if (packageId && rowData.featured === 1) {
    db.prepare('UPDATE packages SET featured = 0 WHERE package_id != ?').run(packageId);
  }
}

function writeAudit(db: any, gate: { account: any; role: string }, action: string, details: string, req: Request) {
  try {
    db.prepare(
      'INSERT INTO audit_logs (id, timestamp, actorName, actorRole, action, details, ip) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(
      `aud_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      new Date().toISOString(),
      String(gate.account?.name || gate.account?.id || 'admin'),
      gate.role,
      action,
      details,
      req.headers.get('x-forwarded-for') || ''
    );
  } catch {
    // auditing must never block the admin action itself
  }
}

/** Turns SQLite constraint failures into a message the admin can act on. */
function friendlyDbError(error: any): { status: number; message: string } | null {
  const msg = String(error?.message || '');
  const notNull = msg.match(/NOT NULL constraint failed: \w+\.(\w+)/);
  if (notNull) return { status: 400, message: `الحقل «${getColumnLabelAr(notNull[1])}» مطلوب ولا يمكن تركه فارغاً` };
  const unique = msg.match(/UNIQUE constraint failed: \w+\.(\w+)/);
  if (unique) return { status: 409, message: `القيمة في «${getColumnLabelAr(unique[1])}» موجودة مسبقاً` };
  return null;
}

/** Staff logins never touch Admin accounts from this editor. */
function syncStaffLogin(staff: any): unknown {
  try {
    const { ensureStaffLogin } = require('@/lib/accounts') as typeof import('@/lib/accounts');
    return ensureStaffLogin(staff);
  } catch (err: any) {
    if (err?.message === 'PRIVILEGED_PROTECTED' || err?.message === 'SUPER_ADMIN_PROTECTED') return undefined;
    throw err;
  }
}

function requireDbAdmin(req: NextRequest) {
  return requireRole(req, ADMINS);
}

export async function GET(req: Request) {
  const gate = requireDbAdmin(req as NextRequest);
  if ('error' in gate) return gate.error;

  try {
    const { searchParams } = new URL(req.url);
    const tableName = searchParams.get('table') || '';

    const db = getSqliteDb();

    if (!tableName) {
      // Return list of available tables with row counts
      const tablesSummary = Object.keys(ALLOWED_TABLES).filter((tbl) => canRead(tbl, gate.role)).map(tbl => {
        try {
          const cnt = (db.prepare(`SELECT COUNT(*) as cnt FROM ${tbl}`).get() as any).cnt;
          return {
            name: tbl,
            label: ALLOWED_TABLES[tbl],
            count: cnt
          };
        } catch {
          return { name: tbl, label: ALLOWED_TABLES[tbl], count: 0 };
        }
      });
      return NextResponse.json({ tables: tablesSummary });
    }

    if (!canRead(tableName, gate.role)) {
      return NextResponse.json({ error: 'الجدول المطلوب غير مدعوم' }, { status: 400 });
    }

    const columns = (db.prepare(`PRAGMA table_info(${tableName})`).all() as any[]).map(c => ({
      name: c.name,
      type: c.type,
      pk: Boolean(c.pk),
      notnull: Boolean(c.notnull),
      hasDefault: c.dflt_value !== null && c.dflt_value !== undefined,
      labelAr: getColumnLabelAr(c.name)
    }));

    // tableName passed canRead() above, so it is one of the registry's fixed names.
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '', 10) || DEFAULT_PAGE, 1), MAX_PAGE);
    const offset = Math.max(parseInt(searchParams.get('offset') || '', 10) || 0, 0);
    const totalCount = (db.prepare(`SELECT COUNT(*) as c FROM ${tableName}`).get() as any).c as number;
    const rows = db
      .prepare(`SELECT * FROM ${tableName} ORDER BY 1 DESC LIMIT ? OFFSET ?`)
      .all(limit, offset) as any[];

    // Parse JSON fields if present
    const parsedRows = rows.map(r => {
      const obj = { ...r };
      for (const [key, val] of Object.entries(obj)) {
        if (key.endsWith('Hash') || key === 'passwordHash' || key === 'qrSecretHash') {
          obj[key] = val ? '••••••••' : '';
          continue;
        }
        if (typeof val === 'string' && (val.startsWith('[') || val.startsWith('{'))) {
          try { obj[key] = JSON.parse(val); } catch {}
        }
      }
      return obj;
    });

    return NextResponse.json({
      tableName,
      label: ALLOWED_TABLES[tableName],
      writable: canWrite(tableName, gate.role),
      columns,
      totalRows: parsedRows.length,
      totalCount,
      offset,
      rows: parsedRows
    });
  } catch (error: any) {
    console.error('[db-tables GET]', error);
    return NextResponse.json({ error: 'خطأ في استعلام البيانات' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const gate = requireDbAdmin(req as NextRequest);
  if ('error' in gate) return gate.error;

  try {
    const body = await req.json();
    const { action, tableName, rowData, formula } = body;

    const sqliteDb = getSqliteDb();

    // Action 1: Train AI Custom Response Formula / Rule
    if (action === 'train_formula' || formula) {
      const question = formula?.question || body.question || '';
      const responsePattern = formula?.responsePattern || body.responsePattern || '';
      const keywords = formula?.keywords || body.keywords || [question];

      if (!question || !responsePattern) {
        return NextResponse.json({ error: 'يرجى تحديد السؤال وصيغة الإجابة المطلوبة' }, { status: 400 });
      }

      const db = getDatabase();
      const extractedWords = question
        .replace(/[؟?.,!،:;()[\]"']/g, ' ')
        .split(/\s+/)
        .map((w: string) => w.trim().toLowerCase())
        .filter((w: string) => w.length > 2 && !['هذا', 'هذه', 'الذي', 'التي', 'إلى', 'على', 'عن', 'في', 'من'].includes(w));
      const allKeywords = Array.from(new Set([question.trim().toLowerCase(), ...extractedWords]));

      const newRule: AiKnowledgeRule = {
        id: `rule_trained_${Date.now()}`,
        category: 'pricing',
        title_ar: question.trim(),
        keywords: allKeywords,
        response_ar: responsePattern.trim(),
        is_active: true,
        answerMode: 'official_exact',
        matchStrategy: 'keywords_or_title',
        updatedBy: 'Admin (Sakhr Chat Assistant)',
        updatedAt: new Date().toISOString()
      };

      db.aiKnowledge.unshift(newRule);
      saveDatabase(db);

      return NextResponse.json({
        success: true,
        message: `🎉 تم حفظ وحقن صيغة الإجابة بنجاح في قاعدة بيانات صخر AI!`,
        rule: newRule
      });
    }

    // Action 2: Direct Data Insertion into Specified Table
    if (action === 'insert_data' && tableName) {
      if (!canWrite(tableName, gate.role)) {
        return NextResponse.json({ error: 'الجدول غير صالح للإضافة' }, { status: 400 });
      }

      if (!rowData || typeof rowData !== 'object' || Array.isArray(rowData)) {
        return NextResponse.json({ error: 'بيانات السطر غير صالحة' }, { status: 400 });
      }

      // Column names are interpolated into SQL, so only real columns pass.
      const insertColumns = new Set(
        (sqliteDb.prepare(`PRAGMA table_info(${tableName})`).all() as any[]).map((c) => c.name)
      );
      if (tableName === 'packages') {
        normalizePackageInput(rowData);
        // A new programme has no bookings yet, even when copied from another one.
        rowData.reserved = 0;
      }
      const keys = Object.keys(rowData).filter((k) => insertColumns.has(k));
      if (keys.length === 0) {
        return NextResponse.json({ error: 'لا توجد حقول صالحة' }, { status: 400 });
      }
      const placeholders = keys.map(() => '?').join(', ');
      const values = keys.map(k => {
        const v = rowData[k];
        return (typeof v === 'object' && v !== null) ? JSON.stringify(v) : v;
      });

      const sql = `INSERT INTO ${tableName} (${keys.join(', ')}) VALUES (${placeholders})`;
      sqliteDb.prepare(sql).run(...values);
      if (tableName === 'packages') {
        ensurePackageRoomPrices(sqliteDb, String(rowData.package_id || ''));
        syncPackageDerived(sqliteDb, String(rowData.package_id || ''));
        keepSingleFeatured(sqliteDb, String(rowData.package_id || ''), rowData);
      }

      let extra: Record<string, unknown> = {};
      if (tableName === 'morshids') {
        const staffId = rowData.morshid_id;
        if (staffId) {
          const staff = sqliteDb.prepare('SELECT * FROM morshids WHERE morshid_id = ?').get(staffId) as any;
          if (staff) extra.login = syncStaffLogin(staff);
        }
      }

      return NextResponse.json({
        success: true,
        message: `✅ تم إضافة السجل الجديد بنجاح في جدول [${ALLOWED_TABLES[tableName]}]!`,
        tableName,
        rowData,
        ...extra,
      });
    }

    // Action 3: Update an existing row (identified by its primary key)
    if (action === 'update_data' && tableName) {
      if (!canWrite(tableName, gate.role)) {
        return NextResponse.json({ error: 'الجدول غير صالح للتعديل' }, { status: 400 });
      }
      if (!rowData || typeof rowData !== 'object') {
        return NextResponse.json({ error: 'بيانات السطر غير صالحة' }, { status: 400 });
      }

      const tableColumns = (sqliteDb.prepare(`PRAGMA table_info(${tableName})`).all() as any[]);
      const pkColumn = tableColumns.find(c => c.pk);
      const keyColumn: string = body.keyColumn || pkColumn?.name;
      const keyValue = body.keyValue;

      if (!keyColumn || keyValue === undefined || keyValue === null) {
        return NextResponse.json({ error: 'تعذر تحديد السطر المطلوب تعديله' }, { status: 400 });
      }
      if (!tableColumns.some(c => c.name === keyColumn)) {
        return NextResponse.json({ error: 'عمود المعرّف غير صالح' }, { status: 400 });
      }

      if (tableName === 'packages') normalizePackageInput(rowData);
      const validNames = new Set(tableColumns.map(c => c.name));
      const keys = Object.keys(rowData).filter(k => validNames.has(k) && k !== keyColumn);

      if (keys.length === 0) {
        return NextResponse.json({ error: 'لا توجد حقول قابلة للتعديل' }, { status: 400 });
      }

      const assignments = keys.map(k => `${k} = ?`).join(', ');
      const values = keys.map(k => {
        const v = rowData[k];
        return (typeof v === 'object' && v !== null) ? JSON.stringify(v) : v;
      });

      const info = sqliteDb
        .prepare(`UPDATE ${tableName} SET ${assignments} WHERE ${keyColumn} = ?`)
        .run(...values, keyValue);

      if (info.changes === 0) {
        return NextResponse.json({ error: 'لم يتم العثور على السطر المطلوب' }, { status: 404 });
      }

      if (tableName === 'packages') {
        const pkgId = keyColumn === 'package_id' ? String(keyValue) : String(
          (sqliteDb.prepare(`SELECT package_id FROM packages WHERE ${keyColumn} = ?`).get(keyValue) as any)?.package_id || ''
        );
        if (pkgId) {
          syncPackageDerived(sqliteDb, pkgId);
          keepSingleFeatured(sqliteDb, pkgId, rowData);
        }
      }

      let extra: Record<string, unknown> = {};
      if (tableName === 'morshids') {
        const staff = sqliteDb.prepare('SELECT * FROM morshids WHERE morshid_id = ?').get(keyValue) as any;
        if (staff) extra.login = syncStaffLogin(staff);
      }
      return NextResponse.json({
        success: true,
        message: `✅ تم حفظ التعديلات على [${ALLOWED_TABLES[tableName]}] بنجاح!`,
        tableName,
        updatedFields: keys.length,
        ...extra,
      });
    }

    // Action 4: Delete a row. Two steps: "delete_check" tells the dialog what depends
    // on the row, and "delete_data" only runs with an explicit confirm flag.
    if ((action === 'delete_check' || action === 'delete_data') && tableName) {
      if (!canWrite(tableName, gate.role)) {
        return NextResponse.json({ error: 'الجدول غير صالح للحذف' }, { status: 400 });
      }

      const tableColumns = (sqliteDb.prepare(`PRAGMA table_info(${tableName})`).all() as any[]);
      const pkColumn = tableColumns.find(c => c.pk);
      const keyColumn: string = body.keyColumn || pkColumn?.name;
      const keyValue = body.keyValue;

      if (!keyColumn || keyValue === undefined || keyValue === null) {
        return NextResponse.json({ error: 'تعذر تحديد السطر المطلوب حذفه' }, { status: 400 });
      }
      if (!tableColumns.some(c => c.name === keyColumn)) {
        return NextResponse.json({ error: 'عمود المعرّف غير صالح' }, { status: 400 });
      }

      const target = sqliteDb.prepare(`SELECT * FROM ${tableName} WHERE ${keyColumn} = ?`).get(keyValue) as any;
      if (!target) {
        return NextResponse.json({ error: 'لم يتم العثور على السطر المطلوب' }, { status: 404 });
      }

      const { blocker, notes } = inspectDelete(sqliteDb, tableName, target);

      if (action === 'delete_check') {
        return NextResponse.json({
          success: true,
          canDelete: !blocker,
          blocker,
          notes,
          needsKey: STEP_UP_DELETE_TABLES.has(tableName),
        });
      }

      if (body.confirm !== true) {
        return NextResponse.json(
          { error: 'الحذف يحتاج تأكيداً صريحاً', code: 'CONFIRM_REQUIRED' },
          { status: 400 }
        );
      }
      if (blocker) {
        return NextResponse.json({ error: blocker, code: 'DELETE_BLOCKED' }, { status: 409 });
      }
      if (STEP_UP_DELETE_TABLES.has(tableName)) {
        const denied = requireStepUp(req, gate);
        if (denied) return denied.error;
      }

      const removeRow = sqliteDb.transaction(() => {
        if (tableName === 'packages') {
          sqliteDb.prepare('DELETE FROM package_prices WHERE package_id = ?').run(target.package_id);
        }
        const info = sqliteDb.prepare(`DELETE FROM ${tableName} WHERE ${keyColumn} = ?`).run(keyValue);
        if (tableName === 'morshids' && info.changes > 0) {
          // The staff login must not outlive the staff profile (admin accounts are never touched).
          disableStaffLogin(sqliteDb, target.morshid_id);
        }
        return info;
      });
      const info = removeRow();

      if (info.changes === 0) {
        return NextResponse.json({ error: 'لم يتم العثور على السطر المطلوب' }, { status: 404 });
      }

      writeAudit(
        sqliteDb,
        gate,
        'DELETE_ROW',
        `${tableName}: ${String(target.name || target.title_ar || keyValue)} (${keyColumn}=${String(keyValue)})`,
        req
      );

      return NextResponse.json({
        success: true,
        message: `تم حذف السطر من [${ALLOWED_TABLES[tableName]}] بنجاح`,
        tableName
      });
    }

    return NextResponse.json({ error: 'إجراء غير معروف' }, { status: 400 });
  } catch (error: any) {
    console.error('[db-tables POST]', error);
    const friendly = friendlyDbError(error);
    if (friendly) return NextResponse.json({ error: friendly.message }, { status: friendly.status });
    return NextResponse.json({ error: 'حدث خطأ أثناء معالجة الطلب' }, { status: 500 });
  }
}
