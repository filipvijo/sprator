import { NextResponse } from "next/server";
import { computeImpact, getGuardrails } from "@/lib/impact";
import {
  getAllSubscriptions, updateSubscription,
  createApproval, logFeed, logAudit,
} from "@/lib/audit";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * "audit this month" — the agent reviews spend, then acts within its guardrails:
 *  - cancellations at/under the auto-approve threshold are executed autonomously
 *  - everything bigger or riskier (anomalies) is escalated for human approval
 * Returns a complete, self-contained summary so the result is reliable even when
 * Vercel serves the follow-up read from a fresh (cold-start) instance.
 */
export async function POST() {
  const { autoApproveUnder } = getGuardrails();

  // Work from the curated waste/unused flags (don't run the broad duplicate
  // sweep here — it over-classifies and muddies the review).
  const flagged = getAllSubscriptions().filter(
    (s) => (s.status === "unused" || s.status === "waste")
  );

  const autoHandled: { name: string; monthly: number; annual: number; reason: string }[] = [];
  const needsApproval: { name: string; monthly: number; annual: number; reason: string }[] = [];

  for (const sub of flagged) {
    const annual = Math.round(sub.monthly_cost * 12);
    const reason = sub.agent_flag || "Unused subscription detected";

    if (sub.monthly_cost <= autoApproveUnder) {
      // Within guardrail → the agent executes it itself.
      updateSubscription(sub.id, { status: "cancelled" });
      logAudit({
        action: `Subscription cancelled — ${sub.name} (auto, within $${autoApproveUnder}/mo guardrail)`,
        amount: -sub.monthly_cost,
        stripe_ref: "agent_auto",
        status: "completed",
        category: "Cancellations",
      });
      logFeed({
        icon: "🤖",
        description: `Auto-cancelled ${sub.name} ($${sub.monthly_cost.toFixed(2)}/mo) — within $${autoApproveUnder}/mo guardrail. $${annual}/yr saved.`,
        status: "Auto-approved",
        kind: "emerald",
      });
      autoHandled.push({ name: sub.name, monthly: sub.monthly_cost, annual, reason });
    } else {
      // Above guardrail → needs a human.
      createApproval({
        type: "cancel_subscription",
        title: `Cancel ${sub.name}`,
        reason,
        impact: `$${annual} / yr saved`,
        savings_monthly: sub.monthly_cost,
        expires_hours: 24,
      });
      needsApproval.push({ name: sub.name, monthly: sub.monthly_cost, annual, reason });
    }
  }

  // Anomalies always escalate — the agent never auto-acts on these.
  const anomalies = getAllSubscriptions().filter(
    (s) => s.monthly_cost > 500 && s.status === "active"
  );
  for (const sub of anomalies) {
    createApproval({
      type: "investigate_anomaly",
      title: `Investigate ${sub.name} anomaly`,
      reason: sub.agent_flag || `High monthly spend: $${sub.monthly_cost.toFixed(2)}/mo (above $500 threshold).`,
      impact: `Up to $${Math.round(sub.monthly_cost)}/mo at risk`,
      expires_hours: 48,
    });
    needsApproval.push({
      name: sub.name, monthly: sub.monthly_cost,
      annual: Math.round(sub.monthly_cost * 12),
      reason: `Anomaly — ${sub.agent_flag || "high spend"}`,
    });
  }

  const impact = computeImpact();

  logFeed({
    icon: "⚠",
    description: `Audit complete — ${autoHandled.length} auto-handled within guardrail, ${needsApproval.length} awaiting your approval.`,
    status: "Pending",
    kind: "amber",
  });

  return NextResponse.json({
    autoHandled,
    needsApproval,
    autoApproveUnder,
    netImpactAnnual: impact.netImpactAnnual,
    realizedAnnualSavings: impact.realizedAnnualSavings,
    recoveredThisMonth: impact.recoveredThisMonth,
    summary:
      `Audit complete. Auto-handled ${autoHandled.length} cancellation(s) within your $${autoApproveUnder}/mo guardrail; ` +
      `${needsApproval.length} item(s) need your approval. ` +
      `Net agent impact so far: $${impact.netImpactAnnual.toLocaleString("en-US")}/yr.`,
  });
}
