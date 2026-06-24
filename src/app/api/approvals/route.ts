import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { logAudit, logFeed, decideApproval } from "@/lib/audit";

export const runtime = "nodejs";

export async function GET() {
  const db = getDb();
  const pending = db.prepare("SELECT * FROM approvals WHERE status='pending' ORDER BY created_at DESC").all();
  const completed = db.prepare("SELECT * FROM approvals WHERE status != 'pending' ORDER BY decided_at DESC LIMIT 10").all();
  return NextResponse.json({ pending, completed });
}

export async function POST(req: NextRequest) {
  const { approvalId, decision } = await req.json();

  if (!approvalId || !decision) {
    return NextResponse.json({ error: "Missing approvalId or decision" }, { status: 400 });
  }

  const db = getDb();
  const approval = db.prepare("SELECT * FROM approvals WHERE id = ?").get(approvalId) as any;

  if (!approval) {
    return NextResponse.json({ error: "Approval not found" }, { status: 404 });
  }

  decideApproval(approvalId, decision);

  logAudit({
    action: `${approval.title} — ${decision === "approve" ? "approved" : "rejected"}`,
    amount: null,
    stripe_ref: "—",
    status: decision === "approve" ? "completed" : "rejected",
    category: "Cancellations",
  });

  logFeed({
    icon: decision === "approve" ? "✓" : "✕",
    description: `${approval.title} — ${decision === "approve" ? "approved" : "rejected"}`,
    status: decision === "approve" ? "Approved" : "Rejected",
    kind: decision === "approve" ? "emerald" : "red",
  });

  return NextResponse.json({ success: true });
}
