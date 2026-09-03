'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle,
  Plane,
  MapPin,
  Calendar,
  UserRound,
  Lock,
  Receipt,
  Loader2,
} from 'lucide-react';
import { Package } from '@/types';
import { BOOKING_EXTRAS, DEPOSIT_PERCENT, ROOM_LABELS } from '@/lib/booking-catalog';

const STEPS = [
  { id: 1, label: 'الباقة' },
  { id: 2, label: 'الغرفة والإضافات' },
  { id: 3, label: 'بياناتك' },
  { id: 4, label: 'الفاتورة' },
];

function isAvailablePackage(pkg: { status?: string; published?: boolean }): boolean {
  const status = String(pkg.status || '').toUpperCase();
  if (status === 'UPCOMING' || status === 'DRAFT' || status === 'CLOSED' || status === 'FULL') return false;
  return pkg.published !== false && (status === 'PUBLISHED' || status === 'OPEN' || status === 'CURRENT' || !status);
}

function formatDate(value?: string): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('ar-DZ', { year: 'numeric', month: 'long', day: 'numeric' });
}

function money(n: number): string {
  return `${n.toLocaleString('ar-DZ')} دج`;
}

export default function BookingWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillPackage = searchParams.get('package') || '';

  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1);
  const [packageId, setPackageId] = useState(prefillPackage);
  const [roomType, setRoomType] = useState('');
  const [extraIds, setExtraIds] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [passport, setPassport] = useState('');
  const [password, setPassword] = useState('');
  const [loggedIn, setLoggedIn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/admin/packages')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setPackages(data.filter(isAvailablePackage));
      })
      .catch(() => setPackages([]))
      .finally(() => setLoading(false));

    try {
      const session = localStorage.getItem('south_street_user');
      if (session) {
        const u = JSON.parse(session);
        setLoggedIn(true);
        if (u.name) setName(u.name);
        if (u.phone) setPhone(u.phone);
        if (u.email) setEmail(u.email);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (prefillPackage) setPackageId(prefillPackage);
  }, [prefillPackage]);

  const selected = packages.find((p) => p.package_id === packageId) || null;
  const roomPrices = selected?.prices || [];

  useEffect(() => {
    if (!selected) return;
    const prices = selected.prices || [];
    if (!prices.length) return;
    const stillValid = prices.some((p) => p.room_type === roomType);
    if (!stillValid) {
      const cheapest = [...prices].sort((a, b) => a.amount - b.amount)[0];
      setRoomType(cheapest.room_type);
    }
  }, [selected, roomType]);

  const roomAmount = useMemo(() => {
    const match = roomPrices.find((p) => p.room_type === roomType);
    return match ? Number(match.amount) : 0;
  }, [roomPrices, roomType]);

  const selectedExtras = BOOKING_EXTRAS.filter((item) => extraIds.includes(item.id));
  const extrasTotal = selectedExtras.reduce((sum, item) => sum + item.price, 0);
  const total = roomAmount + extrasTotal;
  const deposit = Math.round(total * DEPOSIT_PERCENT);
  const remaining = total - deposit;

  const toggleExtra = (id: string) => {
    setExtraIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const goNext = () => {
    setError('');
    if (step === 1 && !selected) {
      setError('اختر باقة العمرة للمتابعة');
      return;
    }
    if (step === 2 && (!roomType || !roomAmount)) {
      setError('اختر نوع الغرفة');
      return;
    }
    if (step === 3) {
      if (name.trim().length < 4) {
        setError('أدخل الاسم الكامل كما في الجواز');
        return;
      }
      if (!phone.trim()) {
        setError('رقم الهاتف مطلوب');
        return;
      }
      if (!email.includes('@')) {
        setError('أدخل بريداً إلكترونياً صحيحاً');
        return;
      }
      if (!loggedIn && password.trim().length < 8) {
        setError('أنشئ كلمة مرور من 8 أحرف على الأقل لدخول حسابك بعد التأكيد');
        return;
      }
    }
    setStep((s) => Math.min(4, s + 1));
  };

  const confirm = async () => {
    setSubmitting(true);
    setError('');
    try {
      const token = localStorage.getItem('south_street_token');
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          packageId,
          roomType,
          extraIds,
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim(),
          password,
          passport: passport.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'تعذّر تأكيد الحجز');
        return;
      }
      if (data.token && data.user) {
        localStorage.setItem('south_street_token', data.token);
        localStorage.setItem('south_street_user', JSON.stringify(data.user));
      }
      router.push(data.user?.redirect || '/portal?tab=program');
    } catch {
      setError('تعذّر الاتصال بالخادم. حاول مرة أخرى.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="book-wizard" dir="rtl">
      <ol className="book-steps" aria-label="خطوات الحجز">
        {STEPS.map((item) => (
          <li key={item.id} className={`book-step ${step === item.id ? 'is-current' : ''} ${step > item.id ? 'is-done' : ''}`}>
            <span className="book-step-num">{step > item.id ? <Check className="w-3.5 h-3.5" /> : item.id}</span>
            <span className="book-step-label">{item.label}</span>
          </li>
        ))}
      </ol>

      {error ? <p className="book-error" role="alert">{error}</p> : null}

      {step === 1 && (
        <section className="space-y-4">
          <header className="book-section-head">
            <h2>اختر برنامج العمرة</h2>
            <p>خطوة واحدة: الباقة التي تناسب تاريخك وميزانيتك. الأسعار لكل معتمر.</p>
          </header>
          {loading ? (
            <p className="text-sm text-slate-500 py-10 text-center">جاري تحميل البرامج...</p>
          ) : packages.length === 0 ? (
            <p className="text-sm text-slate-500 py-10 text-center">لا توجد باقات مفتوحة للحجز حالياً.</p>
          ) : (
            <div className="book-pkg-grid">
              {packages.map((pkg) => {
                const from = pkg.prices?.length ? Math.min(...pkg.prices.map((p) => p.amount)) : 0;
                const active = pkg.package_id === packageId;
                return (
                  <button
                    key={pkg.package_id}
                    type="button"
                    className={`book-pkg ${active ? 'is-active' : ''}`}
                    onClick={() => setPackageId(pkg.package_id)}
                  >
                    <span className="book-pkg-type">{pkg.type}</span>
                    <h3>{pkg.name}</h3>
                    <ul>
                      {pkg.start_date ? <li><Calendar className="w-3.5 h-3.5" /> {formatDate(pkg.start_date)}</li> : null}
                      <li><Plane className="w-3.5 h-3.5" /> {pkg.airline}</li>
                      <li><MapPin className="w-3.5 h-3.5" /> {pkg.makkah_hotel_name}</li>
                    </ul>
                    <strong className="book-pkg-price">من {money(from)}</strong>
                    {active ? <span className="book-picked"><CheckCircle className="w-3.5 h-3.5" /> مختارة</span> : null}
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}

      {step === 2 && selected && (
        <section className="space-y-6">
          <header className="book-section-head">
            <h2>الغرفة والخدمات الإضافية</h2>
            <p>السعر الأساسي حسب نوع الغرفة. أضف فقط ما تحتاجه — كل إضافة تظهر لاحقاً في الفاتورة.</p>
          </header>
          <div className="book-room-grid">
            {roomPrices.map((price) => (
              <button
                key={price.room_type}
                type="button"
                className={`book-choice ${roomType === price.room_type ? 'is-active' : ''}`}
                onClick={() => setRoomType(price.room_type)}
              >
                <span>{ROOM_LABELS[price.room_type] || price.room_type}</span>
                <strong>{money(price.amount)}</strong>
              </button>
            ))}
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800 mb-3">إضافات اختيارية</h3>
            <div className="book-extra-list">
              {BOOKING_EXTRAS.map((item) => {
                const on = extraIds.includes(item.id);
                return (
                  <label key={item.id} className={`book-extra ${on ? 'is-active' : ''}`}>
                    <input type="checkbox" checked={on} onChange={() => toggleExtra(item.id)} />
                    <span>
                      <strong>{item.title}</strong>
                      <em>{item.detail}</em>
                    </span>
                    <b>{money(item.price)}</b>
                  </label>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="space-y-4">
          <header className="book-section-head">
            <h2>بيانات المعتمر</h2>
            <p>
              {loggedIn
                ? 'سنربط هذا الحجز بحسابك الحالي بعد التأكيد.'
                : 'بعد التأكيد يُفتح لك حساب معتمر لرؤية البرنامج والطيران والمرشد والمحادثة.'}
            </p>
          </header>
          <div className="book-form">
            <label>
              الاسم الكامل (كما في الجواز)
              <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </label>
            <label>
              الهاتف
              <input value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" dir="ltr" />
            </label>
            <label>
              البريد الإلكتروني
              <input value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" dir="ltr" />
            </label>
            <label>
              رقم الجواز <span className="text-slate-400 font-medium">(اختياري الآن)</span>
              <input value={passport} onChange={(e) => setPassport(e.target.value)} dir="ltr" />
            </label>
            {!loggedIn ? (
              <label className="sm:col-span-2">
                كلمة مرور حسابك
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
                <small>ستستخدمها لدخول بوابة المعتمر بعد تأكيد الطلب.</small>
              </label>
            ) : null}
          </div>
        </section>
      )}

      {step === 4 && selected && (
        <section className="space-y-5">
          <header className="book-section-head">
            <h2>راجع الفاتورة ثم أكّد</h2>
            <p>الدفعة الأولى {Math.round(DEPOSIT_PERCENT * 100)}٪ لتثبيت المقعد. المتبقي يُسدَّد قبل السفر.</p>
          </header>
          <div className="book-invoice">
            <div className="book-invoice-meta">
              <p><UserRound className="w-4 h-4" /> {name}</p>
              <p><Plane className="w-4 h-4" /> {selected.name}</p>
              <p><Calendar className="w-4 h-4" /> {formatDate(selected.start_date)} — {formatDate(selected.end_date)}</p>
            </div>
            <table>
              <tbody>
                <tr>
                  <td>
                    {ROOM_LABELS[roomType] || roomType}
                    <small>{selected.duration_days} يوماً · {selected.airline}</small>
                  </td>
                  <td>{money(roomAmount)}</td>
                </tr>
                {selectedExtras.map((item) => (
                  <tr key={item.id}>
                    <td>
                      {item.title}
                      <small>{item.detail}</small>
                    </td>
                    <td>{money(item.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <dl>
              <div><dt>المجموع</dt><dd>{money(total)}</dd></div>
              <div><dt>دفعة التأكيد ({Math.round(DEPOSIT_PERCENT * 100)}٪)</dt><dd>{money(deposit)}</dd></div>
              <div><dt>المتبقي قبل السفر</dt><dd>{money(remaining)}</dd></div>
            </dl>
          </div>
        </section>
      )}

      <div className="book-nav">
        {step > 1 ? (
          <button type="button" className="book-btn book-btn-ghost" onClick={() => { setError(''); setStep((s) => s - 1); }}>
            <ArrowRight className="w-4 h-4" /> السابق
          </button>
        ) : (
          <span />
        )}
        {step < 4 ? (
          <button type="button" className="book-btn book-btn-primary" onClick={goNext} disabled={loading}>
            التالي <ArrowLeft className="w-4 h-4" />
          </button>
        ) : (
          <button type="button" className="book-btn book-btn-primary" onClick={confirm} disabled={submitting}>
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : loggedIn ? <Receipt className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
            {submitting ? 'جاري التأكيد...' : 'تأكيد الحجز وفتح حسابي'}
          </button>
        )}
      </div>
    </div>
  );
}
