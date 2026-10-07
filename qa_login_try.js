const results = [];
async function hit(name, url, opts={}) {
  try {
    const res = await fetch(url, {
      ...opts,
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 QA', ...(opts.headers||{}) },
    });
    const text = await res.text();
    let body;
    try { body = JSON.parse(text); } catch { body = { raw: text.slice(0,200) }; }
    const safe = JSON.parse(JSON.stringify(body, (k,v) => {
      if (/token|password|secret|key|authorization/i.test(k) && typeof v === 'string') return '[REDACTED len='+v.length+']';
      return v;
    }));
    results.push({ name, status: res.status, body: safe });
  } catch (e) {
    results.push({ name, error: e.message });
  }
}
(async () => {
  await hit('connect_ACC-404', 'http://127.0.0.1:3000/api/auth/connect', { method:'POST', body: JSON.stringify({ code:'ACC-404', name:'QA' }) });
  await hit('connect_SS-2283', 'http://127.0.0.1:3000/api/auth/connect', { method:'POST', body: JSON.stringify({ code:'SS-2283', name:'QA' }) });
  await hit('admin_auth_ACC404_as_user', 'http://127.0.0.1:3000/api/admin/auth', { method:'POST', body: JSON.stringify({ username:'ACC-404', password:'ACC-404' }) });
  await hit('admin_auth_accountant_email', 'http://127.0.0.1:3000/api/admin/auth', { method:'POST', body: JSON.stringify({ username:'accountant@southstreet.dz', password:'ACC-404' }) });
  await hit('portal_page', 'http://127.0.0.1:3000/portal', { method:'GET' });
  await hit('root', 'http://127.0.0.1:3000/', { method:'GET' });
  console.log(JSON.stringify(results, null, 2));
})();
