/**
 * In-memory data store — auto-seeds on first access.
 * Works on Vercel serverless (no native modules, no filesystem writes).
 * Data persists for the lifetime of the serverless function instance.
 */

import { randomUUID } from "crypto";

export interface Subscription {
  id: string;
  stripe_sub_id: string | null;
  name: string;
  monthly_cost: number;
  status: string;
  last_used: string;
  agent_flag: string | null;
  category: string;
}

export interface FailedPayment {
  id: string;
  stripe_invoice_id: string | null;
  customer_name: string;
  amount: number;
  attempt: number;
  status: string;
  agent_action: string | null;
}

export interface Approval {
  id: string;
  type: string;
  title: string;
  reason: string;
  impact: string;
  savings_monthly: number;
  status: string;
  expires_at: string | null;
  decided_at: string | null;
  decided_by: string | null;
}

export interface AuditEntry {
  id: string;
  action: string;
  amount: number | null;
  stripe_ref: string | null;
  status: string;
  category: string;
  created_at: string;
}

export interface FeedItem {
  id: string;
  icon: string;
  description: string;
  status: string;
  kind: string;
  created_at: string;
}

interface DB {
  subscriptions: Map<string, Subscription>;
  failed_payments: Map<string, FailedPayment>;
  approvals: Map<string, Approval>;
  audit_log: AuditEntry[];
  agent_feed: FeedItem[];
}

let _db: DB | null = null;

