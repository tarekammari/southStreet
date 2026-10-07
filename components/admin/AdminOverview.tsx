'use client';

import React from 'react';
import { AlertTriangle, CalendarCheck, Cpu, ShieldAlert, UserCheck } from 'lucide-react';
import type { AdminKpis } from '@/components/admin/useAdminKpis';
import type { DashSection } from '@/components/admin/userAccessDashboardHelpers';

export default function AdminOverview({
  kpis,
  onNavigate,
}: {
  kpis: AdminKpis;
  onNavigate: (section: DashSection, opts?: { filter?: string }) => void;
}) {
  const cards = [
    {
      key: 'access',
      label: 'طلبات الوصول',
      value: kpis.pendingAccess,
      hint: kpis.pendingAccess > 0 ? 'بانتظار الموافقة' : 'لا طلبات معلّقة',
      icon: <UserCheck className="w-3.5 h-3.5 text-white/70" />,
      tone: kpis.pendingAccess > 0 ? 'is-alert' : '',
      go: () => onNavigate('users', { filter: 'pending' }),
    },
    {
      key: 'bookings',
      label: 'تأكيدات الحجوزات',
      value: kpis.pendingBookings,
      hint: kpis.pendingBookings > 0 ? 'طلبات عمرة معلّقة' : 'لا حجوزات بانتظار التأكيد',
      icon: <CalendarCheck className="w-3.5 h-3.5 text-white/70" />,
      tone: kpis.pendingBookings > 0 ? 'is-alert' : '',
      go: () => onNavigate('bookings'),
    },
    {
      key: 'security',
      label: 'حوادث أمنية مفتوحة',
      value: kpis.openSecurity,
      hint: kpis.openSecurity > 0 ? 'تهديد / حظر / عالي' : 'لا حوادث مفتوحة ظاهرة',
      icon: <ShieldAlert className="w-3.5 h-3.5 text-white/70" />,
      tone: kpis.openSecurity > 0 ? 'is-danger' : '',
      go: () => onNavigate('security'),
    },
    {
      key: 'server',
      label: 'صحة الخادم',
      value: kpis.serverLabel,
      hint:
        kpis.serverStatus === 'ok'
          ? 'المؤشرات ضمن الحد الآمن'
          : kpis.serverStatus === 'warn'
            ? 'مراقبة مطلوبة'
            : kpis.serverStatus === 'hot'
              ? 'ضغط مرتفع'
              : 'تعذّر القراءة',
      icon: <Cpu className="w-3.5 h-3.5 text-white/70" />,
      tone: kpis.serverStatus === 'hot' ? 'is-danger' : kpis.serverStatus === 'warn' ? 'is-alert' : '',
      go: () => onNavigate('server'),
    },
  ] as const;

  return (
    <div className="adm-overview" dir="rtl">
      <div className="adm-overview-head">
        <h2>نظرة عامة على لوحة الإدارة</h2>
        <p>ملخص فوري من واجهات المستخدمين والحجوزات والأمن وصحة الخادم — بدون كشف أسرار.</p>
      </div>

      <div className="adm-kpi-grid">
        {cards.map((card) => (
          <button
            key={card.key}
            type="button"
            className={`adm-kpi-card ${card.tone}`.trim()}
            onClick={card.go}
          >
            <div className="adm-kpi-label">
              {card.icon}
              {card.label}
            </div>
            <div className="adm-kpi-value">{card.value}</div>
            <div className="adm-kpi-hint">{card.hint}</div>
          </button>
        ))}
      </div>

      <div className="adm-panel">
        <div className="adm-panel-head">
          <div>
            <h2>اختصارات تشغيلية</h2>
            <p>الوصول السريع للأدوات الموجودة دون تغيير منطق الأعمال.</p>
          </div>
          <AlertTriangle className="w-4 h-4 text-white/50" />
        </div>
        <div className="adm-panel-body" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.55rem' }}>
          <button type="button" className="adm-btn adm-btn-primary" onClick={() => onNavigate('users', { filter: 'pending' })}>
            الموافقات
          </button>
          <button type="button" className="adm-btn adm-btn-ghost" onClick={() => onNavigate('bookings')}>
            طلبات العمرة
          </button>
          <button type="button" className="adm-btn adm-btn-ghost" onClick={() => onNavigate('security')}>
            مركز الأمن
          </button>
          <button type="button" className="adm-btn adm-btn-ghost" onClick={() => onNavigate('content')}>
            المحتوى
          </button>
          <button type="button" className="adm-btn adm-btn-ghost" onClick={() => onNavigate('sakhr')}>
            صخر / الذكاء
          </button>
          <button type="button" className="adm-btn adm-btn-ghost" onClick={() => onNavigate('server')}>
            الخادم
          </button>
        </div>
      </div>
    </div>
  );
}
