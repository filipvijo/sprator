import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { analyzeSpend } from "@/lib/analysis";

export const runtime = "nodejs";

export async function GET() {
  const db = getDb();
  const analysis = analyzeSpend();

  const pendingApprovals = db.prepare("SELECT COUNT(*) as count FROM approvals WHERE status='pending'").get() as { count: number };

  const savingsResult = db.prepare("SELECT COALESCE(SUM(savings_monthly), 0) as monthly FROM approvals WHERE status='approve'").get() as { monthly: number };
  const savingsYearly = Math.round(savingsResult.monthly * 12);

  const recoveredResult = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM failed_payments WHERE status='recovered'").get() as { total: number };

  const feed = db.prepare("SELECT * FROM agent_feed ORDER BY created_at DESC LIMIT 8").all();

  return NextResponse.json({
    monthlyBurn: analysis.totalMonthly,
    activeSubs: analysis.activeCount,
    wasteCount: analysis.wasteCount,
    unusedCount: analysis.unusedCount,
    potentialSavings: analysis.potentialSavings,
    savingsFound: savingsYearly,
    revenueRecovered: recoveredResult.total,
    pendingApprovals: pendingApprovals.count,
    anomalies: analysis.anomalies,
    feed,
  });
}
