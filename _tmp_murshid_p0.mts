async function sleep(ms: number) { await new Promise((r) => setTimeout(r, ms)); }

async function probe() {
  // wait briefly if mid-restart
  let cfgOk = false;
  for (let i = 0; i < 2; i++) {
    try {
      const c = await fetch("http://127.0.0.1:3000/api/auth/config");
      if (c.ok) { cfgOk = true; break; }
    } catch {}
    await sleep(2500);
  }
  if (!cfgOk) {
    // one more retry after longer wait as instructed
    await sleep(4000);
    try {
      const c = await fetch("http://127.0.0.1:3000/api/auth/config");
      cfgOk = c.ok;
    } catch {}
  }
  if (!cfgOk) {
    console.log(JSON.stringify({ ready: "NOT READY", error: "server unreachable after retry" }, null, 2));
    return;
  }

  const loginRes = await fetch("http://127.0.0.1:3000/api/admin/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "ss.usr003", password: "Murshid@2026!" }),
  });
  const login = await loginRes.json();
  if (loginRes.status !== 200 || login.status !== "SUCCESS" || login.user?.role !== "GUIDE_MURSHID") {
    console.log(JSON.stringify({ ready: "NOT READY", error: "login failed", status: loginRes.status, role: login?.user?.role }, null, 2));
    return;
  }
  const h = {
    Authorization: `Bearer ${login.token}`,
    Cookie: `south_street_token=${login.token}`,
    "Content-Type": "application/json",
  };
  async function hit(path: string, init?: RequestInit & { auth?: boolean }) {
    const useAuth = init?.auth !== false;
    const headers = useAuth ? { ...h, ...(init?.headers || {}) } : { "Content-Type": "application/json", ...(init?.headers || {}) };
    const { auth: _a, ...rest } = init || {};
    const res = await fetch(`http://127.0.0.1:3000${path}`, { ...rest, headers });
    const text = await res.text();
    let body: any = text;
    try { body = JSON.parse(text); } catch {}
    const snippet = typeof body === "string" ? body.slice(0, 100) : JSON.stringify(body).slice(0, 140);
    return { status: res.status, snippet };
  }

  const blocked = (s: number) => s === 401 || s === 403;

  let sakhrAuth = await hit("/api/admin/sakhr-knowledge");
  let sakhrUnauth = await hit("/api/admin/sakhr-knowledge", { auth: false });
  // if looks like restart flake (5xx / network), retry once
  if (sakhrAuth.status >= 500 || sakhrUnauth.status >= 500) {
    await sleep(3000);
    sakhrAuth = await hit("/api/admin/sakhr-knowledge");
    sakhrUnauth = await hit("/api/admin/sakhr-knowledge", { auth: false });
  }

  const adminUsers = await hit("/api/admin/users");
  const receipts = await hit("/api/receipts");
  const firewall = await hit("/api/security/firewall");
  const portal = await hit("/portal");
  const sakhrChat = await hit("/api/ai/sakhr", {
    method: "POST",
    body: JSON.stringify({ prompt: "مرحبا", history: [] }),
  });

  const { PORTAL_TABS, resolvePortalTab, toPortalRole } = await import("./lib/roles");
  const role = toPortalRole("murshid");
  const tabs = PORTAL_TABS[role].map((t: any) => t.tab);
  const tabsOk = JSON.stringify(tabs) === JSON.stringify(["murshid", "rituals", "security", "chat"]);
  const denyOk = ["admin", "accountant", "manager"].every((t) => resolvePortalTab(role, t) === "murshid");

  const items = [
    { id: "1_sakhr_knowledge_auth", result: blocked(sakhrAuth.status) ? "PASS" : "FAIL", detail: `status=${sakhrAuth.status} ${sakhrAuth.snippet}` },
    { id: "2_sakhr_knowledge_unauth", result: blocked(sakhrUnauth.status) ? "PASS" : "FAIL", detail: `status=${sakhrUnauth.status} ${sakhrUnauth.snippet}` },
    { id: "3a_admin_users", result: blocked(adminUsers.status) ? "PASS" : "FAIL", detail: `status=${adminUsers.status}` },
    { id: "3b_receipts", result: blocked(receipts.status) ? "PASS" : "FAIL", detail: `status=${receipts.status}` },
    { id: "3c_firewall", result: firewall.status === 403 || blocked(firewall.status) ? "PASS" : "FAIL", detail: `status=${firewall.status}` },
    { id: "4_portal_sakhr", result: (tabsOk && denyOk && portal.status === 200 && sakhrChat.status === 200) ? "PASS" : "FAIL", detail: `tabs=${tabs.join("|")} portal=${portal.status} sakhrChat=${sakhrChat.status}` },
  ];

  const blockers = items.filter((i) => i.result === "FAIL").map((i) => `${i.id}: ${i.detail}`);
  const ready = blockers.length === 0 ? "READY" : "NOT READY";
  console.log(JSON.stringify({
    login: { role: login.user.role, redirect: login.user.redirect },
    items,
    blockers,
    ready,
    summary: items.map((i) => `${i.id}:${i.result}`).join(" "),
  }, null, 2));
}
probe().catch((e) => { console.error(String(e?.stack || e)); process.exit(1); });
