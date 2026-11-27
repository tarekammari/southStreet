import type { Metadata } from 'next';
import Link from 'next/link';
import LegalPage from '@/components/legal/LegalPage';
import { getBrand } from '@/lib/brand-server';
import { brandWhatsapps, connectName } from '@/lib/brand';

export const dynamic = 'force-dynamic';

export function generateMetadata(): Metadata {
  const b = getBrand();
  return { title: 'حذف الحساب', description: `طلب حذف حسابك في ${connectName(b)} وبياناته.` };
}

const SUBJECT = 'طلب حذف الحساب / Account deletion request';
const BODY = 'أطلب حذف حسابي وبياناته.\nI request deletion of my account and its data.\n\nاسم المستخدم / Username:\nالهاتف أو البريد المسجّل / Registered phone or email:';

/** How to have an account and its data deleted (Google Play links here; the app's info sheet too). */
export default function AccountDeletionPage() {
  const b = getBrand();
  const app = connectName(b);
  const owner = b.legal_name || b.agency_name;
  const wa = brandWhatsapps(b)[0]?.replace(/[^\d]/g, '');
  const mail = b.email ? `mailto:${b.email}?subject=${encodeURIComponent(SUBJECT)}&body=${encodeURIComponent(BODY)}` : '';
  const whatsapp = wa ? `https://wa.me/${wa}?text=${encodeURIComponent(`${SUBJECT}\n${BODY}`)}` : '';
  return (
    <LegalPage title={`حذف حسابك في ${app}`} updated="2026-11-27">
      <div dir="rtl">
        <p>يمكنك في أي وقت طلب حذف حسابك في موقع <b>{b.agency_name}</b> وتطبيق <b>{app}</b> مع بياناته.</p>

        <h2>كيف تطلب الحذف</h2>
        <ol>
          <li>أرسل طلب الحذف من البريد أو رقم الهاتف المسجّل في حسابك (الأزرار أدناه تكتب الطلب عنك).</li>
          <li>اذكر اسم المستخدم. قد نتصل بك للتأكد أن الطلب منك فعلاً.</li>
          <li>نؤكّد لك الحذف عند إتمامه، خلال 30 يوماً على الأكثر.</li>
        </ol>
        <div className="lg-actions">
          {mail ? <a className="lg-btn" href={mail}>طلب الحذف بالبريد</a> : null}
          {whatsapp ? <a className="lg-btn is-light" href={whatsapp} target="_blank" rel="noopener noreferrer">طلب الحذف عبر واتساب</a> : null}
        </div>
        {b.phone ? <p>أو اتصل بنا: <bdi dir="ltr">{b.phone}</bdi></p> : null}

        <h2>ما الذي يُحذف</h2>
        <ul>
          <li>الحساب: الاسم واسم المستخدم والبريد والهاتف وصورة الحساب ووسائل الدخول (مفاتيح الأمان، الأجهزة المرتبطة).</li>
          <li>المحادثات: رسائلك وصورك وملفاتك ورسائلك الصوتية، وسجل مكالماتك.</li>
          <li>الأجهزة: رموز الإشعارات وسجلّ الدخول.</li>
        </ul>

        <h2>ما قد يُحتفظ به</h2>
        <p className="lg-note">
          الفواتير والسجلات المحاسبية للحجوزات المدفوعة يفرض القانون حفظها لمدة محددة، فتبقى دون ربطها بحساب قائم ثم تُحذف بانتهاء المدة. النسخ الاحتياطية تُستبدل خلال 30 يوماً.
        </p>
        <p>
          للمزيد: <Link href="/privacy">سياسة الخصوصية</Link>. — {owner}
        </p>
      </div>

      <section className="lg-en" dir="ltr" lang="en">
        <h2>Delete your {app} account (English)</h2>
        <p>You can ask at any time for your account on the {b.name_latin || owner} website and the {app} app to be deleted together with its data.</p>
        <h3>How to request deletion</h3>
        <ol>
          <li>Send a deletion request from the email or phone number registered on your account (the buttons above write it for you){b.email ? <> — email <bdi>{b.email}</bdi></> : null}{b.phone ? <>, phone <bdi>{b.phone}</bdi></> : null}.</li>
          <li>Include your username. We may contact you to confirm the request is yours.</li>
          <li>We confirm once the deletion is done, within 30 days at most.</li>
        </ol>
        <h3>What is deleted</h3>
        <p>Your account (name, username, email, phone, profile photo, sign-in methods and linked devices), your messages, photos, files, voice messages and call history, push tokens and sign-in history.</p>
        <h3>What may be kept</h3>
        <p>Invoices and accounting records of paid bookings must be kept for a legal period; they are no longer linked to an account and are deleted when that period ends. Backups are replaced within 30 days.</p>
      </section>
    </LegalPage>
  );
}
