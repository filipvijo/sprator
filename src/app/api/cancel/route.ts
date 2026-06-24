import { NextRequest, NextResponse } from "next/server";
import { getSubscription, updateSubscription, logAudit, logFeed } from "@/lib/audit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { subId, subName, monthlyCost } = await req.json();

  if (!subId) {
    return NextResponse.json({ error: "Missing subId" }, { status: 400 });
  }

  const yearlySavings = Math.round((monthlyCost || 0) * 12);

  try {
    // Try Stripe cancellation if configured
    let stripeRef = "—";
    try {
      const { cancelSubscription } = await import("@/lib/stripe");
      const sub = getSubscription(subId);
      if (sub?.stripe_sub_id && process.env.STRIPE_SECRET_KEY) {
        const cancelled = await cancelSubscription(subId);
        stripeRef = cancelled.id;
      }
    } catch (stripeErr: any) {
      console.log("Stripe cancel skipped:", stripeErr.message);
    }

    // Update local store
    updateSubscription(subId, { status: "cancelled" });

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

    return NextResponse.json({ success: true, yearlySavings, stripeRef });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
