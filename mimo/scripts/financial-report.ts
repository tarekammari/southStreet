#!/usr/bin/env tsx
/**
 * MIMO Financial Report Script
 * Reads the South Street SQLite database and generates a CPA-grade financial report.
 * Run: npx tsx mimo/scripts/financial-report.ts
 * Output: mimo/reports/financial.md
 *
 * READ-ONLY — never modifies the database.
 */

import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

const APP_ROOT = path.resolve(__dirname, '../..');
const DB_PATH = path.join(APP_ROOT, 'south_street.db');
const REPORT_DIR = path.join(APP_ROOT, 'mimo', 'reports');
const REPORT_FILE = path.join(REPORT_DIR, 'financial.md');

// Parse CLI args
const args = process.argv.slice(2);
const periodArg = args.find(a => a.startsWith('--period='))?.split('=')[1];
const typeArg = args.find(a => a.startsWith('--type='))?.split('=')[1] || 'monthly';

console.log('💰 MIMO Accountant — Financial Report generating...\n');

if (!fs.existsSync(DB_PATH)) {
  console.error(`❌ Database not found: ${DB_PATH}`);
  process.exit(1);
}

const db = new Database(DB_PATH, { readonly: true, fileMustExist: true });

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return new Intl.NumberFormat('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function fmtPct(n: number): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
}

function safeQuery<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
  try {
    return db.prepare(sql).all(...params) as T[];
  } catch {
    return [];
  }
}

function safeGet<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T | null {
  try {
    return db.prepare(sql).get(...params) as T | null;
  } catch {
    return null;
  }
}

// ─── DISCOVER SCHEMA ──────────────────────────────────────────────────────────

