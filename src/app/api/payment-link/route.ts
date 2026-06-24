import { NextRequest, NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const { amount, customerName, description } = await req.json();

  if (!amount || !customerName) {
    return NextResponse.json({ error: "Missing amount or customerName" }, { status: 400 });
  }

  try {
    let url: string;
    let id: string;

    if (process.env.STRIPE_SECRET_KEY) {
      const { createPaymentLink } = await import("@/lib/stripe");
      const link = await createPaymentLink(amount, customerName, description || `Payment for ${customerName}`);
      url = link.url;
      id = link.id;
    } else {
      // Demo mode — generate a fake but realistic-looking URL
      id = "plink_" + Math.random().toString(36).substring(2, 15);
      url = `https://buy.stripe.com/test_${btoa(customerName).slice(0, 20).toLowerCase()}`;
    }

    logAudit({
      action: `Payment link created — ${customerName}`,
      amount,
      stripe_ref: id,
      status: "completed",
      category: "Recoveries",
    });

    return NextResponse.json({ url, id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
