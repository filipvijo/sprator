import { NextResponse } from "next/server";
import { flagUnusedSubscriptions, detectDuplicates } from "@/lib/analysis";
import { createApproval, logFeed, getAllSubscriptions } from "@/lib/audit";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST() {
  const unused = flagUnusedSubscriptions();
  const duplicates = detectDuplicates();

  // Find subscriptions that should have approvals created
  const flaggedSubs = getAllSubscriptions().filter(
    (s) => s.status === "unused" || s.status === "waste"
  );

  let approvalsCreated = 0;
  for (const sub of flaggedSubs) {
    const yearlySavings = Math.round(sub.monthly_cost * 12);
    createApproval({
      type: "cancel_subscription",
      title: `Cancel ${sub.name}`,
      reason: sub.agent_flag || "Unused subscription detected",
      impact: `$${yearlySavings} / yr saved`,
      savings_monthly: sub.monthly_cost,
      expires_hours: 24,
    });
    approvalsCreated++;
  }

  // Check for anomalies
  const highSpend = getAllSubscriptions().filter(
    (s) => s.monthly_cost > 500 && s.status === "active"
  );

  for (const sub of highSpend) {
    createApproval({
      type: "investigate_anomaly",
      title: `Investigate ${sub.name} anomaly`,
      reason: `High monthly spend: $${sub.monthly_cost.toFixed(2)}/mo. Above $500 threshold.`,
      impact: `Up to $${Math.round(sub.monthly_cost)}/mo at risk`,
      expires_hours: 48,
    });
  }

  if (unused > 0 || duplicates > 0 || approvalsCreated > 0) {
    logFeed({
      icon: "⚠",
      description: `Audit complete: ${unused} unused, ${duplicates} duplicates, ${approvalsCreated} approvals pending.`,
      status: "Pending",
      kind: "amber",
    });
  }

  return NextResponse.json({
    unused,
    duplicates,
    approvalsCreated,
    anomalies: highSpend.length,
    summary: `Found ${unused} unused subscriptions, ${duplicates} duplicates, and ${highSpend.length} high-spend anomalies. ${approvalsCreated} approvals pending.`,
  });
}
