import { config } from './config.js';
import { esc, deviceLabel } from './util.js';
import { qrInfo } from './auth.js';
import { setting } from './db.js';

// Server-rendered pages of the main domain: landing, sign-in, QR approval, and the app/admin shells.

const T = {
  ar: {
    dir: 'rtl', tag: 'نظام متكامل لمحلات الهواتف', h1: 'أدر محل الهواتف من هاتفك أو حاسوبك',
    sub: 'المبيعات، المخزون بالـ IMEI، الزبائن والديون، الموردون، التقارير — ومتجر إلكتروني جاهز على رابط خاص بمحلك.',
    start: 'ابدأ مجانًا مع Google', open: 'افتح لوحة التحكم', login: 'تسجيل الدخول', features: 'كل ما يحتاجه محلك',
    f: [['نقطة بيع سريعة', 'امسح الـ IMEI أو الباركود بالكاميرا، فاتورة مطبوعة في ثوانٍ، نقدًا أو بالدين.'],
      ['مخزون بالـ IMEI', 'كل هاتف برقمه التسلسلي: متى دخل، بكم اشتريته، ولمن بعته.'],
      ['متجرك على الإنترنت', 'رابط خاص بمحلك مثل mystore.' + config.baseDomain + ' بأربع قوالب تختار منها.'],
      ['صور خفيفة وسريعة', 'الصور تُضغط تلقائيًا إلى WebP قبل الرفع، فتفتح الصفحات بسرعة حتى على 3G.'],
      ['فريق وصلاحيات', 'أضف البائعين والمديرين بحساب Google، ولكل واحد صلاحياته.'],
      ['دخول بمسح QR', 'سجّل الدخول على الحاسوب بمسح رمز QR من هاتفك، بدون كلمة سر.']],
    themes: 'اختر شكل متجرك', pricing: 'الأسعار', trial: `تجربة كاملة ${config.trialDays} يومًا مجانًا، بدون بطاقة.`,
    google: 'المتابعة بحساب Google', or: 'أو', scanTitle: 'امسح بهاتفك للدخول', scanHelp: 'افتح الكاميرا أو التطبيق على هاتفك (مسجل الدخول) وامسح الرمز، ثم اختر الرقم الظاهر هنا:',
    expired: 'انتهت صلاحية الرمز', refresh: 'رمز جديد', waiting: 'في انتظار الموافقة من الهاتف…', ok: 'تمت الموافقة، جارٍ الدخول…',
    denied: 'تم رفض الطلب', qrTitle: 'تسجيل الدخول على جهاز آخر', qrAsk: 'هل تريد تسجيل الدخول بحسابك على هذا الجهاز؟',
    qrPick: 'اختر الرقم الظاهر على شاشة الحاسوب:', deny: 'ليس أنا — رفض', qrGone: 'هذا الرمز منتهي أو مستخدم. أنشئ رمزًا جديدًا على الحاسوب.',
    qrDone: 'تم! يمكنك متابعة العمل على الحاسوب.', qrWrong: 'رقم خاطئ، تم إلغاء الطلب للأمان.', device: 'الجهاز', notConfigured: 'تسجيل Google غير مفعّل بعد على الخادم.',
    eState: 'انتهت الجلسة، حاول مرة أخرى.', eDisabled: 'هذا الحساب موقوف.', eGoogle: 'تعذّر الدخول بـ Google.',
  },
  fr: {
    dir: 'ltr', tag: 'La gestion complète des magasins de téléphones', h1: 'Gérez votre magasin de téléphones depuis votre mobile ou PC',
    sub: 'Ventes, stock par IMEI, clients et crédits, fournisseurs, rapports — et une boutique en ligne prête sur votre propre adresse.',
    start: 'Commencer gratuitement avec Google', open: 'Ouvrir le tableau de bord', login: 'Connexion', features: 'Tout ce dont votre magasin a besoin',
    f: [['Caisse rapide', 'Scannez l’IMEI ou le code-barres avec la caméra, ticket imprimé en quelques secondes, comptant ou à crédit.'],
      ['Stock par IMEI', 'Chaque téléphone avec son numéro : date d’entrée, prix d’achat, client.'],
      ['Votre boutique en ligne', 'Une adresse à vous, ex. maboutique.' + config.baseDomain + ', avec quatre thèmes au choix.'],
      ['Images légères', 'Les photos sont compressées en WebP avant l’envoi : pages rapides même en 3G.'],
      ['Équipe et rôles', 'Ajoutez vendeurs et gérants avec leur compte Google, chacun avec ses droits.'],
      ['Connexion par QR', 'Connectez-vous sur le PC en scannant un QR avec votre téléphone, sans mot de passe.']],
    themes: 'Choisissez le style de votre boutique', pricing: 'Tarifs', trial: `Essai complet de ${config.trialDays} jours, sans carte.`,
    google: 'Continuer avec Google', or: 'ou', scanTitle: 'Scannez avec votre téléphone', scanHelp: 'Ouvrez l’appareil photo ou l’app sur votre téléphone (connecté), scannez le code, puis choisissez ce numéro :',
    expired: 'Code expiré', refresh: 'Nouveau code', waiting: 'En attente de l’accord du téléphone…', ok: 'Approuvé, connexion…',
    denied: 'Demande refusée', qrTitle: 'Connexion sur un autre appareil', qrAsk: 'Voulez-vous connecter votre compte sur cet appareil ?',
    qrPick: 'Choisissez le numéro affiché sur l’écran du PC :', deny: 'Ce n’est pas moi — refuser', qrGone: 'Ce code a expiré ou a déjà servi. Créez-en un nouveau sur le PC.',
    qrDone: 'C’est fait ! Continuez sur le PC.', qrWrong: 'Mauvais numéro, demande annulée par sécurité.', device: 'Appareil', notConfigured: 'La connexion Google n’est pas encore configurée.',
    eState: 'Session expirée, réessayez.', eDisabled: 'Ce compte est suspendu.', eGoogle: 'Échec de la connexion Google.',
  },
  en: {
    dir: 'ltr', tag: 'The complete system for phone shops', h1: 'Run your phone shop from your mobile or PC',
    sub: 'Sales, IMEI stock, customers and credit, suppliers, reports — plus an online store on your own address.',
    start: 'Start free with Google', open: 'Open dashboard', login: 'Sign in', features: 'Everything your shop needs',
    f: [['Fast point of sale', 'Scan the IMEI or barcode with the camera, printed receipt in seconds, cash or credit.'],
      ['IMEI stock', 'Every phone by its serial: when it came in, what you paid, who bought it.'],
      ['Your online store', 'Your own address like mystore.' + config.baseDomain + ' with four themes to choose from.'],
      ['Light, fast images', 'Photos are compressed to WebP before upload, so pages open fast even on 3G.'],
      ['Team and roles', 'Add sellers and managers with their Google account, each with their own rights.'],
      ['QR sign-in', 'Sign in on the PC by scanning a QR code with your phone, no password.']],
    themes: 'Pick your store’s look', pricing: 'Pricing', trial: `Full ${config.trialDays}-day free trial, no card needed.`,
    google: 'Continue with Google', or: 'or', scanTitle: 'Scan with your phone', scanHelp: 'Open the camera or the app on your signed-in phone, scan the code, then pick this number:',
    expired: 'Code expired', refresh: 'New code', waiting: 'Waiting for approval on the phone…', ok: 'Approved, signing in…',
    denied: 'Request denied', qrTitle: 'Sign in on another device', qrAsk: 'Sign in with your account on this device?',
    qrPick: 'Pick the number shown on the PC screen:', deny: 'Not me — deny', qrGone: 'This code expired or was used. Create a new one on the PC.',
    qrDone: 'Done! Carry on on the PC.', qrWrong: 'Wrong number, request cancelled for safety.', device: 'Device', notConfigured: 'Google sign-in is not configured on the server yet.',
    eState: 'Session expired, try again.', eDisabled: 'This account is disabled.', eGoogle: 'Google sign-in failed.',
  },
};

