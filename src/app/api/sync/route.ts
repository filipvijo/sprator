import { NextRequest, NextResponse } from "next/server";
import { logFeed } from "@/lib/audit";
import { flagUnusedSubscriptions, detectDuplicates } from "@/lib/analysis";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const authKey = req.headers.get("x-cron-key");
  if (process.env.CRON_KEY && authKey !== process.env.CRON_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    let synced = 0;
    try {
      const { syncSubscriptions } = await import("@/lib/stripe");
      if (process.env.STRIPE_SECRET_KEY) {
        synced = await syncSubscriptions();
      }
    } catch (stripeErr: any) {
      console.log("Stripe sync skipped:", stripeErr.message);
    }

    const unused = flagUnusedSubscriptions();
    const duplicates = detectDuplicates();

    if (unused > 0 || duplicates > 0) {
      logFeed({
        icon: "⚠",
        description: `Audit complete: ${unused} unused subscriptions flagged, ${duplicates} duplicates detected.`,
        status: "Pending",
        kind: "amber",
      });
    }

    return NextResponse.json({ synced, unused, duplicates });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
