// Platform admin dashboard (Super Admin only).
'use strict';
(() => {
  const { fill, h, t, api, money, date, dateTime, toast, showErr, modal, confirmBox, field, input, select, busy } = MS;
  const root = document.getElementById('root');
  let main;
  const go = (x) => { location.hash = x; };
  const badge = (txt, tone) => h('span', { class: `badge ${tone || ''}` }, txt);
  const kpi = (label, value, sub, tone) => h('div', { class: `kpi ${tone || ''}` }, h('span', null, label), h('b', null, value), sub ? h('small', null, sub) : null);
  const page = (title, actions, ...body) => h('section', { class: 'page' }, h('div', { class: 'page-head' }, h('h1', null, title), h('div', { class: 'row' }, actions)), body);
  const empty = () => h('p', { class: 'muted center pad' }, t('empty'));
  function table(cols, rows, onRow) {
    if (!rows.length) return empty();
    return h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' }, h('thead', null, h('tr', null, cols.map((c) => h('th', { class: c.num ? 'num' : '' }, c.label)))),
      h('tbody', null, rows.map((r) => h('tr', { class: onRow ? 'click' : '', onclick: onRow ? () => onRow(r) : null }, cols.map((c) => h('td', { class: c.num ? 'num' : '', 'data-l': c.label }, c.render(r))))))));
  }
  const statusBadge = (s) => badge(t(s.status), s.status === 'active' ? 'green' : 'red');
  const planBadge = (s) => badge(s.effective_plan + (s.plan !== s.effective_plan ? ` (${s.plan})` : ''), s.effective_plan === 'free' ? '' : 'blue');

  const NAV = [['overview', '#/'], ['stores', '#/stores'], ['users', '#/users'], ['audit', '#/audit'], ['settings', '#/settings']];

  function layout(me) {
    main = h('main', { class: 'main' });
    fill(root, 
      h('aside', { class: 'side' }, h('a', { class: 'logo', href: '#/' }, h('img', { src: document.querySelector('link[rel=icon]').href, alt: '', width: 30, height: 30 }), h('b', null, `${me.app} · ${t('admin')}`)),
        h('nav', null, NAV.map(([k, href]) => h('a', { class: 'nav-a', href }, h('span', null, t(k)))), h('a', { class: 'nav-a', href: '/app' }, h('span', null, '← ', t('dashboard'))))),
      h('div', { class: 'body' }, h('header', { class: 'bar' }, h('b', null, t('admin')), h('div', { class: 'bar-act' },
        select('lang', [['ar', 'العربية'], ['fr', 'Français'], ['en', 'English']], MS.lang, { class: 'in sm', onchange: (e) => { MS.setLang(e.target.value); layout(me); route(); } }),
        h('span', { class: 'muted sm' }, me.user.email))), main),
      h('nav', { class: 'tabbar' }, NAV.map(([k, href]) => h('a', { class: 'nav-a', href }, h('span', null, t(k))))));
  }

  async function route() {
    const hash = location.hash.split('?')[0] || '#/';
    document.querySelectorAll('.nav-a').forEach((a) => a.classList.toggle('on', a.getAttribute('href') === hash || (a.getAttribute('href') !== '#/' && hash.startsWith(a.getAttribute('href')))));
    fill(main, h('div', { class: 'boot' }, h('span', { class: 'spin' })));
    let m;
    try {
      let v;
      if (hash === '#/' || hash === '') v = await overview();
      else if (hash === '#/stores') v = await stores();
      else if ((m = hash.match(/^#\/stores\/(s_[\w-]+)$/))) v = await storeDetail(m[1]);
      else if (hash === '#/users') v = await users();
      else if (hash === '#/audit') v = await auditLog();
      else if (hash === '#/settings') v = await settings();
      else return go('#/');
      fill(main, v);
    } catch (e) { fill(main, h('div', { class: 'card' }, MS.errText(e.code || 'network'))); }
  }

  async function overview() {
    const d = await api('GET', '/api/admin/overview');
    const c = d.counts;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const from = new Date(today); from.setDate(from.getDate() - 29);
    const fill = (pts, key) => { const map = new Map(pts.map((p) => [new Date(p.day).toDateString(), p])); const out = [];
      for (let x = new Date(from); x <= today; x.setDate(x.getDate() + 1)) out.push(map.get(x.toDateString()) || { day: x.getTime(), [key]: 0, n: 0 }); return out; };
    return page(t('overview'), [],
      h('div', { class: 'kpis' }, kpi(t('stores'), String(c.stores), `${c.active} ${t('active')} · ${c.suspended} ${t('suspended')}`, 'blue'),
        kpi(t('users'), String(c.users)), kpi(t('signups'), String(c.new30), t('last30'), 'green'),
        kpi(t('volume'), money(c.volume30), `${c.sales30} ${t('sales')} · ${t('last30')}`), kpi(t('products'), String(c.products), `${c.units} IMEI`),
        kpi(t('orders'), String(c.orders30), t('last30')), kpi(t('storageUsed'), `${(c.storage / 1048576).toFixed(1)} MB`)),
      h('div', { class: 'grid2' },
        h('div', { class: 'card' }, h('h2', null, t('volume')), MS.barChart(fill(d.volume, 'total'), { label: (p) => `${money(p.total)} · ${p.n}` })),
        h('div', { class: 'card' }, h('h2', null, t('signups')), MS.barChart(fill(d.signups, 'n'), { value: (p) => p.n, label: (p) => String(p.n) }))),
      h('div', { class: 'grid2' },
        h('div', { class: 'card flush' }, h('h2', { class: 'pad-h' }, t('stores'), ' · ', t('last30')), table([
          { label: t('name'), render: (s) => s.name }, { label: t('salesCount'), num: true, render: (s) => String(s.n) }, { label: t('volume'), num: true, render: (s) => money(s.total) },
        ], d.top, (s) => go(`#/stores/${s.id}`))),
        h('div', { class: 'card flush' }, h('h2', { class: 'pad-h' }, t('expiring')), table([
          { label: t('name'), render: (s) => s.name }, { label: t('plan'), render: (s) => s.plan }, { label: t('expires'), render: (s) => date(s.plan_expires) },
        ], d.expiring, (s) => go(`#/stores/${s.id}`)))),
      h('div', { class: 'card' }, h('h2', null, t('plan')), h('div', { class: 'row' }, d.plans.map((p) => badge(`${p.plan}: ${p.n}`, 'blue')))));
  }

  async function stores() {
    const q = new URLSearchParams(location.hash.split('?')[1] || '').get('q') || '';
    const d = await api('GET', `/api/admin/stores?q=${encodeURIComponent(q)}`);
    const search = input({ type: 'search', placeholder: t('search'), value: q });
    search.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(`#/stores?q=${encodeURIComponent(search.value.trim())}`); });
    return page(t('stores'), [], h('div', { class: 'filters' }, search), h('div', { class: 'card flush' }, table([
      { label: t('name'), render: (s) => h('div', null, h('b', null, s.name), h('div', { class: 'muted sm', dir: 'ltr' }, s.slug)) },
      { label: t('owner'), render: (s) => h('span', { class: 'sm', dir: 'ltr' }, s.owner_email) },
      { label: t('plan'), render: planBadge }, { label: t('status'), render: statusBadge },
      { label: t('products'), num: true, render: (s) => String(s.products) }, { label: t('members'), num: true, render: (s) => String(s.members) },
      { label: `${t('volume')} · 30`, num: true, render: (s) => money(s.volume30) }, { label: t('date'), render: (s) => date(s.created_at) },
    ], d.stores, (s) => go(`#/stores/${s.id}`))));
  }

  async function storeDetail(id) {
    const [{ store: s, members, stats, log }, { plans }] = await Promise.all([api('GET', `/api/admin/stores/${id}`), api('GET', '/api/admin/stores?q=__none__')]);
    const upd = async (body) => { await api('PUT', `/api/admin/stores/${id}`, body).catch(showErr); toast('✓'); route(); };
    const plan = select('plan', plans.map((p) => [p, p]), s.plan);
    const days = input({ type: 'number', min: 0, max: 3650, value: 30 });
    const saveBtn = h('button', { class: 'btn primary', onclick: () => busy(saveBtn, () => upd({ plan: plan.value, days: Number(days.value) })) }, t('save'));
    return page(s.name, [
      h('a', { class: 'btn ghost', href: s.url, target: '_blank', rel: 'noopener' }, t('seeStore'), ' ↗'),
      h('a', { class: 'btn ghost', href: '/app', onclick: () => { try { localStorage.setItem('ms_store', s.id); } catch { /* ignore */ } } }, t('dashboard')),
      s.status === 'active' ? h('button', { class: 'btn danger', onclick: async () => { if (await confirmBox(s.name, t('suspend'))) upd({ status: 'suspended' }); } }, t('suspend'))
        : h('button', { class: 'btn primary', onclick: () => upd({ status: 'active' }) }, t('activate'))],
    h('div', { class: 'kpis' }, kpi(t('status'), t(s.status), null, s.status === 'active' ? 'green' : 'red'), kpi(t('plan'), s.effective_plan, s.plan_expires ? `${t('expires')} ${date(s.plan_expires)}` : '∞', 'blue'),
      kpi(t('products'), String(stats.products), `${stats.units} IMEI`), kpi(t('sales'), String(stats.sales), money(stats.volume)), kpi(t('customers'), String(stats.customers)),
      kpi(t('orders'), String(stats.orders)), kpi(t('storageUsed'), `${(stats.storage / 1048576).toFixed(1)} MB`)),
    h('div', { class: 'card' }, h('h2', null, t('plan')), h('div', { class: 'row' }, field(t('plan'), plan), field(t('extend'), days), saveBtn,
      h('button', { class: 'btn ghost', onclick: () => upd({ plan_expires: 0 }) }, '∞'))),
    h('div', { class: 'grid2' },
      h('div', { class: 'card flush' }, h('h2', { class: 'pad-h' }, t('members')), table([
        { label: t('email'), render: (m) => h('span', { dir: 'ltr' }, m.email) }, { label: t('role'), render: (m) => t(m.role) }, { label: t('lastLogin'), render: (m) => dateTime(m.last_login) },
      ], members)),
      h('div', { class: 'card flush' }, h('h2', { class: 'pad-h' }, t('audit')), table([
        { label: t('date'), render: (a) => dateTime(a.created_at) }, { label: t('action'), render: (a) => a.action }, { label: t('note'), render: (a) => h('span', { class: 'clip' }, a.detail) },
      ], log))),
    h('div', { class: 'card muted sm' }, h('p', { dir: 'ltr' }, `${s.phone} · ${s.city} · ${s.email}`), h('p', null, `${t('date')}: ${date(s.created_at)} · ${t('theme')}: ${s.theme}`)));
  }

  async function users() {
    const q = new URLSearchParams(location.hash.split('?')[1] || '').get('q') || '';
    const { users: list } = await api('GET', `/api/admin/users?q=${encodeURIComponent(q)}`);
    const search = input({ type: 'search', placeholder: t('search'), value: q });
    search.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(`#/users?q=${encodeURIComponent(search.value.trim())}`); });
    return page(t('users'), [], h('div', { class: 'filters' }, search), h('div', { class: 'card flush' }, table([
      { label: t('name'), render: (u) => h('div', { class: 'row' }, u.picture ? h('img', { class: 'av-sm', src: u.picture, alt: '', width: 28, height: 28, referrerpolicy: 'no-referrer' }) : null,
        h('div', null, h('b', null, u.name), h('div', { class: 'muted sm', dir: 'ltr' }, u.email))) },
      { label: t('stores'), render: (u) => h('span', { class: 'clip sm' }, u.stores || '—') },
      { label: t('lastLogin'), render: (u) => dateTime(u.last_login) },
      { label: t('status'), render: (u) => (u.is_super ? badge('super', 'blue') : u.disabled ? badge(t('suspended'), 'red') : badge(t('active'), 'green')) },
      { label: '', render: (u) => (u.is_super ? '' : h('button', { class: `btn sm ${u.disabled ? 'primary' : 'danger ghost'}`, onclick: async () => {
        if (!u.disabled && !(await confirmBox(u.email, t('disable')))) return;
        await api('PUT', `/api/admin/users/${u.id}`, { disabled: !u.disabled }).catch(showErr); route();
      } }, u.disabled ? t('enable') : t('disable'))) },
    ], list)));
  }

  async function auditLog() {
    const { audit } = await api('GET', '/api/admin/audit');
    return page(t('audit'), [], h('div', { class: 'card flush' }, table([
      { label: t('date'), render: (a) => dateTime(a.created_at) }, { label: t('email'), render: (a) => h('span', { dir: 'ltr', class: 'sm' }, a.email || '') },
      { label: t('stores'), render: (a) => a.store || '' }, { label: t('action'), render: (a) => badge(a.action) },
      { label: t('note'), render: (a) => h('span', { class: 'clip' }, a.detail) }, { label: 'IP', render: (a) => h('span', { class: 'sm', dir: 'ltr' }, a.ip) },
    ], audit)));
  }

  async function settings() {
    const s = await api('GET', '/api/admin/settings');
    const open = h('input', { type: 'checkbox', checked: s.signups_open });
    const ann = h('textarea', { class: 'in', rows: 2 }, s.announcement);
    const pricing = h('textarea', { class: 'in', rows: 5 }, s.pricing);
    const btn = h('button', { class: 'btn primary', onclick: () => busy(btn, async () => { await api('PUT', '/api/admin/settings', { signups_open: open.checked, announcement: ann.value, pricing: pricing.value }); toast(t('saved')); }) }, t('save'));
    return page(t('settings'), [], h('div', { class: 'card form' },
      h('label', { class: 'chk' }, open, t('signupsOpen')), field(t('announcement'), ann), field(t('pricingText'), pricing), h('div', { class: 'row end' }, btn)),
    h('div', { class: 'card flush' }, h('h2', { class: 'pad-h' }, t('plan')), table([
      { label: t('plan'), render: (r) => h('b', null, r[0]) }, { label: t('products'), num: true, render: (r) => String(r[1].products) },
      { label: t('members'), num: true, render: (r) => String(r[1].members) }, { label: 'MB', num: true, render: (r) => String(r[1].storageMb) },
    ], Object.entries(s.plans))));
  }

  (async () => {
    const me = await api('GET', '/api/me');
    if (!me.user?.is_super) { location.href = '/app'; return; }
    layout(me);
    window.addEventListener('hashchange', route);
    route();
  })().catch(() => { root.textContent = MS.errText('network'); });
})();