function langOf(ctx) {
  const q = ctx.url.searchParams.get('lang');
  if (T[q]) return q;
  const al = String(ctx.req.headers['accept-language'] || '').toLowerCase();
  const first = al.split(',').map((x) => x.trim().slice(0, 2)).find((x) => T[x]);
  return first || 'ar';
}

const GOOGLE_ICON = '<svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';

function shell(ctx, { lang, title, body, scripts = [], css = '/static/css/app.css', assets, bodyClass = '' }) {
  const L = T[lang] || T.ar;
  return `<!doctype html><html lang="${lang}" dir="${L.dir}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>${esc(title)}</title>
<meta name="description" content="${esc(L.sub)}"><meta name="theme-color" content="#2563eb">
<link rel="icon" href="${assets['/static/img/icon.svg']}" type="image/svg+xml"><link rel="manifest" href="/manifest.webmanifest">
<link rel="stylesheet" href="${assets[css]}">
${scripts.map((s) => `<script src="${assets[s]}" defer></script>`).join('')}
</head><body class="${bodyClass}">${body}</body></html>`;
}

const html = (ctx, s, cache = 'no-store') => ctx.send(200, s, { 'content-type': 'text/html; charset=utf-8', 'cache-control': cache });

function landing(ctx, assets) {
  const lang = langOf(ctx), L = T[lang];
  const cta = ctx.user ? `<a class="btn primary big" href="/app">${L.open}</a>` : `<a class="btn primary big" href="/login?lang=${lang}">${GOOGLE_ICON}<span>${L.start}</span></a>`;
  const themes = [['clean', 'Clean'], ['night', 'Night'], ['souk', 'Souk'], ['luxe', 'Luxe']];
  const pricing = setting('pricing', '');
  const body = `<header class="lnav"><div class="wrap lnav-in"><a class="logo" href="/"><img src="${assets['/static/img/icon.svg']}" alt="" width="32" height="32"><b>${esc(config.appName)}</b></a>
<nav>${['ar', 'fr', 'en'].filter((l) => l !== lang).map((l) => `<a href="?lang=${l}">${l.toUpperCase()}</a>`).join('')}<a class="btn" href="${ctx.user ? '/app' : `/login?lang=${lang}`}">${ctx.user ? L.open : L.login}</a></nav></div></header>
<section class="lhero"><div class="wrap"><p class="pill">${L.tag}</p><h1>${L.h1}</h1><p class="lead">${L.sub}</p>${cta}<p class="muted">${L.trial}</p>
<div class="mock" aria-hidden="true"><div class="mock-phone"><div class="mp-top"></div><div class="mp-card"></div><div class="mp-card"></div><div class="mp-row"><i></i><i></i></div></div>
<div class="mock-pc"><div class="mpc-bar"></div><div class="mpc-grid"><i></i><i></i><i></i><i></i></div><div class="mpc-chart"></div></div></div></div></section>
<section class="wrap feats"><h2>${L.features}</h2><div class="fgrid">${L.f.map(([h, p], i) => `<article><span class="fi fi${i}"></span><h3>${h}</h3><p>${p}</p></article>`).join('')}</div></section>
<section class="wrap themes"><h2>${L.themes}</h2><div class="tgrid">${themes.map(([k, n]) => `<figure class="tprev t-${k}"><div><i></i><i></i><i></i><i></i></div><figcaption>${n}</figcaption></figure>`).join('')}</div></section>
${pricing ? `<section class="wrap"><h2>${L.pricing}</h2><p class="pricing">${esc(pricing).replace(/\n/g, '<br>')}</p></section>` : ''}
<section class="wrap endcta">${cta}</section>
<footer class="lfoot"><div class="wrap">© ${new Date().getFullYear()} ${esc(config.appName)} · <a href="https://1zayd1.tech" rel="noopener">1zayd1.tech</a></div></footer>`;
  return html(ctx, shell(ctx, { lang, title: `${config.appName} — ${L.tag}`, body, assets, bodyClass: 'landing' }), 'public, max-age=60');
}

