import crypto from 'node:crypto';
import { get, all, run } from './db.js';
import { config } from './config.js';
import { esc, str, int, rid, now, rateLimit, readForm, oneOf } from './util.js';

// Public catalogue of one store, rendered on the server (fast first paint, works without JS, good for SEO).

const T = {
  ar: {
    dir: 'rtl', search: 'ابحث عن هاتف، ماركة، موديل…', all: 'الكل', brand: 'الماركة', condition: 'الحالة', any: 'الكل',
    new: 'جديد', used: 'مستعمل', refurbished: 'مجدد', phone: 'هواتف', tablet: 'لوحات', accessory: 'إكسسوارات', part: 'قطع غيار', other: 'أخرى',
    sort: 'الترتيب', latest: 'الأحدث', cheap: 'الأرخص', expensive: 'الأغلى', filter: 'تصفية', available: 'متوفر', out: 'نفد من المخزون',
    priceOnRequest: 'السعر عند الطلب', call: 'اتصال', whatsapp: 'واتساب', order: 'اطلب الآن', orderTitle: 'اطلب هذا المنتج',
    name: 'الاسم الكامل', phoneNum: 'رقم الهاتف', city: 'الولاية / المدينة', note: 'ملاحظة (اختياري)', send: 'إرسال الطلب',
    ordered: 'تم استلام طلبك! سيتصل بك المتجر قريبًا.', orderErr: 'تعذر إرسال الطلب، تحقق من الاسم والهاتف.', specs: 'المواصفات',
    storage: 'الذاكرة', ram: 'الرام', color: 'اللون', battery: 'صحة البطارية', warranty: 'الضمان', model: 'الموديل', featured: 'مختارات',
    products: 'المنتجات', none: 'لا توجد منتجات مطابقة.', back: 'كل المنتجات', about: 'من نحن', contact: 'تواصل معنا', poweredBy: 'متجر مدعوم من',
    waMsg: 'السلام عليكم، أريد طلب', next: 'التالي', prev: 'السابق', unavailable: 'هذا المتجر غير متاح حاليًا.', notFound: 'الصفحة غير موجودة',
    share: 'مشاركة', inStock: 'قطع متوفرة', address: 'العنوان', cur: { DZD: 'دج' },
  },
  fr: {
    dir: 'ltr', search: 'Rechercher un téléphone, une marque…', all: 'Tout', brand: 'Marque', condition: 'État', any: 'Tous',
    new: 'Neuf', used: 'Occasion', refurbished: 'Reconditionné', phone: 'Téléphones', tablet: 'Tablettes', accessory: 'Accessoires', part: 'Pièces', other: 'Autres',
    sort: 'Tri', latest: 'Nouveautés', cheap: 'Prix croissant', expensive: 'Prix décroissant', filter: 'Filtrer', available: 'Disponible', out: 'Rupture de stock',
    priceOnRequest: 'Prix sur demande', call: 'Appeler', whatsapp: 'WhatsApp', order: 'Commander', orderTitle: 'Commander ce produit',
    name: 'Nom complet', phoneNum: 'Téléphone', city: 'Wilaya / Ville', note: 'Remarque (optionnel)', send: 'Envoyer la commande',
    ordered: 'Commande reçue ! Le magasin vous appellera bientôt.', orderErr: 'Échec de l’envoi, vérifiez le nom et le téléphone.', specs: 'Caractéristiques',
    storage: 'Stockage', ram: 'RAM', color: 'Couleur', battery: 'État batterie', warranty: 'Garantie', model: 'Modèle', featured: 'Sélection',
    products: 'Produits', none: 'Aucun produit trouvé.', back: 'Tous les produits', about: 'À propos', contact: 'Contact', poweredBy: 'Boutique propulsée par',
    waMsg: 'Bonjour, je souhaite commander', next: 'Suivant', prev: 'Précédent', unavailable: 'Cette boutique est indisponible.', notFound: 'Page introuvable',
    share: 'Partager', inStock: 'en stock', address: 'Adresse', cur: { DZD: 'DA' },
  },
  en: {
    dir: 'ltr', search: 'Search a phone, brand, model…', all: 'All', brand: 'Brand', condition: 'Condition', any: 'Any',
    new: 'New', used: 'Used', refurbished: 'Refurbished', phone: 'Phones', tablet: 'Tablets', accessory: 'Accessories', part: 'Parts', other: 'Other',
    sort: 'Sort', latest: 'Latest', cheap: 'Price: low to high', expensive: 'Price: high to low', filter: 'Filter', available: 'In stock', out: 'Out of stock',
    priceOnRequest: 'Price on request', call: 'Call', whatsapp: 'WhatsApp', order: 'Order now', orderTitle: 'Order this product',
    name: 'Full name', phoneNum: 'Phone number', city: 'City', note: 'Note (optional)', send: 'Send order',
    ordered: 'Order received! The store will call you soon.', orderErr: 'Could not send the order, check name and phone.', specs: 'Specifications',
    storage: 'Storage', ram: 'RAM', color: 'Color', battery: 'Battery health', warranty: 'Warranty', model: 'Model', featured: 'Featured',
    products: 'Products', none: 'No matching products.', back: 'All products', about: 'About', contact: 'Contact', poweredBy: 'Store powered by',
    waMsg: 'Hello, I would like to order', next: 'Next', prev: 'Previous', unavailable: 'This store is not available right now.', notFound: 'Page not found',
    share: 'Share', inStock: 'in stock', address: 'Address', cur: { DZD: 'DA' },
  },
};

