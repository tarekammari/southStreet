// Store dashboard (single page app, hash routing).
'use strict';
(() => {
  const { fill, h, t, api, money, date, dateTime, toMajor, toast, showErr, modal, confirmBox, field, input, select, formData, busy } = MS;
  const S = { me: null, store: null, settings: null, cart: [], cartMeta: {} };
  const RANK = { seller: 1, manager: 2, owner: 3 };
  const can = (r) => RANK[S.store?.role] >= RANK[r];
  const sid = () => S.store.id;
  const A = (path) => `/api/s/${sid()}/${path}`;
  const cur = () => S.settings?.store.currency || 'DZD';
  const m$ = (v) => money(v, cur());
  const go = (hash) => { location.hash = hash; };
  const tzo = new Date().getTimezoneOffset();
  const root = document.getElementById('root');
  let main;

  const ICONS = {
    dashboard: 'M3 13h8V3H3zm10 8h8V11h-8zM3 21h8v-6H3zm10-18v6h8V3z', pos: 'M7 4h10l1 4H6zM5 8h14v12H5zm4 4v4m6-4v4',
    products: 'M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm3 17h2', sales: 'M4 4h16v16l-3-2-3 2-2-2-2 2-3-2-3 2zM8 9h8M8 13h5',
    customers: 'M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0zM4 21a8 8 0 0 1 16 0', orders: 'M3 7h18l-2 13H5zM8 7a4 4 0 0 1 8 0', more: 'M5 12h.01M12 12h.01M19 12h.01',
    stock: 'M4 7l8-4 8 4-8 4zm0 5l8 4 8-4M4 17l8 4 8-4', suppliers: 'M3 17h2a2 2 0 1 0 4 0h6a2 2 0 1 0 4 0h2v-5l-3-5h-4V5H3z', expenses: 'M12 3v18M17 7H9.5a3 3 0 0 0 0 6h5a3 3 0 0 1 0 6H6',
    reports: 'M4 20V10m6 10V4m6 16v-7m4 7H2', staff: 'M17 20a5 5 0 0 0-10 0M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm8 8a4 4 0 0 0-3-3.9M17 4.1a4 4 0 0 1 0 7.8',
    settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm8-3 2-1-2-4-2 1-2-1V5h-4v2L8 8 6 7l-2 4 2 1v2l-2 1 2 4 2-1 2 1v2h4v-2l2-1 2 1 2-4-2-1z',
    devices: 'M3 5h13v10H3zm4 14h5M18 8h3v12h-3z', audit: 'M12 8v4l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', scan: 'M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4M7 12h10',
  };
  const icon = (name) => {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('class', 'ic'); s.setAttribute('aria-hidden', 'true');
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', ICONS[name] || ICONS.more); s.append(p);
    return s;
  };
  const NAV = [['dashboard', '#/'], ['pos', '#/pos'], ['products', '#/products'], ['sales', '#/sales'], ['customers', '#/customers'], ['orders', '#/orders'],
    ['stock', '#/stock', 'manager'], ['suppliers', '#/suppliers', 'manager'], ['expenses', '#/expenses', 'manager'], ['reports', '#/reports', 'manager'],
    ['staff', '#/staff'], ['settings', '#/settings', 'owner'], ['audit', '#/audit', 'owner'], ['devices', '#/devices']];
  const MOBILE_NAV = ['dashboard', 'pos', 'products', 'sales'];

  // ---------- boot ----------
  async function boot() {
    S.me = await api('GET', '/api/me');
    if (!S.me.user) { location.href = '/login?next=/app'; return; }
    let chosen = null;
    try { chosen = localStorage.getItem('ms_store'); } catch { /* ignore */ }
    S.store = S.me.stores.find((s) => s.id === chosen) || S.me.stores[0] || null;
    if (!S.store) return renderOnboarding();
    await loadSettings();
    renderLayout();
    window.addEventListener('hashchange', route);
    route();
  }
  async function loadSettings() {
    try { S.settings = await api('GET', A('settings')); } catch (e) { S.settings = null; if (e.code === 'store_suspended') S.suspended = true; }
  }
  function switchStore(id) {
    try { localStorage.setItem('ms_store', id); } catch { /* ignore */ }
    location.hash = '#/'; location.reload();
  }

  function renderLayout() {
    const navLink = ([k, href, role]) => (role && !can(role) ? null : h('a', { href, 'data-k': k, class: 'nav-a' }, icon(k), h('span', null, t(k))));
    const storeSel = S.me.stores.length > 1
      ? select('store', S.me.stores.map((s) => [s.id, s.name]), S.store.id, { class: 'in store-sel', onchange: (e) => switchStore(e.target.value), 'aria-label': t('stores') })
      : h('b', { class: 'store-name' }, S.store.name);
    const user = S.me.user;
    const langSel = select('lang', [['ar', 'العربية'], ['fr', 'Français'], ['en', 'English']], MS.lang, { class: 'in sm', onchange: (e) => { MS.setLang(e.target.value); renderLayout(); route(); } });
    const menu = h('div', { class: 'menu', hidden: true },
      h('p', { class: 'muted sm' }, user.email), langSel,
      h('a', { class: 'menu-a', href: S.store.url, target: '_blank', rel: 'noopener' }, t('myStore'), ' ↗'),
      h('a', { class: 'menu-a', href: '#/new-store' }, '+ ', t('createStore')),
      user.is_super ? h('a', { class: 'menu-a', href: '/admin' }, t('admin')) : null,
      h('button', { class: 'menu-a', onclick: async () => { await api('POST', '/api/logout'); location.href = '/'; } }, t('logout')));
    const avatar = h('button', { class: 'avatar', 'aria-label': user.name, onclick: (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; } },
      user.picture ? h('img', { src: user.picture, alt: '', width: 34, height: 34, referrerpolicy: 'no-referrer' }) : h('span', null, (user.name || '?')[0]));
    document.addEventListener('click', () => { menu.hidden = true; });
    main = h('main', { class: 'main', id: 'main' });
    const ann = S.me.announcement ? h('div', { class: 'announce' }, S.me.announcement) : null;
    const plan = S.settings?.store;
    const trial = plan && plan.plan === 'trial' && plan.plan_expires ? h('div', { class: 'trial' }, `${t('trialEnds')}: ${date(plan.plan_expires)}`) : null;
    fill(root, 
      h('aside', { class: 'side' }, h('a', { class: 'logo', href: '#/' }, h('img', { src: document.querySelector('link[rel=icon]').href, alt: '', width: 30, height: 30 }), h('b', null, S.me.app)),
        h('nav', null, NAV.map(navLink))),
      h('div', { class: 'body' },
        h('header', { class: 'bar' }, storeSel, h('div', { class: 'bar-act' },
          h('button', { class: 'icon-btn', title: t('scanPc'), 'aria-label': t('scanPc'), onclick: scanPcLogin }, icon('scan')),
          h('div', { class: 'av-wrap' }, avatar, menu))),
        ann, trial, main),
      h('nav', { class: 'tabbar' }, MOBILE_NAV.map((k) => navLink(NAV.find((n) => n[0] === k))),
        h('a', { href: '#/more', 'data-k': 'more', class: 'nav-a' }, icon('more'), h('span', null, t('more')))),
      h('div', { id: 'print' }));
  }

  // ---------- router ----------
  const ROUTES = [
    [/^#?\/?$/, viewDashboard], [/^#\/pos$/, viewPos], [/^#\/products$/, viewProducts], [/^#\/products\/new$/, () => viewProductForm(null)],
    [/^#\/products\/(p_[\w-]+)$/, (id) => viewProduct(id)], [/^#\/products\/(p_[\w-]+)\/edit$/, (id) => viewProductForm(id)],
    [/^#\/sales$/, viewSales], [/^#\/sales\/(x_[\w-]+)$/, viewSale], [/^#\/customers$/, viewCustomers], [/^#\/customers\/(c_[\w-]+)$/, viewCustomer],
    [/^#\/orders$/, viewOrders], [/^#\/stock$/, viewMoves], [/^#\/suppliers$/, viewSuppliers], [/^#\/expenses$/, viewExpenses], [/^#\/reports$/, viewReports],
    [/^#\/staff$/, viewStaff], [/^#\/settings$/, viewSettings], [/^#\/devices$/, viewDevices], [/^#\/audit$/, viewAudit], [/^#\/more$/, viewMore],
    [/^#\/new-store$/, () => renderOnboarding(true)],
  ];
  async function route() {
    const hash = location.hash.split('?')[0] || '#/';
    if (S.suspended && hash !== '#/new-store') { fill(main, h('div', { class: 'card center' }, h('h2', null, MS.errText('store_suspended')))); return; }
    document.querySelectorAll('.nav-a').forEach((a) => a.classList.toggle('on', hash === a.getAttribute('href') || (a.getAttribute('href') !== '#/' && hash.startsWith(a.getAttribute('href') + '/'))));
    for (const [re, fn] of ROUTES) {
      const m = hash.match(re);
      if (!m) continue;
      fill(main, h('div', { class: 'boot' }, h('span', { class: 'spin' })));
      try {
        const view = await fn(...m.slice(1));
        if (view) fill(main, view);
      } catch (e) { if (e.message !== 'auth') { fill(main, h('div', { class: 'card' }, MS.errText(e.code || 'network'))); } }
      window.scrollTo(0, 0);
      return;
    }
    go('#/');
  }
  const qs = () => new URLSearchParams(location.hash.split('?')[1] || '');

  const page = (title, actions, ...body) => h('section', { class: 'page' }, h('div', { class: 'page-head' }, h('h1', null, title), h('div', { class: 'row' }, actions)), body);
  const kpi = (label, value, sub, tone) => h('div', { class: `kpi ${tone || ''}` }, h('span', null, label), h('b', null, value), sub ? h('small', null, sub) : null);
  const thumb = (p, size = 44) => {
    const im = p.images?.[0];
    return im ? h('img', { class: 'thumb', src: MS.imgUrl(sid(), im.t || im.f), alt: '', width: size, height: size, loading: 'lazy' }) : h('span', { class: 'thumb ph' }, icon('products'));
  };
  const badge = (txt, tone) => h('span', { class: `badge ${tone || ''}` }, txt);
  const stockBadge = (p) => badge(`${p.stock}`, p.stock <= 0 ? 'red' : p.stock <= (S.settings?.store.low_stock ?? 2) ? 'amber' : 'green');
  const empty = () => h('p', { class: 'muted center pad' }, t('empty'));
  function table(cols, rows, onRow) {
    if (!rows.length) return empty();
    return h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' },
      h('thead', null, h('tr', null, cols.map((c) => h('th', { class: c.num ? 'num' : '' }, c.label)))),
      h('tbody', null, rows.map((r) => h('tr', { class: onRow ? 'click' : '', onclick: onRow ? () => onRow(r) : null }, cols.map((c) => h('td', { class: c.num ? 'num' : '', 'data-l': c.label }, c.render(r))))))));
  }

  // ---------- dashboard ----------
  async function viewDashboard() {
    const d = await api('GET', A(`summary?tzo=${tzo}`));
    const today0 = new Date(); today0.setHours(0, 0, 0, 0);
    const from = new Date(today0); from.setDate(from.getDate() - 29);
    const pts = MS.fillDays(d.days, from, today0);
    const url = S.store.url;
    return page(t('dashboard'), [h('a', { class: 'btn primary', href: '#/pos' }, '+ ', t('newSale'))],
      h('div', { class: 'kpis' },
        kpi(t('today'), m$(d.today.total), `${d.today.n} ${t('sales')}${d.today.profit !== undefined ? ' · ' + t('profit') + ' ' + m$(d.today.profit) : ''}`, 'blue'),
        kpi(t('last30'), m$(d.month.total), `${d.month.n} ${t('sales')}`),
        d.month.profit !== undefined ? kpi(`${t('profit')} · ${t('last30')}`, m$(d.month.profit), null, 'green') : null,
        kpi(t('stockItems'), String(d.stock.items), d.stock.value !== undefined ? `${t('stockValue')}: ${m$(d.stock.value)}` : `${d.stock.products} ${t('products')}`),
        d.orders ? h('a', { href: '#/orders', class: 'kpi amber' }, h('span', null, t('newOrders')), h('b', null, String(d.orders))) : null,
        d.debt ? kpi(t('debts'), m$(d.debt), null, 'red') : null),
      h('div', { class: 'grid2' },
        h('div', { class: 'card' }, h('h2', null, t('last30')), MS.barChart(pts, { label: (p) => `${m$(p.total)} · ${p.n}` })),
        h('div', { class: 'card' }, h('h2', null, t('quick')), h('div', { class: 'quick' },
          h('a', { class: 'qa', href: '#/pos' }, icon('pos'), t('newSale')),
          can('manager') ? h('a', { class: 'qa', href: '#/products/new' }, icon('products'), t('addProduct')) : null,
          h('button', { class: 'qa', onclick: scanPcLogin }, icon('scan'), t('scanPc')),
          h('a', { class: 'qa', href: url, target: '_blank', rel: 'noopener' }, icon('orders'), t('seeStore'))),
        h('p', { class: 'muted sm' }, t('shareStore')), h('div', { class: 'row' }, h('code', { class: 'url' }, url),
          h('button', { class: 'btn sm ghost', onclick: () => { navigator.clipboard?.writeText(url); toast(t('copied')); } }, t('copy'))))),
      h('div', { class: 'grid3' },
        h('div', { class: 'card' }, h('h2', null, t('lowStock')), d.low.length ? h('ul', { class: 'list' }, d.low.map((p) => h('li', null, h('a', { href: `#/products/${p.id}` }, thumb(p, 32), h('span', null, p.title), stockBadge(p))))) : empty()),
        h('div', { class: 'card' }, h('h2', null, t('topProducts')), d.top.length ? h('ul', { class: 'list' }, d.top.map((p) => h('li', null, h('span', null, p.title), h('b', null, `×${p.qty}`)))) : empty()),
        h('div', { class: 'card' }, h('h2', null, t('recentSales')), d.recent.length ? h('ul', { class: 'list' }, d.recent.map((x) => h('li', null,
          h('a', { href: `#/sales/${x.id}` }, h('span', null, `#${x.number} · ${dateTime(x.created_at)}`), h('b', { class: x.status === 'refunded' ? 'strike' : '' }, m$(x.total)))))) : empty())));
  }

  // ---------- POS ----------
  async function viewPos() {
    const order = qs().get('order'), addPid = qs().get('add');
    const resultsBox = h('div', { class: 'pos-results' });
    const cartBox = h('div', { class: 'pos-cart' });
    const search = input({ type: 'search', placeholder: t('search'), autocomplete: 'off' });
    let all = [];
    const load = async () => { all = (await api('GET', A('products'))).products; showResults(); };
    const showResults = () => {
      const q = search.value.trim().toLowerCase();
      const list = all.filter((p) => p.stock > 0 && (!q || `${p.title} ${p.brand} ${p.model} ${p.sku}`.toLowerCase().includes(q))).slice(0, 60);
      fill(resultsBox, ...(list.length ? list.map((p) => h('button', { class: 'pos-item', onclick: () => addProduct(p) }, thumb(p, 48),
        h('span', { class: 'pi-t' }, p.title), h('span', { class: 'pi-p' }, m$(p.price)), stockBadge(p))) : [empty()]));
    };
    search.addEventListener('input', showResults);
    search.addEventListener('keydown', async (e) => { if (e.key === 'Enter') { e.preventDefault(); await lookup(search.value.trim()); } });

    async function lookup(code) {
      if (!code) return;
      const r = await api('GET', A(`lookup?code=${encodeURIComponent(code)}`)).catch(showErr);
      if (!r) return;
      const hit = r.results[0];
      if (!hit) { search.value = code; showResults(); return; }
      if (hit.unit) {
        if (hit.unit.status !== 'in_stock') return toast(MS.errText('unit_not_available', hit.unit.imei), 'err');
        addLine({ product_id: hit.product.id, title: hit.product.title, price: hit.product.price, unit_id: hit.unit.id, imei: hit.unit.imei, qty: 1 });
      } else addProduct(hit.product);
      search.value = '';
      showResults();
    }
    async function addProduct(p) {
      if (!p.track_imei) {
        const ex = S.cart.find((l) => l.product_id === p.id && !l.unit_id);
        if (ex) { ex.qty++; drawCart(); return; }
        return addLine({ product_id: p.id, title: p.title, price: p.price, qty: 1, max: p.stock });
      }
      const { units } = await api('GET', A(`products/${p.id}/units`));
      const free = units.filter((u) => !S.cart.some((l) => l.unit_id === u.id));
      if (!free.length) return toast(MS.errText('not_enough_stock'), 'err');
      if (free.length === 1) return addLine({ product_id: p.id, title: p.title, price: p.price, unit_id: free[0].id, imei: free[0].imei, qty: 1 });
      const m = modal(t('chooseImei'), h('div', { class: 'imei-pick' }, free.map((u) => h('button', { class: 'btn ghost', dir: 'ltr', onclick: () => { m.close(); addLine({ product_id: p.id, title: p.title, price: p.price, unit_id: u.id, imei: u.imei, qty: 1 }); } }, u.imei, u.note ? ` · ${u.note}` : ''))));
    }
    function addLine(l) { S.cart.push(l); navigator.vibrate?.(30); drawCart(); }

    const custName = input({ name: 'cname', placeholder: t('customerName'), autocomplete: 'off' });
    const custPhone = input({ name: 'cphone', placeholder: t('phoneNum'), inputmode: 'tel', dir: 'ltr', autocomplete: 'off' });
    const custList = h('div', { class: 'suggest' });
    let customerId = null, timer;
    const suggest = () => {
      customerId = null;
      clearTimeout(timer);
      const q = (custPhone.value || custName.value).trim();
      if (q.length < 2) { fill(custList, ); return; }
      timer = setTimeout(async () => {
        const { customers } = await api('GET', A(`customers?q=${encodeURIComponent(q)}`));
        fill(custList, ...customers.slice(0, 5).map((c) => h('button', { type: 'button', onclick: () => { customerId = c.id; custName.value = c.name; custPhone.value = c.phone; fill(custList, ); } },
          c.name, ' ', h('small', { dir: 'ltr' }, c.phone), c.debt > 0 ? badge(`${t('debt')} ${m$(c.debt)}`, 'red') : null)));
      }, 250);
    };
    custName.addEventListener('input', suggest); custPhone.addEventListener('input', suggest);
    const discount = input({ type: 'number', min: 0, step: 'any', inputmode: 'decimal', placeholder: '0' });
    const method = select('method', ['cash', 'card', 'ccp', 'baridimob', 'transfer', 'credit'].map((k) => [k, t(k)]), 'cash');
    const paid = input({ type: 'number', min: 0, step: 'any', inputmode: 'decimal' });
    const note = input({ placeholder: t('note') });
    const totals = h('div', { class: 'pos-totals' });
    const sum = () => {
      const sub = S.cart.reduce((a, l) => a + l.price * l.qty, 0);
      const disc = Math.min(Math.round((Number(discount.value) || 0) * 100), sub);
      return { sub, disc, total: sub - disc };
    };
    function drawCart() {
      const { sub, disc, total } = sum();
      const lines = S.cart.map((l, i) => h('div', { class: 'cl' },
        h('div', { class: 'cl-t' }, h('b', null, l.title), l.imei ? h('small', { dir: 'ltr' }, 'IMEI ', l.imei) : null),
        l.unit_id ? h('span', { class: 'muted' }, '×1') : h('input', { class: 'in qty', type: 'number', min: 1, value: l.qty, onchange: (e) => { l.qty = Math.max(1, Number(e.target.value) || 1); drawCart(); } }),
        h('input', { class: 'in price', type: 'number', min: 0, step: 'any', value: l.price / 100, 'aria-label': t('price'), onchange: (e) => { l.price = Math.round((Number(e.target.value) || 0) * 100); drawCart(); } }),
        h('button', { class: 'icon-btn', 'aria-label': t('remove'), onclick: () => { S.cart.splice(i, 1); drawCart(); } }, '✕')));
      const rest = paid.value === '' ? 0 : Math.max(0, total - Math.round(Number(paid.value) * 100));
      const change = paid.value !== '' && method.value === 'cash' ? Math.max(0, Math.round(Number(paid.value) * 100) - total) : 0;
      fill(totals, 
        h('div', { class: 'tr' }, h('span', null, t('subtotal')), h('span', null, m$(sub))),
        disc ? h('div', { class: 'tr' }, h('span', null, t('discount')), h('span', null, '-' + m$(disc))) : null,
        h('div', { class: 'tr big' }, h('span', null, t('total')), h('b', null, m$(total))),
        rest && method.value !== 'cash' ? h('div', { class: 'tr red' }, h('span', null, t('rest')), h('b', null, m$(rest))) : null,
        change ? h('div', { class: 'tr green' }, h('span', null, t('change')), h('b', null, m$(change))) : null);
      fill(cartBox.querySelector('.cl-list'), ...(lines.length ? lines : [h('p', { class: 'muted center pad' }, t('cartEmpty'))]));
    }
    [discount, paid].forEach((el) => el.addEventListener('input', drawCart));
    method.addEventListener('change', () => { if (method.value === 'credit') paid.value = '0'; drawCart(); });
    const doneBtn = h('button', { class: 'btn primary big block', onclick: () => busy(doneBtn, async () => {
      if (!S.cart.length) throw Object.assign(new Error(), { code: 'cart_empty' });
      const { total } = sum();
      const payload = {
        items: S.cart.map((l) => ({ product_id: l.product_id, unit_id: l.unit_id, qty: l.qty, price: l.price / 100 })),
        discount: discount.value || 0, method: method.value, note: note.value, order_id: S.cartMeta.order_id,
        paid: method.value === 'cash' || paid.value === '' ? (method.value === 'credit' ? 0 : undefined) : Math.min(Number(paid.value), total / 100),
        customer: customerId ? { id: customerId } : (custName.value || custPhone.value ? { name: custName.value, phone: custPhone.value } : null),
      };
      const r = await api('POST', A('sales'), payload);
      S.cart = []; S.cartMeta = {};
      toast(`${t('sale')} #${r.number} ✓`);
      [discount, paid, note, custName, custPhone].forEach((el) => { el.value = ''; }); customerId = null; method.value = 'cash';
      await load(); drawCart();
      showReceipt(r.id);
    }) }, t('complete'));
    cartBox.append(h('h2', null, t('cart')), h('div', { class: 'cl-list' }),
      h('details', { class: 'pos-cust' }, h('summary', null, t('customer'), ' · ', h('small', { class: 'muted' }, t('optional'))), custName, custPhone, custList),
      h('div', { class: 'pos-pay' }, field(t('discount'), discount), field(t('method'), method), field(t('received'), paid)), note, totals, doneBtn);

    if (order) {
      const { orders } = await api('GET', A('orders'));
      const o = orders.find((x) => x.id === order);
      if (o) { S.cartMeta.order_id = o.id; custName.value = o.name; custPhone.value = o.phone; }
    }
    await load();
    if (addPid) { const p = all.find((x) => x.id === addPid); if (p) await addProduct(p); }
    drawCart();
    setTimeout(() => search.focus(), 50);
    return h('section', { class: 'page pos' },
      h('div', { class: 'pos-left' }, h('div', { class: 'row' }, search, h('button', { class: 'btn primary', onclick: async () => { const c = await MS.scan(); if (c) lookup(c); } }, icon('scan'), t('scan'))), resultsBox),
      cartBox);
  }

  // ---------- receipt ----------
  async function receiptNode(id) {
    const { sale, items } = await api('GET', A(`sales/${id}`));
    const st = S.settings.store;
    return { sale, items, node: h('div', { class: 'receipt' },
      st.logo ? h('img', { src: MS.imgUrl(sid(), st.logo), alt: '', class: 'r-logo', width: 64, height: 64 }) : null,
      h('h3', null, st.name), st.address || st.city ? h('p', null, [st.address, st.city].filter(Boolean).join(', ')) : null, st.phone ? h('p', { dir: 'ltr' }, st.phone) : null,
      h('p', { class: 'r-meta' }, `${t('receipt')} #${sale.number} · ${dateTime(sale.created_at)}`),
      sale.customer_name ? h('p', null, `${t('customer')}: ${sale.customer_name} ${sale.customer_phone || ''}`) : null,
      h('table', null, items.map((i) => h('tr', null, h('td', null, i.title, i.imei ? h('div', { class: 'r-imei', dir: 'ltr' }, 'IMEI ', i.imei) : null), h('td', null, `×${i.qty}`), h('td', { class: 'num' }, m$(i.price * i.qty))))),
      h('div', { class: 'r-tot' },
        sale.discount ? h('p', null, h('span', null, t('discount')), h('span', null, '-' + m$(sale.discount))) : null,
        h('p', { class: 'big' }, h('span', null, t('total')), h('b', null, m$(sale.total))),
        h('p', null, h('span', null, t(sale.method)), h('span', null, m$(sale.paid))),
        sale.total > sale.paid ? h('p', null, h('span', null, t('rest')), h('b', null, m$(sale.total - sale.paid))) : null,
        sale.status === 'refunded' ? h('p', { class: 'big' }, t('refunded')) : null),
      h('p', { class: 'r-foot' }, st.receipt_note || t('thanks'))) };
  }
  function printNode(node) {
    const box = document.getElementById('print');
    fill(box, node.cloneNode(true));
    window.print();
  }
  async function showReceipt(id) {
    const { node, sale } = await receiptNode(id);
    const m = modal(`${t('receipt')} #${sale.number}`, [node, h('div', { class: 'row end' },
      h('a', { class: 'btn ghost', href: `#/sales/${id}`, onclick: () => m.close() }, t('open')),
      h('button', { class: 'btn primary', onclick: () => printNode(node) }, t('print')))]);
  }

  // ---------- products ----------
  async function viewProducts() {
    const q = qs();
    const filters = { q: q.get('q') || '', kind: q.get('kind') || '', brand: q.get('brand') || '', stock: q.get('stock') || '', archived: q.get('archived') || '' };
    const data = await api('GET', A(`products?${new URLSearchParams(filters)}`));
    const apply = (k, v) => { filters[k] = v; go(`#/products?${new URLSearchParams(Object.entries(filters).filter(([, x]) => x))}`); };
    const search = input({ type: 'search', placeholder: t('search'), value: filters.q });
    search.addEventListener('keydown', (e) => { if (e.key === 'Enter') apply('q', search.value.trim()); });
    const list = data.products;
    return page(t('products'), [can('manager') ? h('a', { class: 'btn primary', href: '#/products/new' }, '+ ', t('addProduct')) : null],
      h('div', { class: 'filters' }, search,
        h('button', { class: 'btn ghost', title: t('scan'), onclick: async () => { const c = await MS.scan(); if (c) apply('q', c); } }, icon('scan')),
        select('kind', [['', `${t('kind')}: ${t('all')}`], ...['phone', 'tablet', 'accessory', 'part', 'other'].map((k) => [k, t(k)])], filters.kind, { onchange: (e) => apply('kind', e.target.value) }),
        data.brands.length ? select('brand', [['', `${t('brand')}: ${t('all')}`], ...data.brands.map((b) => [b, b])], filters.brand, { onchange: (e) => apply('brand', e.target.value) }) : null,
        select('stock', [['', `${t('onHand')}: ${t('all')}`], ['low', t('lowStock')], ['out', t('out')]], filters.stock, { onchange: (e) => apply('stock', e.target.value) }),
        h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: filters.archived === '1', onchange: (e) => apply('archived', e.target.checked ? '1' : '') }), t('archived'))),
      h('div', { class: 'card flush' }, table([
        { label: '', render: (p) => thumb(p) },
        { label: t('title'), render: (p) => h('div', null, h('b', null, p.title), h('div', { class: 'muted sm' }, [t(p.kind), p.condition !== 'new' ? t(p.condition) : '', p.sku].filter(Boolean).join(' · '))) },
        { label: t('price'), num: true, render: (p) => m$(p.price) },
        can('manager') ? { label: t('cost'), num: true, render: (p) => m$(p.cost) } : null,
        { label: t('onHand'), num: true, render: (p) => stockBadge(p) },
        { label: t('published'), render: (p) => (p.published ? '●' : '○') },
      ].filter(Boolean), list, (p) => go(`#/products/${p.id}`))));
  }

  const BRANDS = ['Apple', 'Samsung', 'Xiaomi', 'Redmi', 'Oppo', 'Realme', 'Vivo', 'Huawei', 'Honor', 'Infinix', 'Tecno', 'Itel', 'Nokia', 'Motorola', 'Google', 'OnePlus', 'Condor', 'Iris', 'ZTE', 'Sony', 'Lenovo'];

  async function viewProductForm(id) {
    const [{ suppliers }, existing] = await Promise.all([api('GET', A('suppliers')).catch(() => ({ suppliers: [] })), id ? api('GET', A(`products/${id}`)) : null]);
    const p = existing?.product || { kind: 'phone', condition: 'new', published: 1, track_imei: 1, images: [] };
    let images = [...(p.images || [])];
    const imgBox = h('div', { class: 'img-grid' });
    const drawImages = () => fill(imgBox, ...images.map((im, i) => h('figure', null, h('img', { src: MS.imgUrl(sid(), im.t || im.f), alt: '', width: 96, height: 96 }),
      h('div', { class: 'img-act' },
        i ? h('button', { type: 'button', class: 'icon-btn', 'aria-label': '←', onclick: () => { [images[i - 1], images[i]] = [images[i], images[i - 1]]; drawImages(); } }, '★') : h('small', null, '★'),
        h('button', { type: 'button', class: 'icon-btn', 'aria-label': t('delete'), onclick: () => { images.splice(i, 1); drawImages(); } }, '✕')))),
    images.length < 8 ? h('label', { class: 'img-add' }, h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true, onchange: onFiles }), '+', h('small', null, t('addPhotos'))) : null);
    async function onFiles(e) {
      const files = [...e.target.files].slice(0, 8 - images.length);
      toast(t('uploading'));
      for (const f of files) {
        try { images.push(await MS.uploadImage(sid(), f)); drawImages(); } catch (err) { showErr(err); }
      }
    }
    drawImages();
    const kind = select('kind', ['phone', 'tablet', 'accessory', 'part', 'other'].map((k) => [k, t(k)]), p.kind);
    const track = h('input', { type: 'checkbox', name: 'track_imei', checked: !!p.track_imei, disabled: !!id });
    kind.addEventListener('change', () => { if (!id) track.checked = ['phone', 'tablet'].includes(kind.value); toggleStock(); });
    const brandIn = input({ name: 'brand', value: p.brand || '', list: 'brands', autocomplete: 'off' });
    const sku = input({ name: 'sku', value: p.sku || '', dir: 'ltr' });
    const imeis = h('textarea', { class: 'in mono', name: 'imeis', rows: 4, dir: 'ltr', placeholder: '356938035643809' });
    const qty = input({ name: 'qty', type: 'number', min: 0, value: '' });
    const stockBox = h('div', { class: 'card sub' });
    const toggleStock = () => {
      fill(stockBox, h('h3', null, t('openingStock'), ' ', h('small', { class: 'muted' }, t('optional'))),
        track.checked ? [field(t('imeis'), imeis), h('button', { type: 'button', class: 'btn ghost sm', onclick: async () => { const c = await MS.scan(); if (c) imeis.value = (imeis.value.trim() + '\n' + c).trim(); } }, icon('scan'), t('scan'))] : field(t('qty'), qty),
        suppliers.length ? field(t('supplier'), select('supplier_id', [['', t('none')], ...suppliers.map((s) => [s.id, s.name])], '')) : null);
    };
    toggleStock();
    const form = h('form', { class: 'form', onsubmit: (e) => { e.preventDefault(); save(); } },
      h('datalist', { id: 'brands' }, BRANDS.map((b) => h('option', { value: b }))),
      h('div', { class: 'card' }, h('h3', null, t('images')), imgBox, h('p', { class: 'muted sm' }, 'WebP · ≤1280px')),
      h('div', { class: 'card fgrid' },
        field(t('kind'), kind), field(t('brand'), brandIn), field(t('model'), input({ name: 'model', value: p.model || '' })),
        field(t('storage'), input({ name: 'storage', value: p.storage || '', list: 'storages', placeholder: '128GB' })), field(t('ram'), input({ name: 'ram', value: p.ram || '', placeholder: '8GB' })),
        field(t('color'), input({ name: 'color', value: p.color || '' })),
        field(t('condition'), select('condition', ['new', 'used', 'refurbished'].map((k) => [k, t(k)]), p.condition)),
        field(t('battery'), input({ name: 'battery', type: 'number', min: 0, max: 100, value: p.battery ?? '' })),
        field(t('warranty'), input({ name: 'warranty', value: p.warranty || '', placeholder: '6 mois' })),
        field(t('title'), input({ name: 'title', value: p.title || '' }), t('optional')),
        field(t('sku'), h('div', { class: 'row' }, sku, h('button', { type: 'button', class: 'btn ghost', onclick: async () => { const c = await MS.scan(); if (c) sku.value = c; } }, icon('scan'))))),
      h('datalist', { id: 'storages' }, ['32GB', '64GB', '128GB', '256GB', '512GB', '1TB'].map((v) => h('option', { value: v }))),
      h('div', { class: 'card fgrid' },
        field(t('cost'), input({ name: 'cost', type: 'number', min: 0, step: 'any', inputmode: 'decimal', value: toMajor(p.cost) })),
        field(t('price'), input({ name: 'price', type: 'number', min: 0, step: 'any', inputmode: 'decimal', value: toMajor(p.price), required: true })),
        field(t('oldPrice'), input({ name: 'old_price', type: 'number', min: 0, step: 'any', inputmode: 'decimal', value: toMajor(p.old_price) }), t('optional'))),
      h('div', { class: 'card' }, field(t('description'), h('textarea', { class: 'in', name: 'description', rows: 4 }, p.description || '')),
        h('label', { class: 'chk' }, h('input', { type: 'checkbox', name: 'published', checked: !!p.published }), t('published')),
        h('label', { class: 'chk' }, h('input', { type: 'checkbox', name: 'featured', checked: !!p.featured }), t('featured')),
        h('label', { class: 'chk' }, track, t('trackImei'))),
      id ? null : stockBox,
      h('div', { class: 'row end sticky-act' }, h('a', { class: 'btn ghost', href: id ? `#/products/${id}` : '#/products' }, t('cancel')), h('button', { class: 'btn primary big' }, t('save'))));
    async function save() {
      const btn = form.querySelector('button.primary');
      await busy(btn, async () => {
        const d = formData(form);
        d.images = images;
        if (!id) d.imeis = String(d.imeis || '').split(/[\s,;]+/).filter(Boolean);
        const r = id ? await api('PUT', A(`products/${id}`), d) : await api('POST', A('products'), d);
        toast(t('saved'));
        go(`#/products/${id || r.id}`);
      });
    }
    return page(id ? t('edit') : t('addProduct'), [], form);
  }

  async function viewProduct(id) {
    const { product: p, units, moves } = await api('GET', A(`products/${id}`));
    const refresh = () => route();
    const unitRows = units.map((u) => ({ ...u }));
    const receiveForm = () => {
      const imeis = h('textarea', { class: 'in mono', rows: 5, dir: 'ltr', placeholder: '356938035643809\n356938035643817' });
      const qty = input({ type: 'number', min: 1, value: 1 });
      const cost = input({ type: 'number', min: 0, step: 'any', value: toMajor(p.cost) });
      const supplier = select('supplier_id', [['', t('none')]], '');
      api('GET', A('suppliers')).then(({ suppliers }) => suppliers.forEach((s) => supplier.append(h('option', { value: s.id }, s.name)))).catch(() => {});
      const note = input({ placeholder: t('note') });
      const btn = h('button', { class: 'btn primary', onclick: () => busy(btn, async () => {
        const r = await api('POST', A(`products/${id}/receive`), { imeis: p.track_imei ? imeis.value : undefined, qty: qty.value, cost: cost.value, supplier_id: supplier.value, note: note.value });
        toast(`${t('receiveDone')} ${r.added} ${t('units2')}`);
        if (r.warnings?.length) toast(`${t('imeiWarn')} ${r.warnings.join(', ')}`, 'warn');
        m.close(); refresh();
      }) }, t('receive'));
      const m = modal(`${t('receive')} — ${p.title}`, [
        p.track_imei ? [field(t('imeis'), imeis), h('button', { class: 'btn ghost sm', onclick: async () => { const c = await MS.scan(); if (c) imeis.value = (imeis.value.trim() + '\n' + c).trim(); } }, icon('scan'), t('scan'))] : field(t('qty'), qty),
        field(t('cost'), cost), field(t('supplier'), supplier), note, h('div', { class: 'row end' }, btn)]);
    };
    const adjustForm = () => {
      const delta = input({ type: 'number', placeholder: '-1' }), note = input({ placeholder: t('note') });
      const btn = h('button', { class: 'btn primary', onclick: () => busy(btn, async () => { await api('POST', A(`products/${id}/adjust`), { delta: delta.value, note: note.value }); m.close(); refresh(); }) }, t('save'));
      const m = modal(t('adjust'), [field(t('delta'), delta), note, h('div', { class: 'row end' }, btn)]);
    };
    const editUnit = (u) => {
      const imei = input({ value: u.imei, dir: 'ltr' }), imei2 = input({ value: u.imei2, dir: 'ltr' }), note = input({ value: u.note }), cost = input({ type: 'number', value: toMajor(u.cost) });
      const status = select('status', ['in_stock', 'defective', 'reserved'].map((k) => [k, t(k === 'in_stock' ? 'inStock' : k)]), u.status);
      const btn = h('button', { class: 'btn primary', onclick: () => busy(btn, async () => {
        await api('PUT', A(`units/${u.id}`), { imei: imei.value, imei2: imei2.value, note: note.value, cost: cost.value, status: u.status === 'sold' ? undefined : status.value }); m.close(); refresh();
      }) }, t('save'));
      const del = u.status !== 'sold' ? h('button', { class: 'btn danger ghost', onclick: async () => { if (await confirmBox(u.imei, t('delete'))) { await api('DELETE', A(`units/${u.id}`)).catch(showErr); m.close(); refresh(); } } }, t('delete')) : null;
      const m = modal('IMEI', [field('IMEI 1', imei), field('IMEI 2', imei2), can('manager') ? field(t('cost'), cost) : null, u.status !== 'sold' ? field(t('status'), status) : null, field(t('note'), note), h('div', { class: 'row end' }, del, btn)]);
    };
    const statusTone = { in_stock: 'green', sold: '', defective: 'red', reserved: 'amber' };
    return page(p.title, [
      h('a', { class: 'btn primary', href: `#/pos?add=${id}` }, t('sellIt')),
      can('manager') ? h('button', { class: 'btn', onclick: receiveForm }, '+ ', t('receive')) : null,
      can('manager') && !p.track_imei ? h('button', { class: 'btn ghost', onclick: adjustForm }, t('adjust')) : null,
      can('manager') ? h('a', { class: 'btn ghost', href: `#/products/${id}/edit` }, t('edit')) : null],
    h('div', { class: 'grid2' },
      h('div', { class: 'card prod-card' }, p.images.length ? h('div', { class: 'prod-imgs' }, p.images.map((im) => h('img', { src: MS.imgUrl(sid(), im.t || im.f), alt: '', width: 120, height: 120, loading: 'lazy' }))) : null,
        h('dl', { class: 'dl' }, [[t('price'), m$(p.price)], can('manager') ? [t('cost'), m$(p.cost)] : null, [t('onHand'), stockBadge(p)], [t('brand'), p.brand], [t('model'), p.model],
          [t('storage'), p.storage], [t('ram'), p.ram], [t('color'), p.color], [t('condition'), t(p.condition)], [t('battery'), p.battery != null ? `${p.battery}%` : ''], [t('sku'), p.sku],
          [t('published'), p.published ? t('yes') : t('no')]].filter((x) => x && x[1] !== '' && x[1] != null).map(([k, v]) => [h('dt', null, k), h('dd', null, v)])),
        h('a', { class: 'muted sm', href: `${S.store.url}p/${p.id}`, target: '_blank', rel: 'noopener' }, t('myStore'), ' ↗')),
      p.track_imei ? h('div', { class: 'card flush' }, h('h2', { class: 'pad-h' }, t('units'), ' ', h('small', { class: 'muted' }, `${p.stock} ${t('inStock')}`)), table([
        { label: 'IMEI', render: (u) => h('span', { class: 'mono', dir: 'ltr' }, u.imei, u.imei2 ? ` / ${u.imei2}` : '') },
        { label: t('status'), render: (u) => badge(t(u.status === 'in_stock' ? 'inStock' : u.status), statusTone[u.status]) },
        can('manager') ? { label: t('cost'), num: true, render: (u) => m$(u.cost) } : null,
        { label: t('supplier'), render: (u) => u.supplier || '—' },
        { label: t('date'), render: (u) => date(u.created_at) },
      ].filter(Boolean), unitRows, can('manager') ? editUnit : (u) => (u.sale_id ? go(`#/sales/${u.sale_id}`) : null))) : null),
    h('div', { class: 'card flush' }, h('h2', { class: 'pad-h' }, t('history')), table([
      { label: t('date'), render: (m) => dateTime(m.created_at) },
      { label: t('kind'), render: (m) => badge(t({ in: 'in', sale: 'sale', return: 'return', adjust: 'adjust', out: 'remove', status: 'statusMove' }[m.type] || m.type)) },
      { label: t('qty'), num: true, render: (m) => (m.qty > 0 ? `+${m.qty}` : String(m.qty)) },
      { label: 'IMEI', render: (m) => (m.imei ? h('span', { class: 'mono', dir: 'ltr' }, m.imei) : '') },
      { label: t('note'), render: (m) => m.note || '' },
    ], moves, (m) => (m.sale_id ? go(`#/sales/${m.sale_id}`) : null))),
    can('manager') ? h('div', { class: 'row' },
      h('button', { class: 'btn ghost', onclick: async () => { await api('POST', A(`products/${id}/archive`), { archived: !p.archived }); toast(t('saved')); refresh(); } }, p.archived ? t('restore') : t('archive')),
      can('owner') ? h('button', { class: 'btn danger ghost', onclick: async () => { if (await confirmBox(p.title, t('delete'))) { try { await api('DELETE', A(`products/${id}`)); go('#/products'); } catch (e) { showErr(e); } } } }, t('delete')) : null) : null);
  }

  // ---------- sales ----------
  function rangePicker(onChange, initial = 'today') {
    const r = (k) => {
      const now = new Date(), d0 = new Date(); d0.setHours(0, 0, 0, 0);
      if (k === 'today') return [d0.getTime(), 0];
      if (k === 'last7') return [d0.getTime() - 6 * 864e5, 0];
      if (k === 'last30') return [d0.getTime() - 29 * 864e5, 0];
      if (k === 'month') return [new Date(now.getFullYear(), now.getMonth(), 1).getTime(), 0];
      return [0, 0];
    };
    const box = h('div', { class: 'seg' });
    const keys = ['today', 'last7', 'last30', 'all'];
    const draw = (cur) => fill(box, ...keys.map((k) => h('button', { class: k === cur ? 'on' : '', onclick: () => { draw(k); onChange(...r(k)); } }, t(k))));
    draw(initial);
    return { el: box, range: r(initial) };
  }
  async function viewSales() {
    const listBox = h('div', { class: 'card flush' });
    let from = 0, to = 0, q = '';
    const load = async () => {
      const { sales } = await api('GET', A(`sales?${new URLSearchParams({ from, to, q })}`));
      const done = sales.filter((x) => x.status === 'done');
      fill(listBox, h('div', { class: 'sum-bar' }, h('span', null, `${done.length} ${t('sales')}`), h('b', null, m$(done.reduce((a, x) => a + x.total, 0))),
        can('manager') ? h('span', { class: 'green' }, `${t('profit')}: ${m$(done.reduce((a, x) => a + x.total - x.cost, 0))}`) : null),
      table([
        { label: t('number'), render: (x) => `#${x.number}` }, { label: t('date'), render: (x) => dateTime(x.created_at) },
        { label: t('items'), render: (x) => h('span', { class: 'clip' }, x.items || '') }, { label: t('customer'), render: (x) => x.customer_name || '—' },
        { label: t('method'), render: (x) => t(x.method) }, { label: t('total'), num: true, render: (x) => h('b', { class: x.status === 'refunded' ? 'strike' : '' }, m$(x.total)) },
        { label: t('status'), render: (x) => (x.status === 'refunded' ? badge(t('refunded'), 'red') : x.paid < x.total ? badge(t('credit'), 'amber') : badge(t('done'), 'green')) },
      ], sales, (x) => go(`#/sales/${x.id}`)));
    };
    const rp = rangePicker((f, tt) => { from = f; to = tt; load(); });
    [from, to] = rp.range;
    const search = input({ type: 'search', placeholder: `${t('search')} IMEI, ${t('customer')}, #` });
    search.addEventListener('keydown', (e) => { if (e.key === 'Enter') { q = search.value.trim(); load(); } });
    await load();
    return page(t('sales'), [h('a', { class: 'btn primary', href: '#/pos' }, '+ ', t('newSale'))], h('div', { class: 'filters' }, rp.el, search), listBox);
  }
  async function viewSale(id) {
    const { node, sale } = await receiptNode(id);
    return page(`${t('receipt')} #${sale.number}`, [
      h('button', { class: 'btn primary', onclick: () => printNode(node) }, t('print')),
      sale.status === 'done' && can('manager') ? h('button', { class: 'btn danger ghost', onclick: async () => {
        const reason = input({ placeholder: t('note') });
        const btn = h('button', { class: 'btn danger', onclick: () => busy(btn, async () => { await api('POST', A(`sales/${id}/refund`), { reason: reason.value }); m.close(); toast(t('refunded')); route(); }) }, t('refund'));
        const m = modal(t('refund'), [h('p', null, t('areYouSure')), reason, h('div', { class: 'row end' }, btn)]);
      } }, t('refund')) : null,
      h('a', { class: 'btn ghost', href: '#/sales' }, t('back'))],
    h('div', { class: 'card receipt-wrap' }, node),
    h('p', { class: 'muted sm' }, `${t('seller')}: ${sale.seller || '—'}`, can('manager') ? ` · ${t('profit')}: ${m$(sale.total - sale.cost)}` : ''));
  }

  // ---------- customers ----------
  async function viewCustomers() {
    const q = qs().get('q') || '';
    const { customers } = await api('GET', A(`customers?q=${encodeURIComponent(q)}`));
    const search = input({ type: 'search', placeholder: t('search'), value: q });
    search.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(`#/customers?q=${encodeURIComponent(search.value.trim())}`); });
    return page(t('customers'), [h('button', { class: 'btn primary', onclick: () => customerForm() }, '+ ', t('addCustomer'))],
      h('div', { class: 'filters' }, search),
      h('div', { class: 'card flush' }, table([
        { label: t('name'), render: (c) => h('b', null, c.name) }, { label: t('phoneNum'), render: (c) => h('span', { dir: 'ltr' }, c.phone) },
        { label: t('sales'), num: true, render: (c) => String(c.sales) }, { label: t('spent'), num: true, render: (c) => m$(c.spent) },
        { label: t('debt'), num: true, render: (c) => (c.debt > 0 ? badge(m$(c.debt), 'red') : '—') },
      ], customers, (c) => go(`#/customers/${c.id}`))));
  }
  function customerForm(c) {
    const f = h('form', { class: 'form', onsubmit: (e) => { e.preventDefault(); busy(f.querySelector('button'), async () => {
      const d = formData(f); if (c) await api('PUT', A(`customers/${c.id}`), d); else await api('POST', A('customers'), d); m.close(); toast(t('saved')); route();
    }); } }, field(t('name'), input({ name: 'name', value: c?.name || '', required: true })), field(t('phoneNum'), input({ name: 'phone', value: c?.phone || '', dir: 'ltr', inputmode: 'tel' })),
    field(t('note'), input({ name: 'note', value: c?.note || '' })), h('div', { class: 'row end' }, h('button', { class: 'btn primary' }, t('save'))));
    const m = modal(c ? t('edit') : t('addCustomer'), f);
  }
  async function viewCustomer(id) {
    const { customer: c, sales, payments, debt } = await api('GET', A(`customers/${id}`));
    const pay = () => {
      const amount = input({ type: 'number', min: 0, step: 'any', value: debt > 0 ? debt / 100 : '' }), note = input({ placeholder: t('note') });
      const btn = h('button', { class: 'btn primary', onclick: () => busy(btn, async () => { await api('POST', A(`customers/${id}/payments`), { amount: amount.value, note: note.value }); m.close(); toast(t('saved')); route(); }) }, t('save'));
      const m = modal(t('payment'), [field(t('amount'), amount), note, h('div', { class: 'row end' }, btn)]);
    };
    const wa = c.phone ? `https://wa.me/${c.phone.replace(/\D/g, '').replace(/^0/, '213')}` : null;
    return page(c.name, [debt > 0 ? h('button', { class: 'btn primary', onclick: pay }, t('payment')) : null, h('button', { class: 'btn ghost', onclick: () => customerForm(c) }, t('edit')),
      c.phone ? h('a', { class: 'btn ghost', href: `tel:${c.phone}` }, t('call')) : null, wa ? h('a', { class: 'btn ghost', href: wa, target: '_blank', rel: 'noopener' }, 'WhatsApp') : null],
    h('div', { class: 'kpis' }, kpi(t('debt'), m$(debt), null, debt > 0 ? 'red' : 'green'), kpi(t('sales'), String(sales.length)), kpi(t('phoneNum'), c.phone || '—')),
    h('div', { class: 'card flush' }, h('h2', { class: 'pad-h' }, t('sales')), table([
      { label: t('number'), render: (x) => `#${x.number}` }, { label: t('date'), render: (x) => date(x.created_at) }, { label: t('items'), render: (x) => h('span', { class: 'clip' }, x.items) },
      { label: t('total'), num: true, render: (x) => m$(x.total) }, { label: t('paid'), num: true, render: (x) => m$(x.paid) },
    ], sales, (x) => go(`#/sales/${x.id}`))),
    payments.length ? h('div', { class: 'card flush' }, h('h2', { class: 'pad-h' }, t('payments')), table([
      { label: t('date'), render: (p) => dateTime(p.created_at) }, { label: t('amount'), num: true, render: (p) => m$(p.amount) }, { label: t('note'), render: (p) => p.note },
    ], payments)) : null);
  }

  // ---------- orders ----------
  async function viewOrders() {
    const st = qs().get('status') || 'new';
    const { orders } = await api('GET', A(`orders?status=${st === 'all' ? '' : st}`));
    const set = async (o, status) => { await api('PUT', A(`orders/${o.id}`), { status }).catch(showErr); route(); };
    const tone = { new: 'amber', confirmed: 'blue', done: 'green', cancelled: 'red' };
    return page(t('orders'), [],
      h('div', { class: 'seg' }, ['new', 'confirmed', 'done', 'cancelled', 'all'].map((k) => h('a', { href: `#/orders?status=${k}`, class: k === st ? 'on' : '' }, t(k === 'new' ? 'newS' : k)))),
      orders.length ? h('div', { class: 'cards' }, orders.map((o) => h('div', { class: 'card order-card' },
        h('div', { class: 'row between' }, h('b', null, o.product_title), badge(t(o.status === 'new' ? 'newS' : o.status), tone[o.status])),
        h('p', null, o.name, ' · ', h('a', { href: `tel:${o.phone}`, dir: 'ltr' }, o.phone), o.city ? ` · ${o.city}` : ''),
        o.note ? h('p', { class: 'muted' }, o.note) : null,
        h('p', { class: 'muted sm' }, dateTime(o.created_at), ' · ', m$(o.price)),
        h('div', { class: 'row' },
          h('a', { class: 'btn sm ghost', href: `https://wa.me/${o.phone.replace(/\D/g, '').replace(/^0/, '213')}`, target: '_blank', rel: 'noopener' }, 'WhatsApp'),
          o.status === 'new' ? h('button', { class: 'btn sm', onclick: () => set(o, 'confirmed') }, t('confirm')) : null,
          ['new', 'confirmed'].includes(o.status) && o.product_id ? h('a', { class: 'btn sm primary', href: `#/pos?order=${o.id}&add=${o.product_id}` }, t('sellIt')) : null,
          ['new', 'confirmed'].includes(o.status) ? h('button', { class: 'btn sm danger ghost', onclick: () => set(o, 'cancelled') }, t('cancel')) : null)))) : h('div', { class: 'card' }, empty()));
  }

  // ---------- stock moves / suppliers / expenses ----------
  async function viewMoves() {
    const { moves } = await api('GET', A('moves'));
    return page(t('stock'), [h('a', { class: 'btn ghost', href: A('export/units.csv') }, t('export'))], h('div', { class: 'card flush' }, table([
      { label: t('date'), render: (m) => dateTime(m.created_at) }, { label: t('title'), render: (m) => m.title },
      { label: t('kind'), render: (m) => badge(t({ in: 'in', sale: 'sale', return: 'return', adjust: 'adjust', out: 'remove', status: 'statusMove' }[m.type] || m.type), m.type === 'in' ? 'green' : m.type === 'sale' ? 'blue' : '') },
      { label: t('qty'), num: true, render: (m) => (m.qty > 0 ? `+${m.qty}` : String(m.qty)) }, { label: 'IMEI', render: (m) => (m.imei ? h('span', { class: 'mono', dir: 'ltr' }, m.imei) : '') },
      { label: t('cost'), num: true, render: (m) => (m.cost !== undefined ? m$(m.cost) : '') }, { label: t('supplier'), render: (m) => m.supplier || '' },
    ], moves, (m) => go(`#/products/${m.product_id}`))));
  }
  async function viewSuppliers() {
    const { suppliers } = await api('GET', A('suppliers'));
    const form = (s) => {
      const f = h('form', { class: 'form', onsubmit: (e) => { e.preventDefault(); busy(f.querySelector('.primary'), async () => {
        const d = formData(f); if (s) await api('PUT', A(`suppliers/${s.id}`), d); else await api('POST', A('suppliers'), d); m.close(); route();
      }); } }, field(t('name'), input({ name: 'name', value: s?.name || '', required: true })), field(t('phoneNum'), input({ name: 'phone', value: s?.phone || '', dir: 'ltr' })),
      field(t('note'), input({ name: 'note', value: s?.note || '' })),
      h('div', { class: 'row end' }, s ? h('button', { type: 'button', class: 'btn danger ghost', onclick: async () => { if (await confirmBox(s.name, t('delete'))) { await api('DELETE', A(`suppliers/${s.id}`)); m.close(); route(); } } }, t('delete')) : null, h('button', { class: 'btn primary' }, t('save'))));
      const m = modal(s ? s.name : t('addSupplier'), f);
    };
    return page(t('suppliers'), [h('button', { class: 'btn primary', onclick: () => form() }, '+ ', t('addSupplier'))], h('div', { class: 'card flush' }, table([
      { label: t('name'), render: (s) => h('b', null, s.name) }, { label: t('phoneNum'), render: (s) => h('span', { dir: 'ltr' }, s.phone) },
      { label: t('units'), num: true, render: (s) => String(s.units) }, { label: t('bought'), num: true, render: (s) => m$(s.bought) }, { label: t('note'), render: (s) => s.note },
    ], suppliers, form)));
  }
  async function viewExpenses() {
    const { expenses } = await api('GET', A('expenses'));
    const label = input({ name: 'label', placeholder: t('label'), required: true }), amount = input({ name: 'amount', type: 'number', min: 0, step: 'any', placeholder: t('amount'), required: true });
    const f = h('form', { class: 'row card', onsubmit: (e) => { e.preventDefault(); busy(f.querySelector('button'), async () => { await api('POST', A('expenses'), { label: label.value, amount: amount.value }); route(); }); } },
      label, amount, h('button', { class: 'btn primary' }, t('add')));
    return page(t('expenses'), [], f, h('div', { class: 'card flush' }, table([
      { label: t('date'), render: (e) => dateTime(e.created_at) }, { label: t('label'), render: (e) => e.label }, { label: t('amount'), num: true, render: (e) => m$(e.amount) },
      { label: '', render: (e) => (can('owner') ? h('button', { class: 'icon-btn', 'aria-label': t('delete'), onclick: async (ev) => { ev.stopPropagation(); if (await confirmBox(e.label, t('delete'))) { await api('DELETE', A(`expenses/${e.id}`)); route(); } } }, '✕') : '') },
    ], expenses)));
  }

  // ---------- reports ----------
  async function viewReports() {
    const box = h('div');
    const fromIn = input({ type: 'date' }), toIn = input({ type: 'date' });
    const load = async (from, to) => {
      const r = await api('GET', A(`reports?${new URLSearchParams({ from, to: to || Date.now(), tzo })}`));
      const f = new Date(r.from); f.setHours(0, 0, 0, 0);
      const pts = r.to - r.from <= 92 * 864e5 ? MS.fillDays(r.days, f, new Date(r.to)) : r.days;
      const mini = (title, rows, cols) => h('div', { class: 'card flush' }, h('h2', { class: 'pad-h' }, title), table(cols, rows));
      fill(box, 
        h('div', { class: 'kpis' }, kpi(t('sales'), m$(r.totals.total), `${r.totals.n} ${t('sales')}`, 'blue'), kpi(t('profit'), m$(r.totals.profit), null, 'green'),
          kpi(t('expenses'), m$(r.totals.expenses)), kpi(t('net'), m$(r.totals.net), null, r.totals.net >= 0 ? 'green' : 'red'),
          kpi(t('discount'), m$(r.totals.discount)), kpi(t('refunded'), m$(r.refunds.total), `${r.refunds.n}`), kpi(t('rest'), m$(r.totals.unpaid), null, 'amber')),
        h('div', { class: 'card' }, h('h2', null, t('sales')), MS.barChart(pts, { label: (p) => `${m$(p.total)} · ${t('profit')} ${m$(p.profit)}` })),
        h('div', { class: 'grid2' },
          mini(t('topProducts'), r.products, [{ label: t('title'), render: (p) => p.title }, { label: t('qty'), num: true, render: (p) => String(p.qty) }, { label: t('total'), num: true, render: (p) => m$(p.total) }, { label: t('profit'), num: true, render: (p) => m$(p.profit) }]),
          h('div', null,
            mini(t('byMethod'), r.methods, [{ label: t('method'), render: (x) => t(x.method) }, { label: t('salesCount'), num: true, render: (x) => String(x.n) }, { label: t('total'), num: true, render: (x) => m$(x.total) }]),
            mini(t('bySeller'), r.sellers, [{ label: t('seller'), render: (x) => x.name }, { label: t('salesCount'), num: true, render: (x) => String(x.n) }, { label: t('total'), num: true, render: (x) => m$(x.total) }, { label: t('profit'), num: true, render: (x) => m$(x.profit) }]),
            mini(t('byBrand'), r.brands, [{ label: t('brand'), render: (x) => x.brand }, { label: t('qty'), num: true, render: (x) => String(x.qty) }, { label: t('total'), num: true, render: (x) => m$(x.total) }]))));
    };
    const rp = rangePicker((f, tt) => load(f || 1, tt), 'last30');
    const custom = h('button', { class: 'btn ghost', onclick: () => {
      if (!fromIn.value) return;
      const f = new Date(fromIn.value + 'T00:00').getTime(), tt = toIn.value ? new Date(toIn.value + 'T00:00').getTime() + 864e5 : Date.now();
      load(f, tt);
    } }, t('confirm'));
    await load(rp.range[0], 0);
    return page(t('reports'), [h('a', { class: 'btn ghost', href: A('export/sales.csv') }, t('export'), ' · ', t('sales')), h('a', { class: 'btn ghost', href: A('export/products.csv') }, t('export'), ' · ', t('products'))],
      h('div', { class: 'filters' }, rp.el, h('span', { class: 'row' }, t('from'), fromIn, t('to'), toIn, custom)), box);
  }

  // ---------- team ----------
  async function viewStaff() {
    const { staff, limit } = await api('GET', A('staff'));
    const email = input({ type: 'email', placeholder: 'name@gmail.com', required: true, dir: 'ltr' });
    const role = select('role', [['seller', t('seller')], ['manager', t('manager')]], 'seller');
    const f = can('owner') ? h('form', { class: 'card', onsubmit: (e) => { e.preventDefault(); busy(f.querySelector('button'), async () => { await api('POST', A('staff'), { email: email.value, role: role.value }); toast(t('saved')); route(); }); } },
      h('h2', null, t('invite')), h('div', { class: 'row' }, email, role, h('button', { class: 'btn primary' }, t('add'))), h('p', { class: 'muted sm' }, `${staff.length} / ${limit}`)) : null;
    return page(t('staff'), [], f, h('div', { class: 'card flush' }, table([
      { label: t('name'), render: (m) => h('div', { class: 'row' }, m.picture ? h('img', { class: 'av-sm', src: m.picture, alt: '', width: 28, height: 28, referrerpolicy: 'no-referrer' }) : null, h('div', null, h('b', null, m.name || m.email.split('@')[0]), h('div', { class: 'muted sm', dir: 'ltr' }, m.email))) },
      { label: t('role'), render: (m) => (can('owner') && m.role !== 'owner' ? select('r', [['seller', t('seller')], ['manager', t('manager')]], m.role, { class: 'in sm', onchange: async (e) => { await api('PUT', A('staff'), { email: m.email, role: e.target.value }).catch(showErr); toast(t('saved')); } }) : badge(t(m.role), m.role === 'owner' ? 'blue' : '')) },
      { label: t('lastLogin'), render: (m) => (m.joined ? dateTime(m.last_login) : badge(t('pending'), 'amber')) },
      { label: '', render: (m) => (can('owner') && m.role !== 'owner' ? h('button', { class: 'icon-btn', 'aria-label': t('remove'), onclick: async () => { if (await confirmBox(m.email, t('remove'))) { await api('DELETE', A(`staff?email=${encodeURIComponent(m.email)}`)).catch(showErr); route(); } } }, '✕') : '') },
    ], staff)));
  }

  // ---------- settings ----------
  async function viewSettings() {
    await loadSettings();
    const { store: s, limits, storage_used, themes } = S.settings;
    let logo = s.logo, cover = s.cover;
    const imgPick = (key, getter, setter, opts) => {
      const preview = h('div', { class: `img-one ${key}` });
      const draw = () => fill(preview, getter() ? h('img', { src: MS.imgUrl(sid(), getter()), alt: '' }) : h('span', { class: 'muted' }, '—'),
        h('label', { class: 'btn sm ghost' }, t('edit'), h('input', { type: 'file', accept: 'image/*', hidden: true, onchange: async (e) => {
          try { toast(t('uploading')); const r = await MS.uploadImage(sid(), e.target.files[0], opts); setter(r.f); draw(); } catch (err) { showErr(err); }
        } })), getter() ? h('button', { type: 'button', class: 'btn sm ghost', onclick: () => { setter(''); draw(); } }, t('remove')) : null);
      draw();
      return preview;
    };
    const slug = input({ name: 'slug', value: s.slug, dir: 'ltr', pattern: '[a-z0-9-]{3,30}' });
    const slugMsg = h('small');
    slug.addEventListener('input', async () => {
      if (slug.value === s.slug) { slugMsg.textContent = ''; return; }
      const r = await api('GET', `/api/slug-check?slug=${encodeURIComponent(slug.value)}`);
      slugMsg.textContent = `${r.slug}.${location.host} — ${r.ok ? t('slugFree') : t('slugTaken')}`; slugMsg.className = r.ok ? 'green' : 'red';
    });
    const themeBox = h('div', { class: 'theme-pick' }, themes.map((k) => h('label', { class: `tprev t-${k}` },
      h('input', { type: 'radio', name: 'theme', value: k, checked: s.theme === k }), h('div', null, h('i'), h('i'), h('i'), h('i')), h('span', null, k[0].toUpperCase() + k.slice(1)))));
    const chk = (name, label) => h('label', { class: 'chk' }, h('input', { type: 'checkbox', name, checked: !!s[name] }), label);
    const f = h('form', { class: 'form', onsubmit: (e) => { e.preventDefault(); busy(f.querySelector('.primary'), async () => {
      const d = formData(f); d.logo = logo; d.cover = cover; d.low_stock = Number(d.low_stock);
      const r = await api('PUT', A('settings'), d);
      toast(t('saved'));
      S.store.url = r.url;
      await loadSettings();
    }); } },
    h('div', { class: 'card' }, h('h2', null, t('storeInfo')), h('div', { class: 'fgrid' },
      field(t('storeName'), input({ name: 'name', value: s.name, required: true })),
      field(t('subdomain'), slug, slugMsg),
      field(t('tagline'), input({ name: 'tagline', value: s.tagline })),
      field(t('phoneNum'), input({ name: 'phone', value: s.phone, dir: 'ltr', inputmode: 'tel' })),
      field(t('whatsapp'), input({ name: 'whatsapp', value: s.whatsapp, dir: 'ltr', placeholder: '213555123456' })),
      field(t('email'), input({ name: 'email', value: s.email, dir: 'ltr', type: 'email' })),
      field(t('address'), input({ name: 'address', value: s.address })), field(t('city'), input({ name: 'city', value: s.city }))),
    field(t('about'), h('textarea', { class: 'in', name: 'about', rows: 3 }, s.about))),
    h('div', { class: 'card' }, h('h2', null, t('theme')), themeBox, h('div', { class: 'fgrid' },
      field(t('accent'), h('input', { class: 'in color', type: 'color', name: 'accent', value: s.accent || '#2563eb' })),
      field(t('logo'), imgPick('logo', () => logo, (v) => { logo = v; }, { full: 512, thumb: 0 })),
      field(t('cover'), imgPick('cover', () => cover, (v) => { cover = v; }, { full: 1600, thumb: 0 })))),
    h('div', { class: 'card' }, h('h2', null, t('social')), h('div', { class: 'fgrid' },
      field('Facebook', input({ name: 'facebook', value: s.facebook, dir: 'ltr', placeholder: 'https://facebook.com/…' })),
      field('Instagram', input({ name: 'instagram', value: s.instagram, dir: 'ltr', placeholder: 'https://instagram.com/…' })),
      field('TikTok', input({ name: 'tiktok', value: s.tiktok, dir: 'ltr', placeholder: 'https://tiktok.com/@…' })))),
    h('div', { class: 'card' }, h('h2', null, t('settings')), h('div', { class: 'fgrid' },
      field(t('currency'), select('currency', ['DZD', 'EUR', 'USD', 'MAD', 'TND', 'SAR', 'AED', 'EGP'].map((c) => [c, c]), s.currency)),
      field(t('language'), select('lang', [['ar', 'العربية'], ['fr', 'Français'], ['en', 'English']], s.lang)),
      field(t('lowStockAt'), input({ name: 'low_stock', type: 'number', min: 0, value: s.low_stock })),
      field(t('receiptNote'), input({ name: 'receipt_note', value: s.receipt_note }))),
    chk('online_orders', t('onlineOrders')), chk('show_prices', t('showPrices'))),
    h('div', { class: 'row end sticky-act' }, h('button', { class: 'btn primary big' }, t('save'))));
    const qr = h('div', { class: 'store-qr' });
    api('GET', A('qr')).then((r) => { qr.innerHTML = r.svg; }).catch(() => {});
    return page(t('settings'), [h('a', { class: 'btn ghost', href: s.url, target: '_blank', rel: 'noopener' }, t('seeStore'), ' ↗')],
      h('div', { class: 'card plan' }, h('div', null, h('b', null, `${t('plan')}: ${s.effective_plan}`), s.plan_expires ? h('span', { class: 'muted' }, ` · ${t('expires')} ${date(s.plan_expires)}`) : null,
        h('div', { class: 'muted sm' }, `${t('products')} ≤ ${limits.products} · ${t('members')} ≤ ${limits.members} · ${t('storageUsed')}: ${(storage_used / 1048576).toFixed(1)} / ${limits.storageMb} MB`),
        h('div', { class: 'muted sm', dir: 'ltr' }, s.url, ' · ', s.path_url)), h('div', null, h('small', { class: 'muted' }, t('storeQr')), qr)),
      f);
  }

  async function viewAudit() {
    const { audit } = await api('GET', A('audit'));
    return page(t('audit'), [], h('div', { class: 'card flush' }, table([
      { label: t('date'), render: (a) => dateTime(a.created_at) }, { label: t('name'), render: (a) => a.name || a.email || '' },
      { label: t('action'), render: (a) => badge(a.action) }, { label: t('note'), render: (a) => h('span', { class: 'clip' }, a.detail) },
    ], audit)));
  }

  // ---------- devices + QR sign-in of a PC ----------
  async function scanPcLogin() {
    const code = await MS.scan({ title: t('scanPc'), formats: ['qr_code'] });
    if (!code) return;
    try {
      const u = new URL(code, location.origin);
      if (u.origin === location.origin && /^\/qr\/[\w-]+$/.test(u.pathname)) { location.href = u.pathname; return; }
    } catch { /* not a URL */ }
    toast(MS.errText('qr_expired'), 'err');
  }
  async function viewDevices() {
    const { sessions } = await api('GET', '/api/me/sessions');
    return page(t('devices'), [h('button', { class: 'btn primary', onclick: scanPcLogin }, icon('scan'), t('scanPc'))],
      h('div', { class: 'card' }, h('p', { class: 'muted' }, t('scanHelp'))),
      h('div', { class: 'card flush' }, h('h2', { class: 'pad-h' }, t('sessions')), table([
        { label: t('devices'), render: (s) => h('div', null, h('b', null, s.device), s.current ? badge(t('thisDevice'), 'blue') : null, h('div', { class: 'muted sm' }, `${s.via.toUpperCase()} · ${s.ip}`)) },
        { label: t('lastLogin'), render: (s) => dateTime(s.last_seen) },
        { label: '', render: (s) => (s.current ? '' : h('button', { class: 'btn sm ghost', onclick: async () => { await api('DELETE', `/api/me/sessions?id=${s.id}`); route(); } }, t('revoke'))) },
      ], sessions)));
  }

  function viewMore() {
    return page(t('more'), [], h('div', { class: 'more-grid' }, NAV.filter(([k, , role]) => !MOBILE_NAV.includes(k) && (!role || can(role))).map(([k, href]) => h('a', { class: 'qa', href }, icon(k), t(k))),
      h('a', { class: 'qa', href: S.store.url, target: '_blank', rel: 'noopener' }, icon('orders'), t('myStore')),
      S.me.user.is_super ? h('a', { class: 'qa', href: '/admin' }, icon('settings'), t('admin')) : null,
      h('button', { class: 'qa', onclick: async () => { await api('POST', '/api/logout'); location.href = '/'; } }, icon('devices'), t('logout'))));
  }

  // ---------- onboarding: create a store ----------
  function renderOnboarding(extra) {
    const slug = input({ name: 'slug', dir: 'ltr', required: true, pattern: '[a-z0-9-]{3,30}', placeholder: 'mystore' });
    const name = input({ name: 'name', required: true, placeholder: 'Phone Center' });
    const msg = h('small');
    let touched = false, timer;
    const check = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const r = await api('GET', `/api/slug-check?slug=${encodeURIComponent(slug.value || name.value)}`);
        if (!touched) slug.value = r.slug;
        msg.textContent = r.slug ? `${r.slug}.${location.host} — ${r.ok ? t('slugFree') : t('slugTaken')}` : '';
        msg.className = r.ok ? 'green' : 'red';
      }, 300);
    };
    name.addEventListener('input', () => { if (!touched) check(); });
    slug.addEventListener('input', () => { touched = true; check(); });
    const f = h('form', { class: 'form card onboard', onsubmit: (e) => { e.preventDefault(); busy(f.querySelector('.primary'), async () => {
      const r = await api('POST', '/api/stores', formData(f));
      try { localStorage.setItem('ms_store', r.id); } catch { /* ignore */ }
      location.hash = '#/settings'; location.reload();
    }); } },
    h('h1', null, t('createStore')), field(t('storeName'), name), field(t('subdomain'), slug, msg),
    h('div', { class: 'fgrid' }, field(t('phoneNum'), input({ name: 'phone', dir: 'ltr', inputmode: 'tel' })), field(t('city'), input({ name: 'city' })),
      field(t('language'), select('lang', [['ar', 'العربية'], ['fr', 'Français'], ['en', 'English']], MS.lang))),
    h('h3', null, t('theme')), h('div', { class: 'theme-pick' }, ['clean', 'night', 'souk', 'luxe'].map((k, i) => h('label', { class: `tprev t-${k}` },
      h('input', { type: 'radio', name: 'theme', value: k, checked: i === 0 }), h('div', null, h('i'), h('i'), h('i'), h('i')), h('span', null, k[0].toUpperCase() + k.slice(1))))),
    h('div', { class: 'row end' }, extra ? h('a', { class: 'btn ghost', href: '#/' }, t('cancel')) : h('button', { type: 'button', class: 'btn ghost', onclick: async () => { await api('POST', '/api/logout'); location.href = '/'; } }, t('logout')),
      h('button', { class: 'btn primary big' }, t('createBtn'))));
    if (extra && main) { return page(t('createStore'), [], f); }
    fill(root, h('main', { class: 'main solo' }, f));
    return null;
  }

  boot().catch((e) => { if (e.message !== 'auth') fill(root, h('div', { class: 'card center' }, MS.errText(e.code || 'network'))); });
})();
