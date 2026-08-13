import { NextResponse } from 'next/server';
import { getDatabase, saveDatabase, UserAccount } from '@/lib/db';
import { hashPassword } from '@/lib/security';

// GET: Fetch all user accounts, active sessions, and access requests
export async function GET() {
  try {
    const db = getDatabase();
    return NextResponse.json({
      users: db.users.map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        status: u.status,
        createdAt: u.createdAt,
        lastLoginIp: u.lastLoginIp || 'N/A',
        pcFingerprint: u.pcFingerprint || 'FP-SYSTEM-INIT'
      })),
      sessions: db.sessions,
      accessRequests: db.accessRequests,
      securityKey: db.securityKey
    });
  } catch (error) {
    return NextResponse.json({ error: 'خطأ في جلب بيانات المستخدمين' }, { status: 500 });
  }
}

// POST: Create a new User Account
export async function POST(req: Request) {
  try {
    const { name, email, password, role, status } = await req.json();

    const cleanName = (name || '').trim();
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPassword = (password || '').trim();
    const cleanRole = role || 'PILGRIM_USER';
    const cleanStatus = status || 'APPROVED';

    if (!cleanName || !cleanEmail || !cleanPassword) {
      return NextResponse.json({ error: 'جميع الحقول مطلوبة' }, { status: 400 });
    }

    const db = getDatabase();
    const existing = db.users.find(u => u.email.toLowerCase() === cleanEmail);
    if (existing) {
      return NextResponse.json({ error: 'هذا البريد الإلكتروني مسجل بالفعل' }, { status: 400 });
    }

    const newUser: UserAccount = {
      id: `usr_${Date.now()}`,
      name: cleanName,
      email: cleanEmail,
      passwordHash: hashPassword(cleanPassword),
      role: cleanRole,
      status: cleanStatus,
      createdAt: new Date().toISOString(),
      requiresFileKey: cleanRole === 'SUPER_ADMIN' || cleanRole === 'AGENCY_MANAGER'
    };

    db.users.push(newUser);
    saveDatabase(db);

    return NextResponse.json({
      success: true,
      message: 'تم إنشاء الحساب بنجاح في النظام المشفر',
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        status: newUser.status
      }
    });
  } catch (error) {
    return NextResponse.json({ error: 'خطأ في إنشاء الحساب' }, { status: 500 });
  }
}

// PATCH: Approve / Reject / Suspend User Access
export async function PATCH(req: Request) {
  try {
    const { userId, status } = await req.json();

    if (!userId || !status) {
      return NextResponse.json({ error: 'معرف المستخدم والحالة مطلوبان' }, { status: 400 });
    }

    const db = getDatabase();
    const user = db.users.find(u => u.id === userId);
    if (!user) {
      return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 });
    }

    user.status = status;

    // Update corresponding access request status if present
    const reqIndex = db.accessRequests.findIndex(r => r.userId === userId);
    if (reqIndex !== -1) {
      db.accessRequests[reqIndex].status = status === 'APPROVED' ? 'APPROVED' : 'REJECTED';
    }

    saveDatabase(db);

    return NextResponse.json({
      success: true,
      message: `تم تحديث حالة الحساب إلى (${status}) بنجاح`,
      userId,
      status
    });
  } catch (error) {
    return NextResponse.json({ error: 'خطأ في تحديث صلاحية الحساب' }, { status: 500 });
  }
}
