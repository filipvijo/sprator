import { NextResponse } from "next/server";
import { analyzeSpend } from "@/lib/analysis";
import { getPendingApprovals, getFeed } from "@/lib/audit";
import { computeImpact, getGuardrails } from "@/lib/impact";

export const runtime = "nodejs";

export async function GET() {
  const analysis = analyzeSpend();
  const pending = getPendingApprovals();
  const feed = getFeed();
  const impact = computeImpact();
  const guardrails = getGuardrails();

  return NextResponse.json({
    monthlyBurn: analysis.totalMonthly,
    activeSubs: analysis.activeCount,
    wasteCount: analysis.wasteCount,
    unusedCount: analysis.unusedCount,
    potentialSavings: analysis.potentialSavings,
    savingsFound: impact.realizedAnnualSavings,
    revenueRecovered: impact.recoveredThisMonth,
    // ── Net agent P&L (earn + save) ──
    netImpactAnnual: impact.netImpactAnnual,
    realizedMonthlySavings: impact.realizedMonthlySavings,
    // ── Guardrails (the safety story) ──
    guardrails,
    pendingApprovals: pending.length,
    anomalies: analysis.anomalies,
    feed,
  });
}
