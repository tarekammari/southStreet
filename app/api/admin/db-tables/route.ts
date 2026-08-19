import { NextResponse } from 'next/server';
import { getSqliteDb } from '@/lib/sqlite';
import { getDatabase, saveDatabase, AiKnowledgeRule } from '@/lib/db';

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
  page_content: 'محتوى صفحات التطبيق'
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
      pk: Boolean(c.pk)
    }));

    const rows = db.prepare(`SELECT * FROM ${tableName} ORDER BY 1 DESC LIMIT 150`).all() as any[];

    // Parse JSON fields if present
    const parsedRows = rows.map(r => {
      const obj = { ...r };
      for (const [key, val] of Object.entries(obj)) {
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

      return NextResponse.json({
        success: true,
        message: `✅ تم إضافة السطر الجديد بنجاح في جدول [${ALLOWED_TABLES[tableName]}]!`,
        tableName,
        rowData
      });
    }

    return NextResponse.json({ error: 'إجراء غير معروف' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'حدث خطأ أثناء معالجة الطلب' }, { status: 500 });
  }
}