function seedData(): DB {
  const db: DB = {
    subscriptions: new Map(),
    failed_payments: new Map(),
    approvals: new Map(),
    audit_log: [],
    agent_feed: [],
  };

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

  for (const s of subs) {
    const id = `sub_${s.name.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
    db.subscriptions.set(id, {
      id, stripe_sub_id: null, name: s.name, monthly_cost: s.cost,
      status: s.status, last_used: s.last, agent_flag: s.flag, category: s.cat,
    });
  }

  const failedPayments = [
    { cust: "Acme Corp", amt: 49.00, attempt: 2, status: "email_sent", action: "Dunning email #2 sent" },
    { cust: "Globex Inc", amt: 128.00, attempt: 3, status: "recovered", action: "Card retried — success" },
    { cust: "Initech", amt: 240.00, attempt: 1, status: "pending_dunning", action: "Retry scheduled 18:00" },
    { cust: "Umbrella Co", amt: 89.00, attempt: 3, status: "lost", action: "Marked uncollectible" },
    { cust: "Soylent Inc", amt: 312.00, attempt: 2, status: "email_sent", action: "Reminder + payment link sent" },
    { cust: "Hooli", amt: 74.00, attempt: 1, status: "recovered", action: "Card retried — success" },
  ];

  for (const f of failedPayments) {
    const id = `fp_${f.cust.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
    db.failed_payments.set(id, {
      id, stripe_invoice_id: null, customer_name: f.cust, amount: f.amt,
      attempt: f.attempt, status: f.status, agent_action: f.action,
    });
  }

  const approvals = [
    { type: "cancel_subscription", title: "Cancel Notion AI", reason: "Not accessed in 47 days. No active pages. 3 seats provisioned, only 1 in use.", impact: "$240 / yr saved", savings: 20, expiresH: 23 },
    { type: "cancel_subscription", title: "Cancel Figma Pro", reason: "Duplicate of existing Figma org seat. 0 files edited in 60 days.", impact: "$540 / yr saved", savings: 45, expiresH: 11 },
    { type: "investigate_anomaly", title: "Investigate AWS anomaly", reason: "us-east-1 EC2 spend +340% vs 30-day average. Likely orphaned m5.4xlarge instance.", impact: "Up to $340 / mo at risk", savings: 0, expiresH: 47 },
  ];

  for (const a of approvals) {
    const id = randomUUID();
    const expires = new Date(Date.now() + a.expiresH * 3600000).toISOString();
    db.approvals.set(id, {
      id, type: a.type, title: a.title, reason: a.reason, impact: a.impact,
      savings_monthly: a.savings, status: "pending", expires_at: expires,
      decided_at: null, decided_by: null,
    });
  }

  const completedApprovals = [
    { title: "Cancel Webflow · $39/mo", decision: "approve" as const },
    { title: "Downgrade Datadog · $180→$90", decision: "reject" as const },
    { title: "Cancel Loom Business · $16/mo", decision: "approve" as const },
  ];

  for (const c of completedApprovals) {
    const id = randomUUID();
    db.approvals.set(id, {
      id, type: "cancel_subscription", title: c.title, reason: "", impact: "",
      savings_monthly: 0, status: c.decision, expires_at: null,
      decided_at: new Date(Date.now() - 86400000).toISOString(), decided_by: "telegram",
    });
  }

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

  for (const f of feedItems) {
    const id = randomUUID();
    db.agent_feed.push({
      id, icon: f.icon, description: f.desc, status: f.status, kind: f.kind,
      created_at: new Date().toISOString(),
    });
  }

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

  for (const a of auditItems) {
    db.audit_log.push({
      id: randomUUID(), action: a.action, amount: a.amount, stripe_ref: a.ref,
      status: a.status, category: a.cat, created_at: new Date().toISOString(),
    });
  }

  return db;
}

export function getDb(): DB {
  if (!_db) {
    _db = seedData();
  }
  return _db;
}

export function resetDb(): void {
  _db = seedData();
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export function getAllSubscriptions(): Subscription[] {
  return Array.from(getDb().subscriptions.values());
}

export function getSubscription(id: string): Subscription | undefined {
  return getDb().subscriptions.get(id);
}

export function updateSubscription(id: string, updates: Partial<Subscription>): void {
  const db = getDb();
  const sub = db.subscriptions.get(id);
  if (sub) {
    db.subscriptions.set(id, { ...sub, ...updates });
  }
}

export function getAllFailedPayments(): FailedPayment[] {
  return Array.from(getDb().failed_payments.values());
}

export function getFailedPayment(id: string): FailedPayment | undefined {
  return getDb().failed_payments.get(id);
}

export function updateFailedPayment(id: string, updates: Partial<FailedPayment>): void {
  const db = getDb();
  const fp = db.failed_payments.get(id);
  if (fp) {
    db.failed_payments.set(id, { ...fp, ...updates });
  }
}

export function getPendingApprovals(): Approval[] {
  return Array.from(getDb().approvals.values()).filter((a) => a.status === "pending");
}

export function getCompletedApprovals(): Approval[] {
  return Array.from(getDb().approvals.values())
    .filter((a) => a.status !== "pending")
    .sort((a, b) => (b.decided_at || "").localeCompare(a.decided_at || ""))
    .slice(0, 10);
}

export function getApproval(id: string): Approval | undefined {
  return getDb().approvals.get(id);
}

export function updateApproval(id: string, updates: Partial<Approval>): void {
  const db = getDb();
  const ap = db.approvals.get(id);
  if (ap) {
    db.approvals.set(id, { ...ap, ...updates });
  }
}

export function createApproval(params: {
  type: string;
  title: string;
  reason: string;
  impact: string;
  savings_monthly?: number;
  expires_hours?: number;
}): string {
  const id = randomUUID();
  const expires = new Date(Date.now() + (params.expires_hours ?? 24) * 3600000).toISOString();
  getDb().approvals.set(id, {
    id, type: params.type, title: params.title, reason: params.reason, impact: params.impact,
    savings_monthly: params.savings_monthly ?? 0, status: "pending", expires_at: expires,
    decided_at: null, decided_by: null,
  });
  return id;
}

export function getAllAudit(): AuditEntry[] {
  return getDb().audit_log;
}

export function getFeed(): FeedItem[] {
  return getDb().agent_feed;
}

export function logAudit(params: {
  action: string;
  amount?: number | null;
  stripe_ref?: string | null;
  status?: string;
  category: string;
}): void {
  getDb().audit_log.unshift({
    id: randomUUID(),
    action: params.action,
    amount: params.amount ?? null,
    stripe_ref: params.stripe_ref ?? null,
    status: params.status ?? "completed",
    category: params.category,
    created_at: new Date().toISOString(),
  });
}

export function logFeed(params: {
  icon: string;
  description: string;
  status: string;
  kind: "emerald" | "amber" | "red";
}): void {
  getDb().agent_feed.unshift({
    id: randomUUID(),
    icon: params.icon,
    description: params.description,
    status: params.status,
    kind: params.kind,
    created_at: new Date().toISOString(),
  });
}
