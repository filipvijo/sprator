import { NextRequest, NextResponse } from "next/server";
import { logAudit, logFeed } from "@/lib/audit";
import { getGuardrails } from "@/lib/impact";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Autonomous spend (Stripe Skills for Hermes showcase): the agent provisions /
 * pays for a service it decided it needs. We create a REAL Stripe (test-mode)
 * payment link as the verifiable artifact, and enforce the monthly spend cap
 * guardrail before committing. No real money — sandbox only.
 */
export async function POST(req: NextRequest) {
  const { service, monthlyCost, reason } = await req.json();

  if (!service || typeof monthlyCost !== "number") {
    return NextResponse.json({ error: "Missing service or monthlyCost" }, { status: 400 });
  }

  const { monthlySpendCap } = getGuardrails();
  if (monthlyCost > monthlySpendCap) {
    return NextResponse.json({
      blocked: true,
      reason: `Guardrail stop: $${monthlyCost}/mo exceeds the $${monthlySpendCap}/mo spend cap. Needs human approval.`,
    }, { status: 200 });
  }

  let url: string | null = null;
  let stripeRef = "agent_provision";

  try {
    if (process.env.STRIPE_SECRET_KEY) {
      const { createPaymentLink } = await import("@/lib/stripe");
      const link = await createPaymentLink(
        monthlyCost,
        "Sprator Agent",
        `Agent-provisioned: ${service}`,
      );
      url = link.url;
      stripeRef = link.id;
    }
  } catch (err: any) {
    console.log("Stripe provision skipped:", err.message);
  }

  logAudit({
    action: `Service provisioned — ${service} ($${monthlyCost.toFixed(2)}/mo)`,
    amount: -monthlyCost,
    stripe_ref: stripeRef,
    status: "completed",
    category: "Provisioning",
  });

  logFeed({
    icon: "🤖",
    description: `Agent provisioned ${service} ($${monthlyCost.toFixed(2)}/mo) — ${reason || "needed for operations"}. Within $${monthlySpendCap}/mo cap.`,
    status: "Auto-approved",
    kind: "emerald",
  });

  return NextResponse.json({
    success: true,
    service,
    monthlyCost,
    withinCap: true,
    monthlySpendCap,
    paymentLink: url,
    stripeRef,
    summary: url
      ? `Provisioned ${service} at $${monthlyCost}/mo. Stripe link: ${url}`
      : `Provisioned ${service} at $${monthlyCost}/mo (demo mode — no Stripe key).`,
  });
}
