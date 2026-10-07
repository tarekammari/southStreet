# MIMO — Multi-Agent Intelligence & Management Operations
## South Street · Umrah & Hajj Agency Platform

**MIMO** is the official AI agent team for the South Street app.
Each `mimo-*` agent is a specialist. **MIMO Senior** is the orchestrator.

---

## App Context

| Item | Value |
|---|---|
| Framework | Next.js 15 + TypeScript |
| Database | SQLite (`south_street.db`) via `better-sqlite3` |
| Server | Express + Socket.IO (`server.js`) |
| Styling | TailwindCSS + custom CSS |
| AI | Sakhr agent (Google Gemini) |
| Path | `D:\data\south_street` |

## Roles

| Code | Label | Portal |
|---|---|---|
| `SUPER_ADMIN` | مدير النظام العام | `/admin` |
| `AGENCY_MANAGER` | مدير الوكالة | `/admin` |
| `ACCOUNTANT` | محاسب الوكالة | `/portal?tab=accountant` |
| `GUIDE_MURSHID` | مرشد ديني | `/portal?tab=murshid` |
| `AGENCY_AGENT` | موظف الوكالة | `/portal?tab=agent` |
| `PILGRIM_USER` | معتمر / حاج | `/portal?tab=program` |

---

## Agent Team

| Agent | File | Domain |
|---|---|---|
| **MIMO Senior** | `mimo-senior/SKILL.md` | Orchestrator — runs all agents, merges reports |
| **MIMO Security** | `mimo-security/SKILL.md` | Security audit & live threat monitoring |
| **MIMO UI** | `mimo-ui/SKILL.md` | UX/UI modernisation & accessibility |
| **MIMO Perf** | `mimo-perf/SKILL.md` | Performance, memory, media optimisation |
| **MIMO Auth** | `mimo-auth/SKILL.md` | Auth & authorisation hardening |
| **MIMO Accountant** | `mimo-accountant/SKILL.md` | CPA-grade financial analysis |
| **MIMO Admin** | `mimo-admin/SKILL.md` | SUPER_ADMIN role specialist |
| **MIMO Manager** | `mimo-manager/SKILL.md` | AGENCY_MANAGER role specialist |
| **MIMO Murshid** | `mimo-murshid/SKILL.md` | GUIDE_MURSHID role specialist |
| **MIMO Agent** | `mimo-agent/SKILL.md` | AGENCY_AGENT role specialist |
| **MIMO Pilgrim** | `mimo-pilgrim/SKILL.md` | PILGRIM_USER experience guardian |

---

## Quick Commands

```bash
# Run all agents and generate full report
npx tsx mimo/scripts/run-all.ts

# Run a single agent
npx tsx mimo/scripts/security-audit.ts
npx tsx mimo/scripts/financial-report.ts
npx tsx mimo/scripts/ui-audit.ts
npx tsx mimo/scripts/perf-audit.ts
npx tsx mimo/scripts/auth-audit.ts
```

Reports are saved to `mimo/reports/`.

---

## Severity Scale

| Level | Meaning | Action |
|---|---|---|
| 🔴 CRITICAL | Security breach / data loss risk | Immediate fix required |
| 🟠 HIGH | Significant issue | Fix before next release |
| 🟡 MEDIUM | Improvement needed | Fix in next sprint |
| 🔵 LOW | Enhancement | Fix when convenient |
| ✅ PASS | No issues | No action needed |
