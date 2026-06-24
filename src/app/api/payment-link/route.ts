import { NextRequest, NextResponse } from "next/server";
import { createPaymentLink } from "@/lib/stripe";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const { amount, customerName, description } = await req.json();

  if (!amount || !customerName) {
    return NextResponse.json({ error: "Missing amount or customerName" }, { status: 400 });
  }

  try {
    const link = await createPaymentLink(amount, customerName, description || `Payment for ${customerName}`);

    logAudit({
      action: `Payment link created — ${customerName}`,
      amount,
      stripe_ref: link.id,
      status: "completed",
      category: "Recoveries",
    });

    return NextResponse.json({ url: link.url, id: link.id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
