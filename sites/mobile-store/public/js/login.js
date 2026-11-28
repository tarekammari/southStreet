// PC sign-in by QR: show a code, poll until the signed-in phone approves it.
(() => {
  const box = document.getElementById('qr');
  if (!box) return;
  const T = JSON.parse(box.dataset.t);
  const img = document.getElementById('qr-img'), code = document.getElementById('qr-code'), status = document.getElementById('qr-status');
  let timer = null, cur = null, ends = 0;

  async function start() {
    clearTimeout(timer);
    status.textContent = '';
    img.innerHTML = '<span class="spin"></span>';
    try {
      const r = await fetch('/api/qr/start', { method: 'POST', headers: { 'x-ms': '1' } });
      if (!r.ok) throw new Error(r.status);
      cur = await r.json();
      img.innerHTML = cur.svg;
      img.title = cur.url;
      code.textContent = cur.code;
      ends = Date.now() + cur.expires_in * 1000;
      status.textContent = T.waiting;
      poll();
    } catch { showExpired(); }
  }
  function showExpired(msg) {
    img.innerHTML = '';
    const b = document.createElement('button');
    b.className = 'btn'; b.type = 'button'; b.textContent = T.refresh; b.onclick = start;
    img.append(b);
    code.textContent = '··';
    status.textContent = msg || T.expired;
  }
  async function poll() {
    if (document.hidden) { timer = setTimeout(poll, 2000); return; }
    if (Date.now() > ends) return showExpired();
    try {
      const r = await fetch(`/api/qr/poll?id=${encodeURIComponent(cur.id)}&poll=${encodeURIComponent(cur.poll)}`, { headers: { 'x-ms': '1' } });
      const j = await r.json();
      if (j.status === 'approved') { status.textContent = T.ok; location.href = box.dataset.next || '/app'; return; }
      if (j.status === 'denied' || j.status === 'blocked') return showExpired(T.denied);
      if (j.status === 'expired') return showExpired();
    } catch { /* network blip: keep polling */ }
    timer = setTimeout(poll, 1800);
  }
  start();
})();
