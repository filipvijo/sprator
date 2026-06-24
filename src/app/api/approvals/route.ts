import { NextRequest, NextResponse } from "next/server";
import { getPendingApprovals, getCompletedApprovals, getApproval, updateApproval, logAudit, logFeed } from "@/lib/audit";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    pending: getPendingApprovals(),
    completed: getCompletedApprovals(),
  });
}

export async function POST(req: NextRequest) {
  const { approvalId, decision } = await req.json();

  if (!approvalId || !decision) {
    return NextResponse.json({ error: "Missing approvalId or decision" }, { status: 400 });
  }

  const approval = getApproval(approvalId);
  if (!approval) {
    return NextResponse.json({ error: "Approval not found" }, { status: 404 });
  }

  updateApproval(approvalId, {
    status: decision,
    decided_at: new Date().toISOString(),
    decided_by: "telegram",
  });

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
