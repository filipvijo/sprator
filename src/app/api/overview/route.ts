import { NextResponse } from "next/server";
import { analyzeSpend } from "@/lib/analysis";
import { getPendingApprovals, getFeed, logAudit, type Approval } from "@/lib/audit";

export const runtime = "nodejs";

export async function GET() {
  const analysis = analyzeSpend();
  const pending = getPendingApprovals();
  const feed = getFeed();

  const approvedSavings = [...getCompletedApprovalsInternal()].reduce((sum, a) => {
    return sum + (a.savings_monthly || 0);
  }, 0);

  return NextResponse.json({
    monthlyBurn: analysis.totalMonthly,
    activeSubs: analysis.activeCount,
    wasteCount: analysis.wasteCount,
    unusedCount: analysis.unusedCount,
    potentialSavings: analysis.potentialSavings,
    savingsFound: Math.round(approvedSavings * 12),
    revenueRecovered: 4218, // from seed data
    pendingApprovals: pending.length,
    anomalies: analysis.anomalies,
    feed,
  });
}

// Import here to avoid circular dependency in the export
import { getCompletedApprovals } from "@/lib/audit";
function getCompletedApprovalsInternal(): Approval[] {
  return getCompletedApprovals();
}
