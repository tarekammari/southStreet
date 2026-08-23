import { NextResponse } from 'next/server';
import { getSqliteDb } from '@/lib/sqlite';
import { getDatabase, saveDatabase, AiKnowledgeRule } from '@/lib/db';
import { getColumnLabelAr } from '@/lib/table-column-labels';

const ALLOWED_TABLES: Record<string, string> = {
  packages: 'باقات العمرة والحج',
  hotels: 'الفنادق المعتمدة',
  morshids: 'المرشدين وطاقم العمل',
  users: 'المستخدمين والحسابات',
  ai_knowledge: 'قواعد معرفة صخر AI',
  seasons: 'المواسم والرحلات',
  messages: 'رسائل الدردشة',
  receipts: 'سندات القبض الرقمية',
  audit_logs: 'سجل تدقيق الأمان',
  agency_settings: 'إعدادات الوكالة',
  page_content: 'محتوى صفحات التطبيق',
  reviews: 'تقييمات المعتمرين',
};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const tableName = searchParams.get('table') || '';

    const db = getSqliteDb();

    if (!tableName) {
      // Return list of available tables with row counts
      const tablesSummary = Object.keys(ALLOWED_TABLES).map(tbl => {
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

    if (!ALLOWED_TABLES[tableName]) {
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

    const rows = db.prepare(`SELECT * FROM ${tableName} ORDER BY 1 DESC LIMIT 150`).all() as any[];

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
      columns,
      totalRows: parsedRows.length,
      rows: parsedRows
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'خطأ في استعلام البيانات' }, { status: 500 });
  }
}

export async function POST(req: Request) {
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
      if (!ALLOWED_TABLES[tableName]) {
        return NextResponse.json({ error: 'الجدول غير صالح للإضافة' }, { status: 400 });
      }

      if (!rowData || typeof rowData !== 'object') {
        return NextResponse.json({ error: 'بيانات السطر غير صالحة' }, { status: 400 });
      }

      const keys = Object.keys(rowData);
      const placeholders = keys.map(() => '?').join(', ');
      const values = keys.map(k => {
        const v = rowData[k];
        return (typeof v === 'object' && v !== null) ? JSON.stringify(v) : v;
      });

      const sql = `INSERT INTO ${tableName} (${keys.join(', ')}) VALUES (${placeholders})`;
      sqliteDb.prepare(sql).run(...values);

      let extra: Record<string, unknown> = {};
      if (tableName === 'morshids') {
        const staffId = rowData.morshid_id;
        if (staffId) {
          const staff = sqliteDb.prepare('SELECT * FROM morshids WHERE morshid_id = ?').get(staffId) as any;
          if (staff) {
            const { ensureStaffLogin } = require('@/lib/accounts') as typeof import('@/lib/accounts');
            extra.login = ensureStaffLogin(staff);
          }
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
      if (!ALLOWED_TABLES[tableName]) {
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

      let extra: Record<string, unknown> = {};
      if (tableName === 'morshids') {
        const staff = sqliteDb.prepare('SELECT * FROM morshids WHERE morshid_id = ?').get(keyValue) as any;
        if (staff) {
          const { ensureStaffLogin } = require('@/lib/accounts') as typeof import('@/lib/accounts');
          extra.login = ensureStaffLogin(staff);
        }
      }
      if (tableName === 'users') {
        const { lookupHash } = require('@/lib/db-crypto') as typeof import('@/lib/db-crypto');
        const { ensureUserAccount } = require('@/lib/accounts') as typeof import('@/lib/accounts');
        const user = sqliteDb.prepare('SELECT * FROM users WHERE id = ?').get(keyValue) as any;
        if (user) {
          extra.login = ensureUserAccount({
            id: user.id,
            name: user.name,
            email: user.email,
            username: user.username,
            role: user.role,
            roleName: user.roleName,
            phone: user.phone,
            staffId: user.staffId,
            issueSecrets: false,
          });
          if (rowData.email || rowData.username || rowData.code) {
            sqliteDb.prepare('UPDATE users SET emailHash = ?, usernameHash = ?, codeHash = ? WHERE id = ?').run(
              user.email ? lookupHash(user.email) : '',
              user.username ? lookupHash(user.username) : '',
              user.code ? lookupHash(user.code) : '',
              user.id
            );
          }
        }
      }

      return NextResponse.json({
        success: true,
        message: `✅ تم حفظ التعديلات على [${ALLOWED_TABLES[tableName]}] بنجاح!`,
        tableName,
        updatedFields: keys.length,
        ...extra,
      });
    }

    // Action 4: Delete a row (identified by its primary key)
    if (action === 'delete_data' && tableName) {
      if (!ALLOWED_TABLES[tableName]) {
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

      const info = sqliteDb
        .prepare(`DELETE FROM ${tableName} WHERE ${keyColumn} = ?`)
        .run(keyValue);

      if (info.changes === 0) {
        return NextResponse.json({ error: 'لم يتم العثور على السطر المطلوب' }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        message: `تم حذف السطر من [${ALLOWED_TABLES[tableName]}] بنجاح`,
        tableName
      });
    }

    return NextResponse.json({ error: 'إجراء غير معروف' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'حدث خطأ أثناء معالجة الطلب' }, { status: 500 });
  }
}
