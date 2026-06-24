import { getDb } from "./db";
import { randomUUID } from "crypto";

export function logAudit(params: {
  action: string;
  amount?: number;
  stripe_ref?: string;
  status?: string;
  category: string;
}): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO audit_log (id, action, amount, stripe_ref, status, category)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    randomUUID(),
    params.action,
    params.amount ?? null,
    params.stripe_ref ?? null,
    params.status ?? "completed",
    params.category
  );
}

export function logFeed(params: {
  icon: string;
  description: string;
  status: string;
  kind: "emerald" | "amber" | "red";
}): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO agent_feed (id, icon, description, status, kind)
    VALUES (?, ?, ?, ?, ?)
  `).run(randomUUID(), params.icon, params.description, params.status, params.kind);
}

export function createApproval(params: {
  type: string;
  title: string;
  reason: string;
  impact: string;
  savings_monthly?: number;
  expires_hours?: number;
}): string {
  const db = getDb();
  const id = randomUUID();
  const expires = new Date(Date.now() + (params.expires_hours ?? 24) * 3600000).toISOString();
  db.prepare(`
    INSERT INTO approvals (id, type, title, reason, impact, savings_monthly, status, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
  `).run(id, params.type, params.title, params.reason, params.impact, params.savings_monthly ?? 0, expires);
  return id;
}

export function decideApproval(id: string, decision: "approve" | "reject", decidedBy?: string): void {
  const db = getDb();
  db.prepare(`
    UPDATE approvals SET status=?, decided_at=datetime('now'), decided_by=? WHERE id=?
  `).run(decision, decidedBy ?? "telegram", id);
}
