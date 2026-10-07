'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Car,
  Check,
  CheckCircle,
  Droplets,
  FileCheck,
  Moon,
  Plane,
  MapPin,
  Calendar,
  Accessibility,
  Shield,
  UserRound,
  Loader2,
} from 'lucide-react';
import { Package, Reservation } from '@/types';
import {
  BOOKING_EXTRAS,
  DEPOSIT_PERCENT,
  ROOM_LABELS,
  isActiveReservation,
  isPackageExpired,
  roomOccupancy,
} from '@/lib/booking-catalog';
import ExistingBookingPanel from '@/components/booking/ExistingBookingPanel';
import BookingPrintButton from '@/components/booking/BookingPrintButton';
import GoogleContinueButton from '@/components/GoogleContinueButton';
import { authHeaders, getAuthToken, apiFetch, jsonAuthHeaders } from '@/lib/api-client';
import {
  STEPS,
  type ViewId,
  EXTRA_ICONS,
  RoomPeople,
  isAvailablePackage,
  formatDate,
  formatShortDate,
  money,
  phaseOf,
  PriceFocus,
  PriceBar,
} from '@/components/booking/wizardHelpers';

export default function BookingWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillPackage = searchParams.get('package') || '';
  const editId = searchParams.get('edit') || '';
  const trackRef = (searchParams.get('ref') || '').trim();
  const onBehalf = searchParams.get('onBehalf') === '1';

  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewId>('packages');
  const [extraIndex, setExtraIndex] = useState(0);
  const [packageId, setPackageId] = useState(prefillPackage);
  const [roomType, setRoomType] = useState('');
  const [extraIds, setExtraIds] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [passport, setPassport] = useState('');
  const [password, setPassword] = useState('');
  const [googleIdToken, setGoogleIdToken] = useState('');
  const [loggedIn, setLoggedIn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [existing, setExisting] = useState<Reservation | null>(null);
  const [screen, setScreen] = useState<'manage' | 'wizard'>('wizard');
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [booting, setBooting] = useState(true);

  const resetChoicesView = () => {
    setView('packages');
    setExtraIndex(0);
  };

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
      if (session && !onBehalf) {
        const u = JSON.parse(session);
        setLoggedIn(true);
        if (u.name) setName((prev) => prev || u.name);
        if (u.phone) setPhone((prev) => prev || u.phone);
        if (u.email) setEmail((prev) => prev || u.email);
      }
    } catch {
      /* ignore */
    }

    const token = getAuthToken();
    if (!token || onBehalf) {
      setBooting(false);
      return;
    }
    const bootTimer = window.setTimeout(() => setBooting(false), 8000);
    fetch('/api/bookings', { headers: authHeaders() })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const list: Reservation[] = data?.reservations || [];
        const wanted = trackRef.toUpperCase();
        const byRef = wanted
          ? list.find((row) => String(row.reservation_number || '').toUpperCase() === wanted)
            || (data?.activeReservation && String(data.activeReservation.reservation_number || '').toUpperCase() === wanted
              ? data.activeReservation
              : null)
          : null;
        const active = byRef || data?.activeReservation || list.find((row) => isActiveReservation(row.status));
        if (!active) return;
        if (editId) {
          applyReservation(active);
          setScreen('wizard');
          setView('packages');
          return;
        }
        applyReservation(active);
        setScreen('manage');
      })
      .catch(() => {})
      .finally(() => {
        window.clearTimeout(bootTimer);
        setBooting(false);
      });
  }, [editId, trackRef, onBehalf]);

  useEffect(() => {
    if (prefillPackage && screen === 'wizard' && !existing) {
      const pkg = packages.find((p) => p.package_id === prefillPackage);
      if (pkg && isPackageExpired(pkg)) {
        setPackageId('');
        return;
      }
      setPackageId(prefillPackage);
    }
  }, [prefillPackage, screen, existing, packages]);

  const selected = packages.find((p) => p.package_id === packageId) || null;
  const otherPackages = packages.filter((p) => p.package_id !== packageId);
  const roomPrices = useMemo(() => selected?.prices || [], [selected]);
  const editing = Boolean(existing && screen === 'wizard' && (editId || existing));
  const step = phaseOf(view);
  const offerExtras = useMemo(() => {
    const rows = selected?.annex_options;
    if (!rows?.length) return BOOKING_EXTRAS;
    const enabled = rows.filter((row) => row.enabled !== false);
    return enabled.length ? enabled : BOOKING_EXTRAS;
  }, [selected]);
  const currentExtra = offerExtras[extraIndex] || null;

  const selectPackage = (id: string) => {
    const pkg = packages.find((p) => p.package_id === id);
    if (pkg && isPackageExpired(pkg)) {
      setError('هذا البرنامج انتهى ولا يمكن اختياره');
      return;
    }
    setError('');
    setPackageId(id);
    setExtraIndex(0);
    const params = new URLSearchParams(searchParams.toString());
    params.set('package', id);
    router.replace(`/book?${params.toString()}`, { scroll: false });
  };

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

  const selectedExtras = offerExtras.filter((item) => extraIds.includes(item.id));
  const extrasTotal = selectedExtras.reduce((sum, item) => sum + item.price, 0);
  const total = roomAmount + extrasTotal;
  const fromPrice = selected?.prices?.length ? Math.min(...selected.prices.map((p) => p.amount)) : 0;
  const displayPrice = roomAmount ? total : fromPrice;
  const priceIsFrom = !roomAmount;
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

  const setExtraChoice = (id: string, on: boolean) => {
    setExtraIds((prev) => {
      const has = prev.includes(id);
      if (on && !has) return [...prev, id];
      if (!on && has) return prev.filter((x) => x !== id);
      return prev;
    });
  };

  const goNext = () => {
    setError('');
    if ((view === 'offer' || view === 'packages') && !selected) {
      setError('اختر باقة العمرة للمتابعة');
      return;
    }
    if (selected && isPackageExpired(selected)) {
      setError('هذا البرنامج انتهى ولا يمكن حجزه');
      return;
    }
    if (view === 'packages' || view === 'offer') {
      setView('room');
      return;
    }
    if (view === 'room') {
      if (!roomType || !roomAmount) {
        setError('اختر نوع الغرفة');
        return;
      }
      if (offerExtras.length) {
        setExtraIndex(0);
        setView('extra');
        return;
      }
      setView('details');
      return;
    }
    if (view === 'extra') {
      if (extraIndex < offerExtras.length - 1) {
        setExtraIndex((i) => i + 1);
        return;
      }
      setView('details');
      return;
    }
    if (view === 'details') {
      if (name.trim().length < 4) {
        setError(onBehalf ? 'أدخل اسم العميل' : 'أدخل اسمك');
        return;
      }
      if (!phone.trim()) {
        setError('رقم الهاتف مطلوب');
        return;
      }
      if (onBehalf) {
        if (!getAuthToken()) {
          setError('سجّل الدخول كمحاسب أولاً ثم أعد المحاولة');
          return;
        }
      } else if (!loggedIn && !editing && !googleIdToken) {
        setError('اربط حساب جوجل للمتابعة');
        return;
      }
      setView('invoice');
    }
  };

  const goBack = () => {
    setError('');
    if (view === 'extra' && extraIndex > 0) {
      setExtraIndex((i) => i - 1);
      return;
    }
    if (view === 'extra') {
      setView('room');
      return;
    }
    if (view === 'room' || view === 'offer') {
      setView('packages');
      return;
    }
    if (view === 'packages') {
      if (existing) {
        setScreen('manage');
        router.replace('/book');
      }
      return;
    }
    if (view === 'details') {
      if (offerExtras.length) {
        setExtraIndex(offerExtras.length - 1);
        setView('extra');
        return;
      }
      setView('room');
      return;
    }
    if (view === 'invoice') {
      setView('details');
      return;
    }
    if (existing) {
      setScreen('manage');
      router.replace('/book');
    }
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
        googleIdToken: onBehalf ? '' : googleIdToken,
        onBehalf: onBehalf || undefined,
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
        if (!onBehalf) adoptSession(data);
        applyReservation(data.reservation);
        setScreen('manage');
        setError('');
        return;
      }
      if (!res.ok) {
        setError(data.error || 'تعذّر تأكيد الحجز');
        return;
      }
      if (!onBehalf) adoptSession(data);
      if (data.reservation) applyReservation(data.reservation);
      window.dispatchEvent(new CustomEvent('southstreet:bookings-updated'));
      if (onBehalf) {
        router.push('/portal?tab=accountant&section=receipts');
        return;
      }
      setScreen('manage');
      setView('packages');
      router.replace('/book');
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
      resetChoicesView();
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
            setView('packages');
            setExtraIndex(0);
            router.replace(`/book?edit=${encodeURIComponent(existing.reservation_id)}`);
          }}
        />
      </div>
    );
  }

  const showPriceBar = Boolean(selected) && view !== 'offer' && view !== 'packages' && view !== 'invoice';
  const canGoBack = view !== 'packages' || editing;

  return (
    <div className="book-wizard book-wizard-stage" dir="rtl">
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

      {showPriceBar ? <PriceBar amount={displayPrice} /> : null}

      {error ? <p className="book-error" role="alert">{error}</p> : null}

      <div className="book-view-body">
      {view === 'offer' && (
        <section className="book-offer-view">
          {loading ? (
            <p className="text-sm text-slate-500 py-10 text-center">جاري تحميل البرامج...</p>
          ) : packages.length === 0 ? (
            <p className="text-sm text-slate-500 py-10 text-center">لا توجد باقات مفتوحة للحجز حالياً.</p>
          ) : selected ? (
            <article className="book-hero" aria-current="true">
              <div className="book-hero-top">
                <span className="book-pkg-type">{selected.type}</span>
                <span className="book-picked"><CheckCircle className="w-4 h-4" /> باقتك</span>
              </div>
              <h2 className="book-hero-title">{selected.name}</h2>
              <div className="book-hero-facts">
                {selected.start_date ? (
                  <span><Calendar className="w-5 h-5" /> {formatShortDate(selected.start_date)}</span>
                ) : null}
                {selected.makkah_hotel_name ? (
                  <span><MapPin className="w-5 h-5" /> {selected.makkah_hotel_name}</span>
                ) : null}
              </div>
              <PriceFocus amount={displayPrice} from={priceIsFrom} extrasCount={selectedExtras.length} />
              {roomType || selectedExtras.length ? (
                <div className="book-hero-picks">
                  {roomType ? <span>{ROOM_LABELS[roomType] || roomType}</span> : null}
                  {selectedExtras.map((item) => (
                    <span key={item.id}>{item.title}</span>
                  ))}
                </div>
              ) : null}
              {otherPackages.length > 0 ? (
                <button type="button" className="book-change-link" onClick={() => setView('packages')}>
                  تغيير البرنامج
                </button>
              ) : null}
            </article>
          ) : (
            <p className="text-sm text-slate-500 py-10 text-center">اختر برنامجاً للمتابعة.</p>
          )}
        </section>
      )}

      {view === 'packages' && (
        <section className="book-option-screen">
          <h2 className="book-option-title">اختر البرنامج</h2>
          <p className="book-option-sub">اضغط للاختيار — التفاصيل من الرابط — التالي للمتابعة</p>
          {loading ? (
            <p className="text-sm text-slate-500 py-10 text-center">جاري تحميل البرامج...</p>
          ) : packages.filter((pkg) => !isPackageExpired(pkg)).length === 0 ? (
            <p className="text-sm text-slate-500 py-10 text-center">لا توجد باقات مفتوحة للحجز حالياً.</p>
          ) : (
            <div className="book-big-list">
              {packages.filter((pkg) => !isPackageExpired(pkg)).map((pkg) => {
                const from = pkg.prices?.length ? Math.min(...pkg.prices.map((p) => p.amount)) : 0;
                const active = pkg.package_id === packageId;
                return (
                  <article key={pkg.package_id} className={`book-pkg-pick ${active ? 'is-active' : ''}`}>
                    <button
                      type="button"
                      className="book-pkg-pick-main"
                      onClick={() => selectPackage(pkg.package_id)}
                      aria-pressed={active}
                    >
                      <span className={`book-choice-radio${active ? ' is-on' : ''}`} aria-hidden>
                        {active ? <Check className="w-3 h-3" strokeWidth={3} /> : null}
                      </span>
                      <span className="book-pkg-type">{pkg.type}</span>
                      <strong>{pkg.name}</strong>
                      <span className="book-choice-price">{money(from)}</span>
                    </button>
                    <Link
                      href={`/packages#${encodeURIComponent(pkg.package_id)}`}
                      className="book-pkg-details"
                    >
                      تفاصيل البرنامج
                    </Link>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {view === 'room' && selected && (
        <section className="book-option-screen">
          <h2 className="book-option-title">اختر الغرفة</h2>
          <p className="book-option-sub">اضغط على نوع الغرفة ثم التالي</p>
          <div className="book-big-list book-big-list-rooms">
            {roomPrices.length === 0 && (
              <p className="book-option-sub">لا توجد غرف على هذا البرنامج بعد. افتح بطاقة البرنامج واحفظ خيارات الحجز.</p>
            )}
            {roomPrices.map((price) => {
              const count = roomOccupancy(price.room_type);
              const active = roomType === price.room_type;
              return (
                <button
                  key={price.room_type}
                  type="button"
                  className={`book-big-card book-big-card-room ${active ? 'is-active' : ''}`}
                  onClick={() => setRoomType(price.room_type)}
                  aria-pressed={active}
                  aria-label={`${ROOM_LABELS[price.room_type] || price.room_type} — ${count} أشخاص — ${money(price.amount)}`}
                >
                  <span className={`book-choice-radio${active ? ' is-on' : ''}`} aria-hidden>
                    {active ? <Check className="w-3 h-3" strokeWidth={3} /> : null}
                  </span>
                  <span className="book-room-main">
                    <RoomPeople count={count} />
                    <strong>{ROOM_LABELS[price.room_type] || price.room_type}</strong>
                  </span>
                  <span className="book-choice-price">{money(price.amount)}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {view === 'extra' && currentExtra && (
        <section className="book-option-screen">
          <p className="book-option-kicker">إضافة {extraIndex + 1} من {offerExtras.length}</p>
          <span className="book-option-icon" aria-hidden>
            {(() => {
              const Icon = EXTRA_ICONS[currentExtra.id] || Check;
              return <Icon />;
            })()}
          </span>
          <h2 className="book-option-title">{currentExtra.title}</h2>
          <p className="book-option-plus">+ {money(currentExtra.price)}</p>
          <div className="book-yesno" role="group" aria-label={currentExtra.title}>
            <button
              type="button"
              className={`book-yesno-btn is-yes ${extraIds.includes(currentExtra.id) ? 'is-active' : ''}`}
              onClick={() => setExtraChoice(currentExtra.id, true)}
              aria-pressed={extraIds.includes(currentExtra.id)}
            >
              أريدها
            </button>
            <button
              type="button"
              className={`book-yesno-btn is-no ${!extraIds.includes(currentExtra.id) ? 'is-active' : ''}`}
              onClick={() => setExtraChoice(currentExtra.id, false)}
              aria-pressed={!extraIds.includes(currentExtra.id)}
            >
              لا شكراً
            </button>
          </div>
        </section>
      )}

      {view === 'details' && (
        <section className="book-details-easy">
          <header className="book-section-head">
            <h2>{onBehalf ? 'بيانات العميل' : 'بياناتك'}</h2>
            <p>
              {editing
                ? 'حدّث الاسم أو الهاتف إن احتجت.'
                : onBehalf
                  ? 'الاسم والهاتف كافيان. البريد اختياري — بدون جوجل.'
                  : 'الاسم والهاتف وحساب جوجل يكفي.'}
            </p>
          </header>
          <div className="book-form book-form-easy book-form-simple">
            <label>
              {onBehalf ? 'اسم العميل' : 'الاسم'}
              <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </label>
            <label>
              الهاتف
              <input value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" dir="ltr" />
            </label>
            {onBehalf ? (
              <label>
                البريد الإلكتروني <span className="book-optional">(اختياري)</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  dir="ltr"
                  placeholder="client@email.com"
                />
              </label>
            ) : null}
          </div>
          {!editing && !onBehalf ? (
            <div className="book-google-box">
              {(loggedIn || googleIdToken) ? (
                <p className="book-google-ok"><CheckCircle className="w-5 h-5" /> {email || 'حساب جوجل مرتبط'}</p>
              ) : (
                <GoogleContinueButton
                  onToken={async (idToken) => {
                    setError('');
                    setGoogleIdToken(idToken);
                    try {
                      const res = await fetch('/api/auth/google', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ idToken }),
                      });
                      const data = await res.json();
                      if (data.email) setEmail(data.email);
                      if (data.name) setName((prev) => prev || data.name);
                      if (data.user?.email) setEmail(data.user.email);
                      if (data.user?.name) setName((prev) => prev || data.user.name);
                      if (data.user?.phone) setPhone((prev) => prev || data.user.phone);
                      if (data.status === 'SUCCESS') adoptSession(data);
                      if (data.status === 'PENDING_APPROVAL' || data.status === 'SUCCESS') return;
                      setGoogleIdToken('');
                      setError(data.error || 'تعذر ربط جوجل');
                    } catch {
                      setGoogleIdToken('');
                      setError('تعذر ربط جوجل. حاول مرة أخرى.');
                    }
                  }}
                />
              )}
            </div>
          ) : null}
          {onBehalf && !editing ? (
            <p className="book-onbehalf-hint">يُسجَّل العميل مباشرة من لوحة المحاسب دون حساب جوجل، وتبقى جلستك كما هي.</p>
          ) : null}
        </section>
      )}

      {view === 'invoice' && selected && (
        <section className="space-y-5">
          <header className="book-section-head">
            <h2>{editing ? 'راجع الفاتورة بعد التعديل' : 'راجع الفاتورة ثم أكّد'}</h2>
            <p>
              {editing
                ? 'يظهر الفرق إن تغيّر السعر. الوكالة تؤكد التعديل.'
                : 'أرسل الطلب. الوكالة تؤكده ثم نخبرك.'}
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
          <div className="book-print-final">
            <p className="book-print-final-hint">بعد مراجعة الفاتورة يمكنك طباعة طلب الحجز قبل الإرسال</p>
            <BookingPrintButton
              type={existing?.reservation_id ? 'invoice' : 'request'}
              step={4}
              draft={printDraft}
              reservationId={existing?.reservation_id}
              label="معاينة / طباعة الطلب"
            />
          </div>
        </section>
      )}
      </div>

      <div className="book-nav book-nav-sticky">
        <div className="book-nav-actions">
          {canGoBack ? (
            <button type="button" className="book-btn book-btn-ghost" onClick={goBack}>
              <ArrowRight className="w-5 h-5" /> السابق
            </button>
          ) : (
            <span />
          )}
          {view !== 'invoice' ? (
            <button type="button" className="book-btn book-btn-primary book-btn-next" onClick={goNext} disabled={loading}>
              التالي <ArrowLeft className="w-6 h-6" />
            </button>
          ) : (
            <button type="button" className="book-btn book-btn-primary book-btn-next" onClick={confirm} disabled={submitting}>
              {submitting ? <Loader2 className="w-6 h-6 animate-spin" /> : <CheckCircle className="w-6 h-6" />}
              {submitting ? 'جاري الإرسال...' : editing ? 'حفظ التعديل' : 'إرسال الطلب'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
