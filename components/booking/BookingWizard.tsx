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
import { Package, Reservation } from '@/types';
import {
  BOOKING_EXTRAS,
  DEPOSIT_PERCENT,
  ROOM_LABELS,
  isActiveReservation,
} from '@/lib/booking-catalog';
import ExistingBookingPanel from '@/components/booking/ExistingBookingPanel';
import BookingPrintButton from '@/components/booking/BookingPrintButton';

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

function authHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('south_street_token') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function BookingWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillPackage = searchParams.get('package') || '';
  const editId = searchParams.get('edit') || '';

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
  const [existing, setExisting] = useState<Reservation | null>(null);
  const [screen, setScreen] = useState<'manage' | 'wizard'>('wizard');
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [booting, setBooting] = useState(true);

  const applyReservation = (res: Reservation) => {
    setExisting(res);
    setPackageId(res.package_id);
    setRoomType(res.room_type);
    setExtraIds((res.extras || []).map((item) => item.id));
    setName(res.customer_name || '');
    setPhone(res.customer_phone || '');
    setEmail(res.customer_email || '');
    setPassport(res.travelers?.[0]?.passport_number || '');
  };

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
        if (u.name) setName((prev) => prev || u.name);
        if (u.phone) setPhone((prev) => prev || u.phone);
        if (u.email) setEmail((prev) => prev || u.email);
      }
    } catch {
      /* ignore */
    }

    const token = localStorage.getItem('south_street_token');
    if (!token) {
      setBooting(false);
      return;
    }
    fetch('/api/bookings', { headers: authHeaders() })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const active = data?.activeReservation || (data?.reservations || []).find((row: Reservation) => isActiveReservation(row.status));
        if (!active) return;
        if (editId) {
          applyReservation(active);
          setScreen('wizard');
          return;
        }
        applyReservation(active);
        setScreen('manage');
      })
      .catch(() => {})
      .finally(() => setBooting(false));
  }, [editId]);

  useEffect(() => {
    if (prefillPackage && screen === 'wizard' && !existing) setPackageId(prefillPackage);
  }, [prefillPackage, screen, existing]);

  const selected = packages.find((p) => p.package_id === packageId) || null;
  const roomPrices = selected?.prices || [];
  const editing = Boolean(existing && screen === 'wizard' && (editId || existing));

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
  const previousPaid = existing && editing ? Number(existing.paid_amount) || 0 : Math.round(total * DEPOSIT_PERCENT);
  const remaining = Math.max(0, total - (existing && editing ? previousPaid : Math.round(total * DEPOSIT_PERCENT)));
  const deposit = existing && editing ? previousPaid : Math.round(total * DEPOSIT_PERCENT);
  const priceDelta = existing && editing ? total - Number(existing.total_amount || 0) : 0;

  const printDraft = useMemo(() => ({
    packageId,
    roomType,
    extraIds,
    name: name.trim(),
    phone: phone.trim(),
    email: email.trim(),
  }), [packageId, roomType, extraIds, name, phone, email]);

  const printTypeForStep = (s: number): 'quote' | 'request' | 'invoice' => {
    if (s <= 2) return 'quote';
    if (s === 3) return 'request';
    return 'invoice';
  };

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
      if (!loggedIn && !editing && password.trim().length < 8) {
        setError('أنشئ كلمة مرور من 8 أحرف على الأقل لدخول حسابك بعد التأكيد');
        return;
      }
    }
    setStep((s) => Math.min(4, s + 1));
  };

  const adoptSession = (data: any) => {
    if (data.token && data.user) {
      localStorage.setItem('south_street_token', data.token);
      localStorage.setItem('south_street_user', JSON.stringify(data.user));
      setLoggedIn(true);
    }
  };

  const confirm = async () => {
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        packageId,
        roomType,
        extraIds,
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        password,
        passport: passport.trim(),
        reservationId: existing?.reservation_id,
      };
      const res = await fetch('/api/bookings', {
        method: editing && existing ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(),
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.status === 409 && data.code === 'EXISTING_BOOKING' && data.reservation) {
        adoptSession(data);
        applyReservation(data.reservation);
        setScreen('manage');
        setError('');
        return;
      }
      if (!res.ok) {
        setError(data.error || 'تعذّر تأكيد الحجز');
        return;
      }
      adoptSession(data);
      if (data.reservation) applyReservation(data.reservation);
      window.dispatchEvent(new CustomEvent('southstreet:bookings-updated'));
      router.push(data.user?.redirect || '/portal?tab=reservations');
    } catch {
      setError('تعذّر الاتصال بالخادم. حاول مرة أخرى.');
    } finally {
      setSubmitting(false);
    }
  };

  const cancelBooking = async () => {
    if (!existing) return;
    setCancelling(true);
    setError('');
    try {
      const res = await fetch(`/api/bookings?id=${encodeURIComponent(existing.reservation_id)}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'تعذّر إلغاء الطلب');
        return;
      }
      setExisting(null);
      setConfirmCancel(false);
      setScreen('wizard');
      setStep(1);
      window.dispatchEvent(new CustomEvent('southstreet:bookings-updated'));
      router.replace(prefillPackage ? `/book?package=${encodeURIComponent(prefillPackage)}` : '/book');
    } catch {
      setError('تعذّر إلغاء الطلب. حاول مرة أخرى.');
    } finally {
      setCancelling(false);
    }
  };

  if (booting) {
    return (
      <div className="book-wizard" dir="rtl">
        <p className="text-sm text-slate-500 py-10 text-center">جاري التحقق من طلبك...</p>
      </div>
    );
  }

  if (screen === 'manage' && existing) {
    return (
      <div className="book-wizard" dir="rtl">
        {error ? <p className="book-error" role="alert">{error}</p> : null}
        <ExistingBookingPanel
          reservation={existing}
          cancelling={cancelling}
          confirmCancel={confirmCancel}
          onAskCancel={() => setConfirmCancel(true)}
          onAbortCancel={() => setConfirmCancel(false)}
          onConfirmCancel={cancelBooking}
          onModify={() => {
            applyReservation(existing);
            setScreen('wizard');
            setStep(1);
            router.replace(`/book?edit=${encodeURIComponent(existing.reservation_id)}`);
          }}
        />
      </div>
    );
  }

  return (
    <div className="book-wizard" dir="rtl">
      {editing ? (
        <p className="book-edit-banner">تعديل الطلب {existing?.reservation_number} — راجع الخيارات ثم احفظ الفاتورة الجديدة</p>
      ) : null}
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
            <h2>{editing ? 'غيّر برنامج العمرة' : 'اختر برنامج العمرة'}</h2>
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
            <p>السعر الأساسي حسب نوع الغرفة. أضف أو أزل ما تحتاجه — الفاتورة تتحدّث فوراً.</p>
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
              {editing
                ? 'حدّث الاسم أو الهاتف أو الجواز. الحساب يبقى نفسه.'
                : loggedIn
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
              <input value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" dir="ltr" disabled={editing} />
            </label>
            <label>
              رقم الجواز <span className="text-slate-400 font-medium">(اختياري الآن)</span>
              <input value={passport} onChange={(e) => setPassport(e.target.value)} dir="ltr" />
            </label>
            {!loggedIn && !editing ? (
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
            <h2>{editing ? 'راجع الفاتورة بعد التعديل' : 'راجع الفاتورة ثم أكّد'}</h2>
            <p>
              {editing
                ? 'المبلغ الذي دفعته سابقاً يبقى محسوباً بعد تأكيد الوكالة. يظهر فقط الفرق إن وُجد.'
                : `بعد إرسال الطلب تراجعه الوكالة خلال 24–48 ساعة. الدفعة الأولى ${Math.round(DEPOSIT_PERCENT * 100)}٪ بعد التأكيد.`}
            </p>
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
              {editing ? (
                <>
                  <div><dt>المدفوع سابقاً</dt><dd>{money(deposit)}</dd></div>
                  <div><dt>{priceDelta > 0 ? 'فرق يجب تسديده' : priceDelta < 0 ? 'رصيد على الطلب' : 'لا يوجد فرق سعر'}</dt><dd>{money(Math.abs(priceDelta))}</dd></div>
                  <div><dt>المتبقي قبل السفر</dt><dd>{money(remaining)}</dd></div>
                </>
              ) : (
                <>
                  <div><dt>دفعة التأكيد ({Math.round(DEPOSIT_PERCENT * 100)}٪)</dt><dd>{money(deposit)}</dd></div>
                  <div><dt>المتبقي قبل السفر</dt><dd>{money(remaining)}</dd></div>
                </>
              )}
            </dl>
          </div>
        </section>
      )}

      <div className="book-nav">
        <div className="flex flex-wrap gap-2 items-center">
          {step >= 1 && selected ? (
            <BookingPrintButton
              type={printTypeForStep(step)}
              step={step}
              draft={printDraft}
              reservationId={existing?.reservation_id}
              disabled={step === 1 && !selected}
            />
          ) : null}
        </div>
        <div className="flex gap-2 items-center">
        {step > 1 || editing ? (
          <button
            type="button"
            className="book-btn book-btn-ghost"
            onClick={() => {
              setError('');
              if (step > 1) {
                setStep((s) => s - 1);
                return;
              }
              if (existing) {
                setScreen('manage');
                router.replace('/book');
              }
            }}
          >
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
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : editing ? <Receipt className="w-4 h-4" /> : loggedIn ? <Receipt className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
            {submitting ? 'جاري الحفظ...' : editing ? 'حفظ التعديل' : 'إرسال الطلب للوكالة'}
          </button>
        )}
        </div>
      </div>
    </div>
  );
}
