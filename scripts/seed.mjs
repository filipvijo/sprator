/**
 * Seed script — populates the SQLite DB with realistic demo data
 * matching the Sprator dashboard concept.
 *
 * Run with: node scripts/seed.mjs  (after npm install)
 * Reset with: node scripts/seed.mjs --reset
 */
import Database from "better-sqlite3";
import { randomUUID } from "crypto";

const dbPath = process.env.SPRATOR_DB_PATH || "./sprator.db";
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

// --- Schema (mirrors src/lib/db.ts) ---
db.exec(`
  CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY, stripe_sub_id TEXT, name TEXT NOT NULL,
    monthly_cost REAL NOT NULL, status TEXT NOT NULL DEFAULT 'active',
    last_used TEXT, agent_flag TEXT, category TEXT,
    created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS failed_payments (
    id TEXT PRIMARY KEY, stripe_invoice_id TEXT, customer_name TEXT NOT NULL,
    amount REAL NOT NULL, attempt INTEGER DEFAULT 1, status TEXT NOT NULL DEFAULT 'pending_dunning',
    agent_action TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS approvals (
    id TEXT PRIMARY KEY, type TEXT NOT NULL, title TEXT NOT NULL, reason TEXT NOT NULL,
    impact TEXT NOT NULL, savings_monthly REAL DEFAULT 0, status TEXT NOT NULL DEFAULT 'pending',
    expires_at TEXT, decided_at TEXT, decided_by TEXT, created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY, action TEXT NOT NULL, amount REAL, stripe_ref TEXT,
    status TEXT NOT NULL DEFAULT 'completed', category TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS agent_feed (
    id TEXT PRIMARY KEY, icon TEXT NOT NULL, description TEXT NOT NULL, status TEXT NOT NULL,
    kind TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now'))
  );
`);

if (process.argv.includes("--reset")) {
  db.exec("DELETE FROM subscriptions; DELETE FROM failed_payments; DELETE FROM approvals; DELETE FROM audit_log; DELETE FROM agent_feed;");
  console.log("Database reset.");
}

// --- Subscriptions ---
const subs = [
  { name: "AWS", cost: 1240.00, status: "active", last: "5m ago", flag: "Anomaly +340%", cat: "infrastructure" },
  { name: "Datadog", cost: 180.00, status: "active", last: "12m ago", flag: "Within budget", cat: "monitoring" },
  { name: "Notion (Team)", cost: 96.00, status: "active", last: "1d ago", flag: "Within budget", cat: "productivity" },
  { name: "Slack", cost: 87.00, status: "active", last: "1h ago", flag: "Within budget", cat: "communication" },
  { name: "Adobe CC", cost: 54.99, status: "active", last: "4d ago", flag: "Within budget", cat: "design" },
  { name: "Linear", cost: 48.00, status: "active", last: "30m ago", flag: "Price optimized", cat: "productivity" },
  { name: "Figma Pro", cost: 45.00, status: "waste", last: "61d ago", flag: "Duplicate detected", cat: "design" },
  { name: "Mailgun", cost: 35.00, status: "active", last: "3h ago", flag: "Within budget", cat: "infrastructure" },
  { name: "Zoom", cost: 30.00, status: "unused", last: "22d ago", flag: "Recommend cancel", cat: "communication" },
  { name: "Notion AI", cost: 20.00, status: "unused", last: "47d ago", flag: "Recommend cancel", cat: "productivity" },
  { name: "Vercel Pro", cost: 20.00, status: "active", last: "2h ago", flag: "Within budget", cat: "infrastructure" },
  { name: "1Password", cost: 19.95, status: "active", last: "6h ago", flag: "Within budget", cat: "security" },
];

const subInsert = db.prepare("INSERT OR REPLACE INTO subscriptions (id, name, monthly_cost, status, last_used, agent_flag, category) VALUES (?, ?, ?, ?, ?, ?, ?)");
for (const s of subs) {
  subInsert.run(`sub_${s.name.toLowerCase().replace(/[^a-z0-9]/g, "_")}`, s.name, s.cost, s.status, s.last, s.flag, s.cat);
}

// --- Failed Payments ---
const failedPayments = [
  { cust: "Acme Corp", amt: 49.00, attempt: 2, status: "email_sent", action: "Dunning email #2 sent" },
  { cust: "Globex Inc", amt: 128.00, attempt: 3, status: "recovered", action: "Card retried — success" },
  { cust: "Initech", amt: 240.00, attempt: 1, status: "pending_dunning", action: "Retry scheduled 18:00" },
  { cust: "Umbrella Co", amt: 89.00, attempt: 3, status: "lost", action: "Marked uncollectible" },
  { cust: "Soylent Inc", amt: 312.00, attempt: 2, status: "email_sent", action: "Reminder + payment link sent" },
  { cust: "Hooli", amt: 74.00, attempt: 1, status: "recovered", action: "Card retried — success" },
];

const fpInsert = db.prepare("INSERT OR REPLACE INTO failed_payments (id, customer_name, amount, attempt, status, agent_action) VALUES (?, ?, ?, ?, ?, ?)");
for (const f of failedPayments) {
  fpInsert.run(`fp_${f.cust.toLowerCase().replace(/[^a-z0-9]/g, "_")}`, f.cust, f.amt, f.attempt, f.status, f.action);
}

