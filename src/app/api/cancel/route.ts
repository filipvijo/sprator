import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { cancelSubscription } from "@/lib/stripe";
import { logAudit, logFeed } from "@/lib/audit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { subId, subName, monthlyCost } = await req.json();

  if (!subId) {
    return NextResponse.json({ error: "Missing subId" }, { status: 400 });
  }

  const yearlySavings = Math.round((monthlyCost || 0) * 12);

  try {
    // Try Stripe cancellation if a Stripe sub ID exists
    const db = getDb();
    const row = db.prepare("SELECT stripe_sub_id FROM subscriptions WHERE id = ?").get(subId) as
      | { stripe_sub_id: string | null }
      | undefined;

    let stripeRef = "—";

    if (row?.stripe_sub_id) {
      try {
        const cancelled = await cancelSubscription(subId);
        stripeRef = cancelled.id;
      } catch (stripeErr: any) {
        // In demo mode without real Stripe keys, continue with local-only cancellation
        console.log("Stripe cancel skipped:", stripeErr.message);
      }
    }

    // Update local DB regardless
    db.prepare("UPDATE subscriptions SET status='cancelled', updated_at=datetime('now') WHERE id=?").run(subId);

    logAudit({
      action: `Subscription cancelled — ${subName}`,
      amount: -monthlyCost,
      stripe_ref: stripeRef,
      status: "completed",
      category: "Cancellations",
    });

    logFeed({
      icon: "✓",
      description: `Cancelled subscription — ${subName} ($${monthlyCost.toFixed(2)}/mo). $${yearlySavings}/yr saved.`,
      status: "Approved",
      kind: "emerald",
    });

    return NextResponse.json({
      success: true,
      yearlySavings,
      stripeRef,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
