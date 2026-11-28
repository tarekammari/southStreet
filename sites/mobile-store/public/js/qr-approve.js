// Phone side of QR sign-in: the user picks the number shown on the PC, or denies.
(() => {
  const box = document.getElementById('qra');
  if (!box) return;
  const T = JSON.parse(box.dataset.t);
  const status = document.getElementById('qra-status');
  const send = async (payload) => {
    box.querySelectorAll('button').forEach((b) => { b.disabled = true; });
    try {
      const r = await fetch('/api/qr/approve', { method: 'POST', headers: { 'x-ms': '1', 'content-type': 'application/json' }, body: JSON.stringify({ id: box.dataset.id, ...payload }) });
      const j = await r.json();
      if (r.ok) status.textContent = j.status === 'approved' ? T.done : T.denied;
      else status.textContent = j.error === 'qr_wrong_code' ? T.wrong : T.gone;
      status.className = 'qr-status ' + (r.ok && j.status === 'approved' ? 'ok' : 'err');
      box.querySelectorAll('.choices,[data-deny]').forEach((e) => e.remove());
    } catch { status.textContent = T.gone; }
  };
  box.querySelectorAll('[data-code]').forEach((b) => b.addEventListener('click', () => send({ code: b.dataset.code })));
  box.querySelector('[data-deny]').addEventListener('click', () => send({ deny: true }));
})();