// --- Approvals ---
const approvals = [
  { type: "cancel_subscription", title: "Cancel Notion AI", reason: "Not accessed in 47 days. No active pages. 3 seats provisioned, only 1 in use.", impact: "$240 / yr saved", savings: 20, expiresH: 23 },
  { type: "cancel_subscription", title: "Cancel Figma Pro", reason: "Duplicate of existing Figma org seat. 0 files edited in 60 days.", impact: "$540 / yr saved", savings: 45, expiresH: 11 },
  { type: "investigate_anomaly", title: "Investigate AWS anomaly", reason: "us-east-1 EC2 spend +340% vs 30-day average. Likely orphaned m5.4xlarge instance.", impact: "Up to $340 / mo at risk", savings: 0, expiresH: 47 },
];

const apInsert = db.prepare("INSERT OR REPLACE INTO approvals (id, type, title, reason, impact, savings_monthly, status, expires_at) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)");
for (const a of approvals) {
  const expires = new Date(Date.now() + a.expiresH * 3600000).toISOString();
  apInsert.run(randomUUID(), a.type, a.title, a.reason, a.impact, a.savings, expires);
}

// --- Completed Approvals ---
const completedApprovals = [
  { title: "Cancel Webflow · $39/mo", decision: "approve", time: "Yesterday" },
  { title: "Downgrade Datadog · $180→$90", decision: "reject", time: "2d ago" },
  { title: "Cancel Loom Business · $16/mo", decision: "approve", time: "3d ago" },
];

const apComplete = db.prepare("INSERT OR REPLACE INTO approvals (id, type, title, reason, impact, savings_monthly, status, decided_at, decided_by) VALUES (?, ?, ?, '', '', 0, ?, datetime('now', '-1 day'), 'telegram')");
for (const c of completedApprovals) {
  apComplete.run(randomUUID(), "cancel_subscription", c.title, c.decision === "approve" ? "approve" : "reject");
}

// --- Agent Feed ---
const feedItems = [
  { icon: "⚠", desc: "Anomaly detected — AWS spend 340% above 30-day average. Flagged for manual review.", status: "Pending", kind: "amber" },
  { icon: "⊘", desc: "Proposed action — Cancel Figma Pro ($45/mo). Duplicate design tooling. Awaiting approval.", status: "Awaiting", kind: "amber" },
  { icon: "✓", desc: "Failed payment recovered — Acme Corp ($49.00). Dunning email #2 sent.", status: "Completed", kind: "emerald" },
  { icon: "!", desc: "Detected unused subscription — Notion AI ($20/mo). Last used 47 days ago.", status: "Pending", kind: "amber" },
  { icon: "↻", desc: "Subscription renewed — Vercel Pro ($20/mo). Within budget.", status: "Renewed", kind: "emerald" },
  { icon: "✓", desc: "Cancelled subscription — Webflow ($39/mo). Approved by you. $468/yr saved.", status: "Approved", kind: "emerald" },
  { icon: "✓", desc: "Failed payment recovered — Globex Inc ($128.00). Final attempt succeeded.", status: "Completed", kind: "emerald" },
  { icon: "✕", desc: "Proposed downgrade rejected — Datadog. Kept by you.", status: "Rejected", kind: "red" },
];

const feedInsert = db.prepare("INSERT INTO agent_feed (id, icon, description, status, kind) VALUES (?, ?, ?, ?, ?)");
for (const f of feedItems) {
  feedInsert.run(randomUUID(), f.icon, f.desc, f.status, f.kind);
}

// --- Audit Log ---
const auditItems = [
  { action: "Subscription cancelled — Webflow", amount: -39.00, ref: "sub_1QzRk8", status: "completed", cat: "Cancellations" },
  { action: "Payment recovered — Globex Inc", amount: 128.00, ref: "pi_3QzPm2", status: "completed", cat: "Recoveries" },
  { action: "Dunning email sent — Acme Corp", amount: null, ref: "evt_1QzL9f", status: "completed", cat: "Dunning" },
  { action: "Downgrade rejected — Datadog", amount: null, ref: "—", status: "rejected", cat: "Cancellations" },
  { action: "Subscription renewed — Vercel Pro", amount: -20.00, ref: "in_1QzHa4", status: "completed", cat: "Renewals" },
  { action: "Payment recovered — Hooli", amount: 74.00, ref: "pi_3QzC7n", status: "completed", cat: "Recoveries" },
  { action: "Anomaly flagged — AWS us-east-1", amount: null, ref: "evt_1Qz8k1", status: "pending", cat: "Anomalies" },
  { action: "Subscription cancelled — Loom Business", amount: -16.00, ref: "sub_1Qz5rp", status: "completed", cat: "Cancellations" },
];

const auditInsert = db.prepare("INSERT INTO audit_log (id, action, amount, stripe_ref, status, category) VALUES (?, ?, ?, ?, ?, ?)");
for (const a of auditItems) {
  auditInsert.run(randomUUID(), a.action, a.amount, a.ref, a.status, a.cat);
}

console.log("Seed complete:");
console.log(`  ${subs.length} subscriptions`);
console.log(`  ${failedPayments.length} failed payments`);
console.log(`  ${approvals.length} pending approvals`);
console.log(`  ${completedApprovals.length} completed approvals`);
console.log(`  ${feedItems.length} feed items`);
console.log(`  ${auditItems.length} audit entries`);

db.close();
