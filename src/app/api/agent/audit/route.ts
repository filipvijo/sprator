import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { flagUnusedSubscriptions, detectDuplicates } from "@/lib/analysis";
import { createApproval } from "@/lib/audit";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/agent/audit — run the agent's audit workflow.
 * This is the "audit this month" command endpoint.
 */
export async function POST() {
  const db = getDb();

  // Run analysis
  const unused = flagUnusedSubscriptions();
  const duplicates = detectDuplicates();

  // Find subscriptions that should have approvals created
  const flaggedSubs = db.prepare(`
    SELECT * FROM subscriptions WHERE status IN ('unused', 'waste') AND id NOT IN (
      SELECT title FROM approvals WHERE status='pending'
    )
  `).all() as any[];

  const approvalsCreated: string[] = [];
  for (const sub of flaggedSubs) {
    const yearlySavings = Math.round(sub.monthly_cost * 12);
    const id = createApproval({
      type: "cancel_subscription",
      title: `Cancel ${sub.name}`,
      reason: sub.agent_flag || "Unused subscription detected",
      impact: `$${yearlySavings} / yr saved`,
      savings_monthly: sub.monthly_cost,
      expires_hours: 24,
    });
    approvalsCreated.push(id);
  }

  // Check for anomalies (high spend)
  const highSpend = db.prepare("SELECT * FROM subscriptions WHERE monthly_cost > 500 AND status='active'").all() as any[];
  for (const sub of highSpend) {
    createApproval({
      type: "investigate_anomaly",
      title: `Investigate ${sub.name} anomaly`,
      reason: `High monthly spend: $${sub.monthly_cost.toFixed(2)}/mo. Above $500 threshold.`,
      impact: `Up to $${Math.round(sub.monthly_cost)}/mo at risk`,
      expires_hours: 48,
    });
  }

  return NextResponse.json({
    unused,
    duplicates,
    approvalsCreated: approvalsCreated.length,
    anomalies: highSpend.length,
    summary: `Found ${unused} unused subscriptions, ${duplicates} duplicates, and ${highSpend.length} high-spend anomalies. ${approvalsCreated.length} approvals pending.`,
  });
}
