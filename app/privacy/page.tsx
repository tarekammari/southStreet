import type { Metadata } from 'next';
import Link from 'next/link';
import LegalPage from '@/components/legal/LegalPage';
import { getBrand } from '@/lib/brand-server';
import { connectName } from '@/lib/brand';

export const dynamic = 'force-dynamic';

export function generateMetadata(): Metadata {
  const b = getBrand();
  return { title: 'سياسة الخصوصية', description: `سياسة خصوصية موقع ${b.agency_name} وتطبيق ${connectName(b)}.` };
}

/** Privacy policy of the site and its Connect apps (linked from Google Play). */
export default function PrivacyPage() {
  const b = getBrand();
  const app = connectName(b);
  const owner = b.legal_name || b.agency_name;
  const contact = [b.email, b.phone].filter(Boolean);
  return (
    <LegalPage title="سياسة الخصوصية" updated="2026-11-27">
      <div dir="rtl">
        <p>
          تشرح هذه الصفحة كيف تتعامل <b>{owner}</b> («الوكالة») مع بياناتك عند استعمال موقعها وتطبيق <b>{app}</b> على أندرويد وويندوز والويب.
        </p>

        <h2>البيانات التي نجمعها</h2>
        <ul>
          <li><b>الحساب:</b> الاسم، اسم المستخدم، البريد الإلكتروني أو رقم الهاتف، وصورة الحساب إن أضفتها.</li>
          <li><b>المحادثات:</b> الرسائل والصور والملفات والرسائل الصوتية التي ترسلها في التطبيق، لتصل إلى من تراسله وتبقى في سجل المحادثة.</li>
          <li><b>المكالمات:</b> وقت المكالمة ومدتها وطرفاها فقط. الصوت لا يُسجَّل ولا يُحفظ، ويمرّ مشفّراً بين الجهازين.</li>
          <li><b>الجهاز:</b> نوع الجهاز وإصدار التطبيق ورمز الإشعارات، ليرنّ هاتفك عند الاتصال ولتصلك الإشعارات.</li>
          <li><b>الأمان:</b> سجلّ الدخول (الوقت، الجهاز، عنوان IP) لحماية حسابك وتنبيهك عند دخول جديد.</li>
          <li><b>الحجوزات:</b> بيانات الحجز والمسافرين التي تقدّمها لحجز رحلة أو عمرة أو فندق.</li>
        </ul>

        <h2>أذونات التطبيق</h2>
        <ul>
          <li><b>الميكروفون:</b> للمكالمات الصوتية والرسائل الصوتية فقط، وعندما تستعملها أنت.</li>
          <li><b>الإشعارات وشاشة المكالمة الكاملة:</b> لإظهار المكالمة الواردة والرنين حتى والتطبيق مغلق.</li>
          <li><b>الهاتف (حساب الاتصال):</b> ليتعامل أندرويد مع المكالمة كمكالمة هاتفية (السماعة، السيارة، عدم الإزعاج).</li>
        </ul>

        <h2>كيف نستعمل البيانات</h2>
        <p>لتشغيل الحساب والمحادثات والمكالمات والحجوزات، ولحماية الحسابات، وللتواصل معك بخصوص خدماتك. لا نبيع بياناتك، ولا نعرض إعلانات، ولا نستعمل أدوات تتبع إعلانية.</p>

        <h2>من يعالج البيانات معنا</h2>
        <ul>
          <li><b>خادم الوكالة:</b> البيانات محفوظة على خادم الوكالة الخاص، والاتصال به مشفّر (HTTPS).</li>
          <li><b>Google Firebase Cloud Messaging:</b> لإيصال تنبيه المكالمة والرسالة إلى هاتفك (رمز الجهاز، اسم المرسل ومقتطف قصير من الرسالة ليظهر في الإشعار).</li>
          <li><b>تسجيل الدخول بـ Google</b> (إن اخترته): يصلنا اسمك وبريدك من Google.</li>
          <li><b>المساعد الذكي في الموقع</b> (إن استعملته): تُرسل أسئلتك إلى مزوّد الذكاء الاصطناعي لتوليد الجواب.</li>
        </ul>

        <h2>المدة والحذف</h2>
        <p>
          نحتفظ بالبيانات ما دام حسابك قائماً. يمكنك طلب حذف حسابك وبياناته في أي وقت من صفحة{' '}
          <Link href="/account-deletion">حذف الحساب</Link>. تُحذف خلال 30 يوماً، إلا ما يفرض القانون حفظه (مثل الفواتير والسجلات المحاسبية للحجوزات).
        </p>

        <h2>حقوقك</h2>
        <p>لك أن تطلب الاطلاع على بياناتك أو تصحيحها أو حذفها، وأن تسحب إذن الميكروفون أو الإشعارات من إعدادات جهازك متى شئت.</p>

        <h2>الأطفال</h2>
        <p>التطبيق موجّه لزبائن الوكالة البالغين وفريقها، وليس للأطفال دون 13 سنة.</p>

        <h2>التواصل</h2>
        <p>
          {owner}
          {b.address ? <> — {b.address}{b.city ? `، ${b.city}` : ''}</> : null}
          {contact.length ? <><br />{contact.map((c, i) => <bdi key={c} dir="ltr">{i ? ' · ' : ''}{c}</bdi>)}</> : null}
        </p>
      </div>

      <section className="lg-en" dir="ltr" lang="en">
        <h2>Privacy Policy (English)</h2>
        <p>This page explains how <b>{b.name_latin || owner}</b> (“the agency”) handles your data on its website and in the <b>{app}</b> app for Android, Windows and the web.</p>
        <h3>Data we collect</h3>
        <ul>
          <li><b>Account:</b> name, username, email or phone number, and a profile photo if you add one.</li>
          <li><b>Messages:</b> texts, photos, files and voice messages you send, delivered to the people you chat with and kept in the conversation history.</li>
          <li><b>Calls:</b> only the time, length and participants. Call audio is never recorded or stored; it travels encrypted between the two devices.</li>
          <li><b>Device:</b> device type, app version and push token, so your phone can ring and receive notifications.</li>
          <li><b>Security:</b> sign-in history (time, device, IP address) to protect your account and alert you of new sign-ins.</li>
          <li><b>Bookings:</b> booking and traveller details you provide to book a trip, Umrah or hotel.</li>
        </ul>
        <h3>App permissions</h3>
        <p>Microphone (voice calls and voice messages, only when you use them); notifications and full-screen call screen (incoming calls ring even when the app is closed); phone account (so Android handles calls like phone calls: headsets, car, Do Not Disturb).</p>
        <h3>Use and sharing</h3>
        <p>Data is used only to run your account, messages, calls and bookings, keep accounts safe, and contact you about your services. We do not sell data, show ads or use advertising trackers. Data is stored on the agency’s own server over HTTPS. Google Firebase Cloud Messaging delivers call and message alerts (device token, the sender’s name and a short preview of the message shown in the notification). Google Sign-In, if you choose it, shares your name and email with us. The website’s AI assistant, if you use it, sends your questions to an AI provider to produce answers.</p>
        <h3>Retention and deletion</h3>
        <p>Data is kept while your account exists. You can request deletion of your account and its data at any time on the <Link href="/account-deletion">account deletion</Link> page; it is deleted within 30 days, except records the law requires us to keep (such as invoices and accounting records of bookings).</p>
        <h3>Children</h3>
        <p>The app is meant for the agency’s adult customers and staff, not for children under 13.</p>
        <h3>Contact</h3>
        <p>{owner}{contact.length ? ` — ${contact.join(' · ')}` : ''}</p>
      </section>
    </LegalPage>
  );
}