export function fmtMoney(minor, currency, lang) {
  const v = (minor || 0) / 100;
  const n = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: Number.isInteger(v) ? 0 : 2 }).format(v).replace(/\u202f/g, ' ');
  const c = T[lang]?.cur?.[currency] || currency;
  return `${n} ${c}`;
}

const PAGE = 48;
let assets = {};
export const setAssets = (a) => { assets = a; };
const img = (store, f) => `/u/${store.id}/${f}`;

function layout(ctx, store, L, lang, { title, desc, body, base, image, jsonld }) {
  const canonical = base.abs + ctx.url.pathname.slice(base.path.length);
  const accent = store.accent ? ` style="--accent:${store.accent}"` : '';
  const langs = ['ar', 'fr', 'en'].filter((l) => l !== lang).map((l) => `<a href="?lang=${l}" hreflang="${l}">${l.toUpperCase()}</a>`).join('');
  return `<!doctype html><html lang="${lang}" dir="${L.dir}" data-theme="${esc(store.theme)}"${accent}><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}"><link rel="canonical" href="${esc(canonical)}">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:type" content="website">
${image ? `<meta property="og:image" content="${esc(base.origin + image)}">` : ''}
<meta name="theme-color" content="${esc(store.accent || '#2563eb')}">
${store.logo ? `<link rel="icon" href="${img(store, store.logo)}">` : '<link rel="icon" href="/static/img/icon.svg" type="image/svg+xml">'}
<link rel="stylesheet" href="${assets['/static/css/store.css']}">
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, '\\u003c')}</script>` : ''}
</head><body>
<header class="top"><div class="wrap top-in">
<a class="brand" href="${base.path}">${store.logo ? `<img src="${img(store, store.logo)}" alt="" width="40" height="40">` : `<span class="mono">${esc(store.name.slice(0, 1))}</span>`}<b>${esc(store.name)}</b></a>
<nav class="top-act">${store.phone ? `<a class="btn ghost" href="tel:${esc(store.phone)}">${L.call}</a>` : ''}${store.whatsapp ? `<a class="btn wa" href="https://wa.me/${esc(store.whatsapp.replace(/\D/g, ''))}" rel="noopener" target="_blank">${L.whatsapp}</a>` : ''}<span class="langs">${langs}</span></nav>
</div></header>
<main>${body}</main>
<footer class="foot"><div class="wrap foot-in">
<div><b>${esc(store.name)}</b>${store.about ? `<p>${esc(store.about)}</p>` : ''}</div>
<div>${store.address || store.city ? `<p>${L.address}: ${esc([store.address, store.city].filter(Boolean).join(', '))}</p>` : ''}${store.phone ? `<p dir="ltr">${esc(store.phone)}</p>` : ''}
<p class="soc">${['facebook', 'instagram', 'tiktok'].filter((k) => /^https:\/\//.test(store[k])).map((k) => `<a href="${esc(store[k])}" rel="noopener nofollow" target="_blank">${k}</a>`).join(' · ')}</p></div>
<p class="langs-f">${langs}</p><p class="pw">${L.poweredBy} <a href="${config.publicUrl}/" rel="noopener">${esc(config.appName)}</a></p>
</div></footer>
<script src="${assets['/static/js/store.js']}" defer></script>
</body></html>`;
}

function card(store, p, L, lang, base) {
  const ls = lang !== store.lang ? `?lang=${lang}` : '';
  const im = p.images[0];
  const pic = im ? `<img src="${img(store, im.t || im.f)}" alt="${esc(p.title)}" width="${im.w ? 400 : 400}" height="${im.w && im.h ? Math.round(400 * im.h / im.w) : 400}" loading="lazy" decoding="async">` : '<span class="noimg"></span>';
  const stock = p.stock > 0;
  const chips = [p.storage, p.ram && `${p.ram} RAM`].filter(Boolean).map((c) => `<span>${esc(c)}</span>`).join('');
  return `<a class="card" href="${base.path}p/${p.id}${ls}"><div class="pic">${pic}${p.condition !== 'new' ? `<em class="badge">${L[p.condition]}</em>` : ''}${p.old_price > p.price && p.price ? `<em class="badge sale">-${Math.round(100 - (p.price * 100) / p.old_price)}%</em>` : ''}</div>
<div class="info"><h3>${esc(p.title)}</h3><div class="chips">${chips}</div>
<div class="price">${store.show_prices && p.price ? `<b>${fmtMoney(p.price, store.currency, lang)}</b>${p.old_price > p.price ? `<s>${fmtMoney(p.old_price, store.currency, lang)}</s>` : ''}` : `<b class="ask">${L.priceOnRequest}</b>`}</div>
<span class="stk ${stock ? 'ok' : 'no'}">${stock ? L.available : L.out}</span></div></a>`;
}

function pickLang(ctx, store) {
  const q = ctx.url.searchParams.get('lang');
  return T[q] ? q : T[store.lang] ? store.lang : 'ar';
}

const productsQuery = `SELECT p.*, CASE WHEN p.track_imei = 1 THEN (SELECT COUNT(*) FROM units u WHERE u.product_id = p.id AND u.status = 'in_stock') ELSE p.qty END stock
  FROM products p WHERE p.store_id = ? AND p.published = 1 AND p.archived = 0`;
const parse = (p) => ({ ...p, images: JSON.parse(p.images || '[]') });

function home(ctx, store, base) {
  const lang = pickLang(ctx, store), L = T[lang];
  const q = ctx.url.searchParams;
  const where = [], args = [store.id];
  const text = str(q.get('q'), 60);
  if (text) { const like = `%${text.replace(/[%_]/g, '')}%`; where.push('(p.title LIKE ? OR p.brand LIKE ? OR p.model LIKE ?)'); args.push(like, like, like); }
  const brand = str(q.get('brand'), 40); if (brand) { where.push('p.brand = ?'); args.push(brand); }
  const cond = oneOf(q.get('condition'), ['new', 'used', 'refurbished'], ''); if (cond) { where.push('p.condition = ?'); args.push(cond); }
  const kind = oneOf(q.get('kind'), ['phone', 'tablet', 'accessory', 'part', 'other'], ''); if (kind) { where.push('p.kind = ?'); args.push(kind); }
  const sort = oneOf(q.get('sort'), ['latest', 'cheap', 'expensive'], 'latest');
  const order = { latest: 'stock > 0 DESC, p.featured DESC, p.updated_at DESC', cheap: 'stock > 0 DESC, p.price ASC', expensive: 'stock > 0 DESC, p.price DESC' }[sort];
  const page = int(q.get('page'), 1, 1000);
  const rows = all(`SELECT * FROM (${productsQuery} ${where.length ? 'AND ' + where.join(' AND ') : ''}) p ORDER BY ${order} LIMIT ? OFFSET ?`, ...args, PAGE + 1, (page - 1) * PAGE).map(parse);
  const more = rows.length > PAGE; rows.length = Math.min(rows.length, PAGE);
  const brands = all("SELECT brand, COUNT(*) n FROM products WHERE store_id = ? AND published = 1 AND archived = 0 AND brand != '' GROUP BY brand ORDER BY n DESC LIMIT 16", store.id);
  const kinds = all('SELECT kind, COUNT(*) n FROM products WHERE store_id = ? AND published = 1 AND archived = 0 GROUP BY kind', store.id);
  const featured = !text && !brand && !cond && !kind && page === 1 ? all(`SELECT * FROM (${productsQuery} AND p.featured = 1) p WHERE stock > 0 ORDER BY p.updated_at DESC LIMIT 8`, store.id).map(parse) : [];
  const keep = (over) => { const u = new URLSearchParams(q); for (const [k, v] of Object.entries(over)) v ? u.set(k, v) : u.delete(k); u.delete('page'); const s = u.toString(); return s ? `?${s}` : base.path; };
  const opt = (v, cur, label) => `<option value="${esc(v)}"${v === cur ? ' selected' : ''}>${esc(label)}</option>`;
  const cover = store.cover ? `<img class="cover-img" src="${img(store, store.cover)}" alt="" fetchpriority="high">` : '';
  const body = `
<section class="hero${store.cover ? ' has-cover' : ''}">${cover}<div class="wrap hero-in"><h1>${esc(store.name)}</h1>${store.tagline ? `<p>${esc(store.tagline)}</p>` : ''}
<form class="search" action="${base.path}" method="get" role="search"><input type="search" name="q" value="${esc(text)}" placeholder="${L.search}" aria-label="${L.search}"><button class="btn">${L.filter}</button></form></div></section>
<div class="wrap">
${kinds.length > 1 ? `<nav class="tabs">${[['', L.all], ...kinds.map((k) => [k.kind, L[k.kind] || k.kind])].map(([k, l]) => `<a href="${keep({ kind: k })}"${k === kind ? ' class="on"' : ''}>${esc(l)}</a>`).join('')}</nav>` : ''}
${brands.length ? `<nav class="brands">${brands.map((b) => `<a href="${keep({ brand: b.brand === brand ? '' : b.brand })}"${b.brand === brand ? ' class="on"' : ''}>${esc(b.brand)}</a>`).join('')}</nav>` : ''}
${featured.length ? `<h2 class="sec">${L.featured}</h2><div class="grid feat">${featured.map((p) => card(store, p, L, lang, base)).join('')}</div>` : ''}
<form class="filters" action="${base.path}" method="get">${text ? `<input type="hidden" name="q" value="${esc(text)}">` : ''}${kind ? `<input type="hidden" name="kind" value="${kind}">` : ''}
<label>${L.brand}<select name="brand">${opt('', brand, L.any)}${brands.map((b) => opt(b.brand, brand, b.brand)).join('')}</select></label>
<label>${L.condition}<select name="condition">${opt('', cond, L.any)}${['new', 'used', 'refurbished'].map((c) => opt(c, cond, L[c])).join('')}</select></label>
<label>${L.sort}<select name="sort">${opt('latest', sort, L.latest)}${opt('cheap', sort, L.cheap)}${opt('expensive', sort, L.expensive)}</select></label>
<button class="btn">${L.filter}</button></form>
<h2 class="sec">${L.products}</h2>
${rows.length ? `<div class="grid">${rows.map((p) => card(store, p, L, lang, base)).join('')}</div>` : `<p class="empty">${L.none}</p>`}
<nav class="pager">${page > 1 ? `<a class="btn ghost" href="?${new URLSearchParams({ ...Object.fromEntries(q), page: page - 1 })}">${L.prev}</a>` : ''}${more ? `<a class="btn ghost" href="?${new URLSearchParams({ ...Object.fromEntries(q), page: page + 1 })}">${L.next}</a>` : ''}</nav>
</div>`;
  return layout(ctx, store, L, lang, {
    title: `${store.name}${store.tagline ? ' — ' + store.tagline : ''}`, desc: store.about || store.tagline || store.name, body, base,
    image: store.cover ? img(store, store.cover) : store.logo ? img(store, store.logo) : '',
    jsonld: { '@context': 'https://schema.org', '@type': 'Store', name: store.name, telephone: store.phone || undefined, address: store.address || store.city || undefined, url: base.abs },
  });
}

function productPage(ctx, store, base, pid) {
  const lang = pickLang(ctx, store), L = T[lang];
  const row = get(`${productsQuery} AND p.id = ?`, store.id, pid);
  if (!row) return null;
  const p = parse(row);
  const q = ctx.url.searchParams;
  const price = store.show_prices && p.price ? fmtMoney(p.price, store.currency, lang) : L.priceOnRequest;
  const wa = store.whatsapp ? `https://wa.me/${store.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`${L.waMsg}: ${p.title} (${price})\n${base.abs}p/${p.id}`)}` : '';
  const gallery = p.images.length ? `<div class="gal" data-gal><div class="gal-main"><img src="${img(store, p.images[0].f)}" alt="${esc(p.title)}" width="${p.images[0].w || 800}" height="${p.images[0].h || 800}" fetchpriority="high" decoding="async"></div>
${p.images.length > 1 ? `<div class="gal-th">${p.images.map((im, i) => `<button type="button" data-src="${img(store, im.f)}" aria-label="${i + 1}"${i ? '' : ' class="on"'}><img src="${img(store, im.t || im.f)}" alt="" width="72" height="72" loading="lazy"></button>`).join('')}</div>` : ''}</div>` : '<div class="gal"><div class="gal-main noimg"></div></div>';
  const spec = [[L.brand, p.brand], [L.model, p.model], [L.storage, p.storage], [L.ram, p.ram], [L.color, p.color], [L.condition, L[p.condition]],
    [L.battery, p.battery != null && p.condition !== 'new' ? `${p.battery}%` : ''], [L.warranty, p.warranty]].filter(([, v]) => v);
  const status = q.get('ordered') === '1' ? `<p class="note ok">${L.ordered}</p>` : q.get('ordered') === '0' ? `<p class="note err">${L.orderErr}</p>` : '';
  const form = store.online_orders && p.stock > 0 ? `<form class="order" method="post" action="${base.path}order" id="order"><input type="hidden" name="lang" value="${lang}"><h2>${L.orderTitle}</h2>
<input type="hidden" name="pid" value="${p.id}"><input class="hp" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
<label>${L.name}<input name="name" required maxlength="80" autocomplete="name"></label>
<label>${L.phoneNum}<input name="phone" required maxlength="20" inputmode="tel" autocomplete="tel" dir="ltr" pattern="[0-9+ ]{8,20}"></label>
<label>${L.city}<input name="city" maxlength="60" autocomplete="address-level2"></label>
<label>${L.note}<textarea name="note" maxlength="300" rows="2"></textarea></label>
<button class="btn big">${L.send}</button></form>` : '';
  const body = `<div class="wrap"><a class="crumb" href="${base.path}${lang !== store.lang ? `?lang=${lang}` : ''}">← ${L.back}</a>${status}
<article class="prod">${gallery}<div class="prod-info"><h1>${esc(p.title)}</h1>
<div class="price big">${store.show_prices && p.price ? `<b>${price}</b>${p.old_price > p.price ? `<s>${fmtMoney(p.old_price, store.currency, lang)}</s>` : ''}` : `<b class="ask">${price}</b>`}</div>
<span class="stk ${p.stock > 0 ? 'ok' : 'no'}">${p.stock > 0 ? L.available : L.out}</span>
<div class="cta">${p.stock > 0 && store.online_orders ? `<a class="btn big" href="#order">${L.order}</a>` : ''}${wa ? `<a class="btn big wa" href="${esc(wa)}" rel="noopener" target="_blank">${L.whatsapp}</a>` : ''}${store.phone ? `<a class="btn big ghost" href="tel:${esc(store.phone)}">${L.call}</a>` : ''}</div>
${spec.length ? `<h2>${L.specs}</h2><table class="spec">${spec.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</table>` : ''}
${p.description ? `<div class="desc">${esc(p.description).replace(/\n/g, '<br>')}</div>` : ''}
${form}</div></article></div>`;
  return layout(ctx, store, L, lang, {
    title: `${p.title} — ${store.name}`, desc: `${p.title} · ${price} · ${store.name}`, body, base, image: p.images[0] ? img(store, p.images[0].f) : '',
    jsonld: {
      '@context': 'https://schema.org', '@type': 'Product', name: p.title, brand: p.brand || undefined, image: p.images.map((i) => base.origin + img(store, i.f)),
      offers: store.show_prices && p.price ? { '@type': 'Offer', price: (p.price / 100).toFixed(2), priceCurrency: store.currency, availability: p.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock', itemCondition: `https://schema.org/${p.condition === 'new' ? 'NewCondition' : p.condition === 'used' ? 'UsedCondition' : 'RefurbishedCondition'}` } : undefined,
    },
  });
}

async function placeOrder(ctx, store, base) {
  const f = await readForm(ctx.req);
  const pid = str(f.pid, 30);
  const lq = ['ar', 'fr', 'en'].includes(f.lang) && f.lang !== store.lang ? `&lang=${f.lang}` : '';
  const back = (ok) => ctx.redirect(`${base.path}p/${encodeURIComponent(pid)}?ordered=${ok ? 1 : 0}${lq}#${ok ? 'top' : 'order'}`, 303);
  if (f.website) return back(true); // bot filled the hidden field
  const origin = ctx.req.headers.origin;
  if (origin && origin !== base.origin) return back(false);
  rateLimit(`order:${store.id}:${ctx.ip}`, 6, 3600_000);
  const name = str(f.name, 80), phone = str(f.phone, 20).replace(/[^\d+ ]/g, '');
  if (name.length < 2 || phone.replace(/\D/g, '').length < 8 || !store.online_orders) return back(false);
  const p = get('SELECT id, title, price FROM products WHERE id = ? AND store_id = ? AND published = 1 AND archived = 0', pid, store.id);
  if (!p) return back(false);
  const t = now();
  run('INSERT INTO orders (id, store_id, product_id, product_title, price, name, phone, city, note, ip_hash, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
    'o_' + rid(8), store.id, p.id, p.title, p.price, name, phone, str(f.city, 60), str(f.note, 300),
    crypto.createHash('sha256').update(ctx.ip + config.secret).digest('base64url').slice(0, 16), t, t);
  return back(true);
}

function simplePage(store, title, msg) {
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<link rel="stylesheet" href="${assets['/static/css/store.css']}"></head><body data-theme="clean"><main class="wrap empty-page"><h1>${esc(title)}</h1><p>${esc(msg)}</p>
<p><a href="${config.publicUrl}/">${esc(config.appName)}</a></p></main></body></html>`;
}

// slug from host ("<slug>.mobile.1zayd1.tech") or from path ("/s/<slug>/...").
export async function handleStorefront(ctx, slug, base, rest) {
  const store = get('SELECT * FROM stores WHERE slug = ?', slug);
  const html = (code, s, cache = 'public, max-age=30') => ctx.send(code, s, { 'content-type': 'text/html; charset=utf-8', 'cache-control': cache });
  if (!store) return html(404, simplePage(null, '404', T.ar.notFound + ' · ' + T.fr.notFound), 'no-store');
  if (store.status !== 'active') return html(503, simplePage(store, store.name, T.ar.unavailable + ' — ' + T.fr.unavailable), 'no-store');
  if (rest === '' || rest === '/') {
    if (ctx.req.method !== 'GET' && ctx.req.method !== 'HEAD') return html(405, 'Method not allowed');
    return html(200, home(ctx, store, base));
  }
  let m;
  if ((m = rest.match(/^\/p\/(p_[\w-]{8,20})\/?$/))) {
    const page = productPage(ctx, store, base, m[1]);
    return page ? html(200, page, ctx.url.searchParams.has('ordered') ? 'no-store' : 'public, max-age=30') : html(404, simplePage(store, '404', T[pickLang(ctx, store)].notFound), 'no-store');
  }
  if (rest === '/order' && ctx.req.method === 'POST') return placeOrder(ctx, store, base);
  if (rest === '/robots.txt') return ctx.send(200, `User-agent: *\nAllow: /\nSitemap: ${base.abs}sitemap.xml\n`, { 'content-type': 'text/plain' });
  if (rest === '/sitemap.xml') {
    const ps = all('SELECT id, updated_at FROM products WHERE store_id = ? AND published = 1 AND archived = 0 ORDER BY updated_at DESC LIMIT 5000', store.id);
    const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${base.abs}</loc></url>${ps.map((p) => `<url><loc>${base.abs}p/${p.id}</loc><lastmod>${new Date(p.updated_at).toISOString().slice(0, 10)}</lastmod></url>`).join('')}</urlset>`;
    return ctx.send(200, xml, { 'content-type': 'application/xml' });
  }
  return html(404, simplePage(store, '404', T[pickLang(ctx, store)].notFound), 'no-store');
}
