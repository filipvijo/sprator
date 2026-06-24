import { NextResponse } from "next/server";
import { analyzeSpend } from "@/lib/analysis";
import { getPendingApprovals } from "@/lib/audit";
import { computeImpact } from "@/lib/impact";

export const runtime = "nodejs";

/**
 * Proactive "pulse" — what's worth pinging the user about *right now*, without
 * being asked. A Hermes cron polls this on a schedule; if `shouldAlert` is true
 * it pushes `message` to Telegram unprompted. This is the inbound-autonomy loop.
 */
export async function GET() {
  const analysis = analyzeSpend();
  const pending = getPendingApprovals();
  const impact = computeImpact();

  const alerts: string[] = [];

  // 1. Spend anomalies.
  for (const a of analysis.anomalies) {
    alerts.push(`⚠️ ${a.name}: ${a.detail}`);
  }

  // 2. Approvals about to expire (lose the savings window).
  const now = Date.now();
  for (const ap of pending) {
    if (!ap.expires_at) continue;
    const hoursLeft = (new Date(ap.expires_at).getTime() - now) / 3.6e6;
    if (hoursLeft > 0 && hoursLeft < 12) {
      alerts.push(`⏳ "${ap.title}" expires in ${Math.round(hoursLeft)}h — ${ap.impact}`);
    }
  }

  // 3. Fresh waste/unused the agent wants a decision on.
  if (analysis.wasteCount + analysis.unusedCount > 0) {
    alerts.push(`💸 ${analysis.wasteCount + analysis.unusedCount} subscription(s) flagged as waste/unused — $${analysis.potentialSavings.toFixed(0)}/mo recoverable.`);
  }

  const shouldAlert = alerts.length > 0;

  const message = shouldAlert
    ? [
        "🔔 Sprator — heads up",
        "",
        ...alerts,
        "",
        `Net impact so far: $${impact.netImpactAnnual.toLocaleString("en-US")}/yr.`,
        pending.length > 0 ? `Reply "audit this month" to review ${pending.length} pending action(s).` : "",
      ].filter(Boolean).join("\n")
    : "✅ All clear — no anomalies, nothing expiring, no new waste.";

  return NextResponse.json({
    shouldAlert,
    alertCount: alerts.length,
    pendingApprovals: pending.length,
    netImpactAnnual: impact.netImpactAnnual,
    message,
  });
}
