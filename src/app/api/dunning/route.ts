import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { logAudit, logFeed } from "@/lib/audit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { paymentId, customerName, amount } = await req.json();

  if (!paymentId) {
    return NextResponse.json({ error: "Missing paymentId" }, { status: 400 });
  }

  const db = getDb();

  // Update failed payment status to "email_sent"
  db.prepare(`
    UPDATE failed_payments SET status='email_sent', agent_action='Dunning email sent', updated_at=datetime('now') WHERE id=?
  `).run(paymentId);

  logAudit({
    action: `Dunning email sent — ${customerName}`,
    amount: null,
    stripe_ref: "—",
    status: "completed",
    category: "Dunning",
  });

  logFeed({
    icon: "✓",
    description: `Dunning email sent — ${customerName} ($${amount.toFixed(2)}). Retry scheduled.`,
    status: "Completed",
    kind: "emerald",
  });

  return NextResponse.json({ success: true });
}
