import { NextResponse } from 'next/server';
import { getDatabase, saveDatabase, AiKnowledgeRule } from '@/lib/db';

export async function GET() {
  try {
    const db = getDatabase();
    return NextResponse.json({ rules: db.aiKnowledge || [] });
  } catch (error) {
    return NextResponse.json({ error: 'خطأ في جلب قواعد المعرفة' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { category, title_ar, keywords, response_ar } = await req.json();

    if (!title_ar || !response_ar || !keywords || keywords.length === 0) {
      return NextResponse.json({ error: 'جميع حقول قاعدة المعرفة مطلوبة' }, { status: 400 });
    }

    const db = getDatabase();
    const newRule: AiKnowledgeRule = {
      id: `rule_${Date.now()}`,
      category: category || 'faq',
      title_ar: title_ar.trim(),
      keywords: Array.isArray(keywords) ? keywords.map((k: string) => k.trim().toLowerCase()) : [keywords],
      response_ar: response_ar.trim(),
      is_active: true,
      updatedBy: 'admin@southstreet.dz',
      updatedAt: new Date().toISOString()
    };

    db.aiKnowledge.unshift(newRule);
    saveDatabase(db);

    return NextResponse.json({ success: true, message: 'تم إضافة قاعدة المعرفة بنجاح', rule: newRule });
  } catch (error) {
    return NextResponse.json({ error: 'خطأ في إضافة قاعدة المعرفة' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const { id, category, title_ar, keywords, response_ar, is_active, qualityRating, modelAnswer } = await req.json();

    if (!id) {
      return NextResponse.json({ error: 'معرف القاعدة مطلوب' }, { status: 400 });
    }

    const db = getDatabase();
    const rule = db.aiKnowledge.find(r => r.id === id);
    if (!rule) {
      return NextResponse.json({ error: 'القاعدة غير موجودة' }, { status: 404 });
    }

    if (category) rule.category = category;
    if (title_ar) rule.title_ar = title_ar.trim();
    if (keywords) rule.keywords = Array.isArray(keywords) ? keywords.map((k: string) => k.trim().toLowerCase()) : [keywords];
    if (response_ar) rule.response_ar = response_ar.trim();
    if (typeof is_active === 'boolean') rule.is_active = is_active;
    if (qualityRating !== undefined) rule.qualityRating = qualityRating;
    if (modelAnswer !== undefined) rule.modelAnswer = modelAnswer.trim();
    rule.updatedAt = new Date().toISOString();

    saveDatabase(db);

    return NextResponse.json({ success: true, message: 'تم تحديث قاعدة المعرفة بنجاح', rule });
  } catch (error) {
    return NextResponse.json({ error: 'خطأ في تعديل قاعدة المعرفة' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'معرف القاعدة مطلوب' }, { status: 400 });
    }

    const db = getDatabase();
    db.aiKnowledge = db.aiKnowledge.filter(r => r.id !== id);
    saveDatabase(db);

    return NextResponse.json({ success: true, message: 'تم حذف القاعدة بنجاح' });
  } catch (error) {
    return NextResponse.json({ error: 'خطأ في حذف قاعدة المعرفة' }, { status: 500 });
  }
}
