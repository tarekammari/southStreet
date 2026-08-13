import { NextResponse } from 'next/server';
import { getDatabase, saveDatabase } from '@/lib/db';
import { generateNewSecurityKey } from '@/lib/security';

export async function POST() {
  try {
    const db = getDatabase();
    const { keyString, fileContent } = generateNewSecurityKey();

    db.securityKey = keyString;
    saveDatabase(db);

    return NextResponse.json({
      success: true,
      message: 'تم توليد مفتاح أمان جديد بنجاح وتحديث القاعدة المشفرة',
      securityKey: keyString,
      fileContent,
      fileName: 'southstreet_admin.key'
    });
  } catch (error) {
    return NextResponse.json({ error: 'خطأ في توليد مفتاح الأمان' }, { status: 500 });
  }
}
