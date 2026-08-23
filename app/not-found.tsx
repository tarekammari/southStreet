import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-app px-4">
      <div className="max-w-md w-full text-center rounded-3xl bg-white border border-slate-200 px-8 py-12 shadow-sm">
        <p className="text-sm font-semibold text-emerald-700 mb-2">404</p>
        <h1 className="font-cairo text-2xl font-extrabold text-slate-900 mb-3">الصفحة غير موجودة</h1>
        <p className="text-slate-500 leading-relaxed mb-8">
          الرابط الذي طلبته غير متاح. يمكنك العودة إلى الصفحة الرئيسية لمتابعة التصفح.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-xl bg-emerald-700 text-white px-5 py-2.5 text-sm font-semibold hover:bg-emerald-800 transition-colors"
        >
          العودة للرئيسية
        </Link>
      </div>
    </main>
  );
}