function getTables(): string[] {
  const rows = safeQuery<{ name: string }>(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`);
  return rows.map(r => r.name);
}

function getColumns(table: string): string[] {
  const rows = safeQuery<{ name: string }>(`PRAGMA table_info(${table})`);
  return rows.map(r => r.name);
}

function hasColumn(table: string, col: string): boolean {
  return getColumns(table).includes(col);
}

function tableHas(table: string): boolean {
  return getTables().includes(table);
}

const tables = getTables();
console.log(`📊 Tables found: ${tables.join(', ')}\n`);

// ─── FINANCIAL ANALYSIS ───────────────────────────────────────────────────────

interface FinancialSummary {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  totalBookings: number;
  paidBookings: number;
  cancelledBookings: number;
  pendingBookings: number;
  outstandingReceivables: number;
  overdueAmount: number;
  avgBookingValue: number;
  currency: string;
}

const summary: FinancialSummary = {
  totalRevenue: 0,
  totalExpenses: 0,
  netProfit: 0,
  totalBookings: 0,
  paidBookings: 0,
  cancelledBookings: 0,
  pendingBookings: 0,
  outstandingReceivables: 0,
  overdueAmount: 0,
  avgBookingValue: 0,
  currency: 'MAD',
};

// ─── BOOKINGS ANALYSIS ────────────────────────────────────────────────────────

interface BookingRow {
  id?: number;
  status?: string;
  payment_status?: string;
  total_price?: number;
  amount_paid?: number;
  amount?: number;
  price?: number;
  created_at?: string;
  package_id?: number;
  user_id?: number;
  agent_id?: number;
  trip_type?: string;
}

// Find the bookings table
const bookingTable = tableHas('bookings') ? 'bookings' : tableHas('reservations') ? 'reservations' : null;
let bookingsByStatus: Record<string, unknown>[] = [];
let bookingsByMonth: Record<string, unknown>[] = [];
let bookingsByPackage: Record<string, unknown>[] = [];
let topAgents: Record<string, unknown>[] = [];

if (bookingTable) {
  const cols = getColumns(bookingTable);
  const priceCol = cols.find(c => ['total_price', 'amount', 'price', 'total_amount', 'booking_price'].includes(c)) || 'total_price';
  const paidCol = cols.find(c => ['amount_paid', 'paid_amount', 'payment_amount'].includes(c));
  const statusCol = cols.find(c => ['status', 'booking_status', 'state'].includes(c)) || 'status';
  const dateCol = cols.find(c => ['created_at', 'booking_date', 'created_date', 'date'].includes(c)) || 'created_at';

  console.log(`📋 Bookings table: ${bookingTable}, price col: ${priceCol}, status: ${statusCol}`);

  // Total bookings count
  const countRow = safeGet<{ total: number }>(`SELECT COUNT(*) as total FROM ${bookingTable}`);
  summary.totalBookings = countRow?.total || 0;

  // By status
  bookingsByStatus = safeQuery(`SELECT ${statusCol} as status, COUNT(*) as count, SUM(${priceCol}) as revenue FROM ${bookingTable} GROUP BY ${statusCol}`);

  for (const row of bookingsByStatus as Array<{ status: string; count: number; revenue: number }>) {
    const s = (row.status || '').toLowerCase();
    if (s.includes('paid') || s.includes('confirmed') || s.includes('completed') || s === 'active') {
      summary.paidBookings += row.count || 0;
      summary.totalRevenue += row.revenue || 0;
    } else if (s.includes('cancel') || s.includes('refund')) {
      summary.cancelledBookings += row.count || 0;
    } else if (s.includes('pending') || s.includes('awaiting') || s.includes('draft')) {
      summary.pendingBookings += row.count || 0;
      summary.outstandingReceivables += row.revenue || 0;
    }
  }

  // If no status breakdown worked, try total
  if (summary.totalRevenue === 0) {
    const totRow = safeGet<{ revenue: number; avg: number }>(`SELECT SUM(${priceCol}) as revenue, AVG(${priceCol}) as avg FROM ${bookingTable}`);
    summary.totalRevenue = totRow?.revenue || 0;
    summary.avgBookingValue = totRow?.avg || 0;
  }

  if (summary.totalBookings > 0) {
    summary.avgBookingValue = summary.totalRevenue / Math.max(1, summary.paidBookings || summary.totalBookings);
  }

  // Monthly breakdown
  bookingsByMonth = safeQuery(`
    SELECT
      strftime('%Y-%m', ${dateCol}) as month,
      COUNT(*) as bookings,
      SUM(${priceCol}) as revenue,
      AVG(${priceCol}) as avg_value
    FROM ${bookingTable}
    GROUP BY month
    ORDER BY month DESC
    LIMIT 12
  `);

  // By package
  if (cols.includes('package_id') || cols.includes('package_name') || cols.includes('trip_type')) {
    const pkgCol = cols.find(c => ['trip_type', 'package_type', 'type', 'travel_type'].includes(c));
    const pkgIdCol = cols.includes('package_id') ? 'package_id' : null;

    if (pkgCol) {
      bookingsByPackage = safeQuery(`
        SELECT ${pkgCol} as package_type, COUNT(*) as count, SUM(${priceCol}) as revenue
        FROM ${bookingTable}
        WHERE ${pkgCol} IS NOT NULL
        GROUP BY ${pkgCol}
        ORDER BY revenue DESC
      `);
    }
  }

  // Agent performance
  if (cols.includes('agent_id') || cols.includes('staff_id') || cols.includes('created_by')) {
    const agentCol = cols.find(c => ['agent_id', 'staff_id', 'created_by', 'assigned_to'].includes(c))!;
    topAgents = safeQuery(`
      SELECT ${agentCol} as agent_id, COUNT(*) as bookings, SUM(${priceCol}) as revenue
      FROM ${bookingTable}
      WHERE ${agentCol} IS NOT NULL
      GROUP BY ${agentCol}
      ORDER BY revenue DESC
      LIMIT 10
    `);
  }
}

// ─── PAYMENTS ─────────────────────────────────────────────────────────────────

const paymentTable = tableHas('payments') ? 'payments' : tableHas('transactions') ? 'transactions' : null;
let paymentsByType: Record<string, unknown>[] = [];
let paymentsByMonth: Record<string, unknown>[] = [];

if (paymentTable) {
  const cols = getColumns(paymentTable);
  const amtCol = cols.find(c => ['amount', 'total', 'payment_amount'].includes(c)) || 'amount';
  const typeCol = cols.find(c => ['payment_method', 'type', 'method'].includes(c));
  const dateCol = cols.find(c => ['created_at', 'payment_date', 'date', 'paid_at'].includes(c)) || 'created_at';

  console.log(`💳 Payments table: ${paymentTable}`);

  const totPayRow = safeGet<{ total: number; count: number }>(`SELECT SUM(${amtCol}) as total, COUNT(*) as count FROM ${paymentTable}`);
  if (totPayRow?.total) {
    // Cross-check with booking revenue
    console.log(`   Total payments recorded: ${fmt(totPayRow.total)} MAD (${totPayRow.count} transactions)`);
  }

  if (typeCol) {
    paymentsByType = safeQuery(`
      SELECT ${typeCol} as method, COUNT(*) as count, SUM(${amtCol}) as total
      FROM ${paymentTable}
      GROUP BY ${typeCol}
      ORDER BY total DESC
    `);
  }

  paymentsByMonth = safeQuery(`
    SELECT strftime('%Y-%m', ${dateCol}) as month, SUM(${amtCol}) as collected, COUNT(*) as transactions
    FROM ${paymentTable}
    GROUP BY month
    ORDER BY month DESC
    LIMIT 12
  `);
}

// ─── EXPENSES ─────────────────────────────────────────────────────────────────

const expenseTable = tableHas('expenses') ? 'expenses' : null;
let expensesByCategory: Record<string, unknown>[] = [];

if (expenseTable) {
  const cols = getColumns(expenseTable);
  const amtCol = cols.find(c => ['amount', 'total', 'cost'].includes(c)) || 'amount';
  const catCol = cols.find(c => ['category', 'type', 'expense_type'].includes(c));

  const totExpRow = safeGet<{ total: number }>(`SELECT SUM(${amtCol}) as total FROM ${expenseTable}`);
  summary.totalExpenses = totExpRow?.total || 0;

  if (catCol) {
    expensesByCategory = safeQuery(`
      SELECT ${catCol} as category, SUM(${amtCol}) as total, COUNT(*) as count
      FROM ${expenseTable}
      GROUP BY ${catCol}
      ORDER BY total DESC
    `);
  }
}

summary.netProfit = summary.totalRevenue - summary.totalExpenses;
const profitMargin = summary.totalRevenue > 0 ? (summary.netProfit / summary.totalRevenue) * 100 : 0;

// ─── PACKAGES ─────────────────────────────────────────────────────────────────

const packageTable = tableHas('packages') ? 'packages' : null;
let packageList: Record<string, unknown>[] = [];

if (packageTable) {
  const cols = getColumns(packageTable);
  const priceCol = cols.find(c => ['price', 'base_price', 'cost', 'amount'].includes(c)) || 'price';
  const nameCol = cols.find(c => ['name', 'title', 'package_name'].includes(c)) || 'name';

  packageList = safeQuery(`SELECT * FROM ${packageTable} LIMIT 20`);
  console.log(`📦 Packages found: ${packageList.length}`);
}

// ─── USERS ────────────────────────────────────────────────────────────────────

const userTable = tableHas('users') ? 'users' : tableHas('pilgrims') ? 'pilgrims' : null;
let userStats: Record<string, unknown> = {};
let topClients: Record<string, unknown>[] = [];

if (userTable) {
  const cols = getColumns(userTable);
  const roleCol = cols.find(c => ['role', 'user_role', 'role_name'].includes(c));
  const dateCol = cols.find(c => ['created_at', 'registered_at', 'join_date'].includes(c)) || 'created_at';

  const totUsersRow = safeGet<{ total: number }>(`SELECT COUNT(*) as total FROM ${userTable}`);
  userStats = { total: totUsersRow?.total || 0 };

  if (roleCol) {
    const byRole = safeQuery(`SELECT ${roleCol} as role, COUNT(*) as count FROM ${userTable} GROUP BY ${roleCol}`);
    userStats.byRole = byRole;
  }

  // Top clients (pilgrims by spending) — join with bookings if possible
  if (bookingTable) {
    const bCols = getColumns(bookingTable);
    const priceCol = bCols.find(c => ['total_price', 'amount', 'price'].includes(c)) || 'total_price';
    const userJoinCol = bCols.find(c => ['user_id', 'pilgrim_id', 'customer_id'].includes(c));
    if (userJoinCol) {
      topClients = safeQuery(`
        SELECT b.${userJoinCol} as user_id, COUNT(*) as bookings, SUM(b.${priceCol}) as total_spent
        FROM ${bookingTable} b
        GROUP BY b.${userJoinCol}
        ORDER BY total_spent DESC
        LIMIT 10
      `);
    }
  }
}

// ─── CLOSE DB ─────────────────────────────────────────────────────────────────

db.close();

// ─── GENERATE REPORT ──────────────────────────────────────────────────────────

if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });

const now = new Date();
const reportPeriod = periodArg || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

function tableRow(row: Record<string, unknown>, keys: string[]): string {
  return '| ' + keys.map(k => String(row[k] ?? '-')).join(' | ') + ' |';
}

function markdownTable(rows: Record<string, unknown>[], headers: string[], keys: string[]): string {
  if (!rows.length) return '*No data available*';
  const head = '| ' + headers.join(' | ') + ' |';
  const sep = '| ' + headers.map(() => '---').join(' | ') + ' |';
  const body = rows.map(r => tableRow(r, keys)).join('\n');
  return `${head}\n${sep}\n${body}`;
}

const report = `# 💰 MIMO Financial Report
**Generated**: ${now.toISOString()}
**Auditor**: mimo-accountant (CPA-Grade Financial Analysis)
**Agency**: South Street — Umrah & Hajj Agency
**Period**: ${reportPeriod}
**Database**: south_street.db (Read-Only)

---

## 📊 Executive Financial Dashboard

\`\`\`
╔══════════════════════════════════════════════════════════════╗
║              SOUTH STREET — FINANCIAL SUMMARY                ║
║              Umrah & Hajj Agency — ${reportPeriod}                    ║
╠══════════════════════════════════════════════════════════════╣
║  💰 Total Revenue:         ${fmt(summary.totalRevenue).padStart(20)} MAD  ║
║  📉 Total Expenses:        ${fmt(summary.totalExpenses).padStart(20)} MAD  ║
║  📊 Net Profit:            ${fmt(summary.netProfit).padStart(20)} MAD  ║
║  📈 Profit Margin:         ${fmtPct(profitMargin).padStart(20)}       ║
║  📋 Total Bookings:        ${String(summary.totalBookings).padStart(20)}       ║
║  ✅ Confirmed/Paid:        ${String(summary.paidBookings).padStart(20)}       ║
║  ⏳ Pending:               ${String(summary.pendingBookings).padStart(20)}       ║
║  ❌ Cancelled:             ${String(summary.cancelledBookings).padStart(20)}       ║
║  ⚠️  Outstanding:          ${fmt(summary.outstandingReceivables).padStart(20)} MAD  ║
║  📌 Avg. Booking Value:    ${fmt(summary.avgBookingValue).padStart(20)} MAD  ║
╚══════════════════════════════════════════════════════════════╝
\`\`\`

---

## 1. 📈 Revenue Analysis

### Bookings by Status
${bookingsByStatus.length > 0
    ? markdownTable(bookingsByStatus as Record<string, unknown>[], ['Status', 'Count', 'Revenue (MAD)'], ['status', 'count', 'revenue'])
    : '*No booking status data available*'}

### Monthly Revenue Trend (Last 12 Months)
${bookingsByMonth.length > 0
    ? markdownTable(bookingsByMonth as Record<string, unknown>[], ['Month', 'Bookings', 'Revenue (MAD)', 'Avg Value'], ['month', 'bookings', 'revenue', 'avg_value'])
    : '*No monthly data available*'}

### Revenue by Package Type
${bookingsByPackage.length > 0
    ? markdownTable(bookingsByPackage as Record<string, unknown>[], ['Package Type', 'Bookings', 'Revenue (MAD)'], ['package_type', 'count', 'revenue'])
    : '*No package type breakdown available*'}

---

## 2. 📉 Expense Analysis

**Total Expenses**: ${fmt(summary.totalExpenses)} MAD

${expensesByCategory.length > 0
    ? `### Expenses by Category\n${markdownTable(expensesByCategory as Record<string, unknown>[], ['Category', 'Total (MAD)', 'Count'], ['category', 'total', 'count'])}`
    : summary.totalExpenses === 0
      ? '*No expense records found in database. Consider adding an expenses table to track operational costs.*'
      : '*Expense categories not available*'}

---

## 3. 📊 Profit & Loss Statement

\`\`\`
INCOME STATEMENT — ${reportPeriod}
─────────────────────────────────────────────────────
Gross Revenue:                    ${fmt(summary.totalRevenue).padStart(15)} MAD
─────────────────────────────────────────────────────
${summary.totalExpenses > 0 ? `Total Expenses:                  (${fmt(summary.totalExpenses).padStart(14)}) MAD` : 'Expenses:                         Not tracked in DB'}
─────────────────────────────────────────────────────
Net Profit:                       ${fmt(summary.netProfit).padStart(15)} MAD
Profit Margin:                    ${fmtPct(profitMargin).padStart(15)}
─────────────────────────────────────────────────────
\`\`\`

${summary.totalExpenses === 0 ? '> ⚠️ **Note**: No expense records were found. The net profit figure reflects revenue only. Add expense tracking to get accurate P&L.' : ''}

---

## 4. ⚠️ Accounts Receivable

| Metric | Value |
|---|---|
| Outstanding Receivables | ${fmt(summary.outstandingReceivables)} MAD |
| Pending Bookings | ${summary.pendingBookings} |
| Collection Rate | ${summary.totalBookings > 0 ? fmtPct((summary.paidBookings / summary.totalBookings) * 100) : 'N/A'} |

${summary.outstandingReceivables > 0
    ? `> ⚠️ **${fmt(summary.outstandingReceivables)} MAD** in pending bookings represents potential receivables. Follow up with clients who have not completed payment.`
    : '> ✅ No significant outstanding receivables detected.'}

---

## 5. 💳 Payment Methods

${paymentsByType.length > 0
    ? markdownTable(paymentsByType as Record<string, unknown>[], ['Method', 'Transactions', 'Total (MAD)'], ['method', 'count', 'total'])
    : '*Payment method breakdown not available*'}

### Monthly Collections
${paymentsByMonth.length > 0
    ? markdownTable(paymentsByMonth as Record<string, unknown>[], ['Month', 'Collected (MAD)', 'Transactions'], ['month', 'collected', 'transactions'])
    : '*No payment history data available*'}

---

## 6. 🏆 Agent Performance

${topAgents.length > 0
    ? markdownTable(topAgents as Record<string, unknown>[], ['Agent ID', 'Bookings', 'Revenue (MAD)'], ['agent_id', 'bookings', 'revenue'])
    : '*Agent performance data not available (agent_id not linked to bookings)*'}

---

## 7. 👥 Client Analytics

**Total Users**: ${(userStats as { total?: number }).total || 0}

${topClients.length > 0
    ? `### Top Clients by Spending\n${markdownTable(topClients as Record<string, unknown>[], ['Client ID', 'Bookings', 'Total Spent (MAD)'], ['user_id', 'bookings', 'total_spent'])}`
    : '*Top client data not available*'}