function login(ctx, assets) {
  const lang = langOf(ctx), L = T[lang];
  const next = ctx.url.searchParams.get('next') || '/app';
  const safe = /^\/(?!\/)[\w\-./?=&#%]*$/.test(next) ? next : '/app';
  if (ctx.user) return ctx.redirect(safe);
  const e = ctx.url.searchParams.get('e');
  const err = e ? `<p class="alert">${esc({ state: L.eState, cancelled: L.eState, disabled: L.eDisabled, google: L.eGoogle }[e] || L.eGoogle)}</p>` : '';
  const google = config.googleClientId
    ? `<a class="btn google big" href="/auth/google?next=${encodeURIComponent(safe)}">${GOOGLE_ICON}<span>${L.google}</span></a>`
    : `<p class="alert">${L.notConfigured}</p>`;
  const dev = config.devLogin ? `<form class="dev" action="/auth/dev" method="get"><input type="hidden" name="next" value="${esc(safe)}"><input name="email" type="email" placeholder="dev@example.com" required><button class="btn">Dev login</button></form>` : '';
  const body = `<main class="login"><a class="logo" href="/"><img src="${assets['/static/img/icon.svg']}" alt="" width="44" height="44"><b>${esc(config.appName)}</b></a>
<div class="login-box"><section class="login-g"><h1>${L.login}</h1>${err}${google}${dev}</section>
<div class="or"><span>${L.or}</span></div>
<section class="login-qr" id="qr" data-next="${esc(safe)}" data-t='${esc(JSON.stringify({ waiting: L.waiting, expired: L.expired, refresh: L.refresh, ok: L.ok, denied: L.denied }))}'>
<h2>${L.scanTitle}</h2><div class="qr-img" id="qr-img"><span class="spin"></span></div><p class="muted">${L.scanHelp}</p><p class="qr-code" id="qr-code">··</p><p class="qr-status" id="qr-status"></p></section></div></main>`;
  return html(ctx, shell(ctx, { lang, title: `${L.login} — ${config.appName}`, body, scripts: ['/static/js/login.js'], assets, bodyClass: 'auth' }));
}

function qrApprove(ctx, assets, id) {
  const lang = langOf(ctx), L = T[lang];
  if (!ctx.user) return ctx.redirect(`/login?next=${encodeURIComponent('/qr/' + id)}`);
  const info = qrInfo(id);
  const body = info ? `<main class="login"><div class="login-box single" id="qra" data-id="${esc(info.id)}" data-t='${esc(JSON.stringify({ done: L.qrDone, wrong: L.qrWrong, denied: L.denied, gone: L.qrGone }))}'>
<h1>${L.qrTitle}</h1><p>${L.qrAsk}</p><p class="who">${ctx.user.picture ? `<img src="${esc(ctx.user.picture)}" alt="" width="36" height="36" referrerpolicy="no-referrer">` : ''}<b>${esc(ctx.user.email)}</b></p>
<p class="dev-info">${L.device}: <b>${esc(info.device)}</b> · IP <span dir="ltr">${esc(info.ip)}</span></p><p>${L.qrPick}</p>
<div class="choices">${info.choices.map((c) => `<button class="btn big" data-code="${c}">${c}</button>`).join('')}</div>
<button class="btn ghost" data-deny="1">${L.deny}</button><p class="qr-status" id="qra-status"></p></div></main>`
    : `<main class="login"><div class="login-box single"><h1>${L.qrTitle}</h1><p class="alert">${L.qrGone}</p><a class="btn" href="/app">${config.appName}</a></div></main>`;
  return html(ctx, shell(ctx, { lang, title: L.qrTitle, body, scripts: ['/static/js/qr-approve.js'], assets, bodyClass: 'auth' }));
}

function appShell(ctx, assets, which) {
  if (!ctx.user) return ctx.redirect(`/login?next=${encodeURIComponent(ctx.url.pathname + ctx.url.search)}`);
  if (which === 'admin' && !ctx.user.is_super) return ctx.redirect('/app');
  const lang = ['ar', 'fr', 'en'].includes(ctx.user.lang) ? ctx.user.lang : langOf(ctx);
  const body = `<div id="root" data-lang="${lang}"><div class="boot"><span class="spin"></span></div></div><div id="toast" role="status" aria-live="polite"></div>`;
  return html(ctx, shell(ctx, { lang, title: which === 'admin' ? `Admin — ${config.appName}` : config.appName, body, scripts: ['/static/js/core.js', `/static/js/${which}.js`], assets, bodyClass: which }));
}

export function pages(ctx, p, assets) {
  if (p === '/' || p === '/index.html') return landing(ctx, assets);
  if (p === '/login') return login(ctx, assets);
  if (p === '/app' || p.startsWith('/app/')) return appShell(ctx, assets, 'app');
  if (p === '/admin' || p.startsWith('/admin/')) return appShell(ctx, assets, 'admin');
  const m = p.match(/^\/qr\/([\w-]{8,20})$/);
  if (m) return qrApprove(ctx, assets, m[1]);
  if (p === '/manifest.webmanifest') {
    return ctx.send(200, JSON.stringify({
      name: config.appName, short_name: config.appName, start_url: '/app', display: 'standalone', background_color: '#ffffff', theme_color: '#2563eb',
      icons: [{ src: assets['/static/img/icon.svg'], sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
    }), { 'content-type': 'application/manifest+json', 'cache-control': 'public, max-age=3600' });
  }
  if (p === '/robots.txt') return ctx.send(200, 'User-agent: *\nDisallow: /app\nDisallow: /admin\nDisallow: /api/\nDisallow: /qr/\n', { 'content-type': 'text/plain' });
  if (p === '/favicon.ico') return ctx.redirect(assets['/static/img/icon.svg'], 301);
  return ctx.send(404, `<!doctype html><meta charset="utf-8"><title>404</title><p style="font:16px system-ui;padding:2rem">404 · <a href="/">${esc(config.appName)}</a></p>`, { 'content-type': 'text/html; charset=utf-8' });
}

export { deviceLabel };