---

## 8. 📦 Package Catalog

**Packages available**: ${packageList.length}

${packageList.length > 0
    ? packageList.slice(0, 10).map((p, i) => `${i + 1}. ${Object.values(p).filter(v => typeof v === 'string' && v.length > 2).slice(0, 2).join(' — ')}`).join('\n')
    : '*No package data available*'}

---

## 9. 🗄️ Database Schema Discovered

Tables found: ${tables.join(', ')}

---

## 10. 💡 Financial Recommendations

${summary.totalRevenue === 0
    ? `1. **⚠️ Data Access**: Revenue data could not be extracted. Review database schema and ensure the booking/payment tables contain financial columns in expected format.
2. **Track Expenses**: Add an \`expenses\` table to enable proper P&L reporting.
3. **Payment Integration**: Ensure payment records link to bookings via foreign keys for complete financial traceability.`
    : `1. **Revenue Growth**: ${summary.avgBookingValue > 0 ? `Average booking value is ${fmt(summary.avgBookingValue)} MAD. Consider premium package upsells.` : 'Track average booking value to identify upsell opportunities.'}
2. **Receivables**: ${summary.outstandingReceivables > 0 ? `${fmt(summary.outstandingReceivables)} MAD outstanding. Set up automated payment reminders.` : 'Receivables under control. Maintain regular follow-up cadence.'}
3. **Expenses**: ${summary.totalExpenses === 0 ? 'Add expense tracking to the database for accurate profitability analysis.' : `Expense ratio is ${fmtPct((summary.totalExpenses / summary.totalRevenue) * 100)}. Target < 60% for healthy margins.`}
4. **Cancellations**: ${summary.cancelledBookings > 0 ? `${summary.cancelledBookings} cancelled bookings detected. Review cancellation policy and implement deposits.` : 'Low cancellation rate — excellent!'}
5. **Agent Performance**: ${topAgents.length > 0 ? 'Review top vs. bottom agent performance. Consider incentive programs for top performers.' : 'Implement agent_id tracking in bookings for performance attribution.'}`}

---

*Report generated by MIMO Accountant Agent (CPA-Grade Financial Analysis)*
*Run \`npx tsx mimo/scripts/financial-report.ts\` to refresh*
*Database: south_street.db (Read-Only)*
`;

fs.writeFileSync(REPORT_FILE, report);
console.log(`\n✅ Financial report complete`);
console.log(`   Revenue: ${fmt(summary.totalRevenue)} MAD | Bookings: ${summary.totalBookings} | Margin: ${fmtPct(profitMargin)}`);
console.log(`   Report: ${REPORT_FILE}\n`);
