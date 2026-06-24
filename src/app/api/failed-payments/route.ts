import { NextResponse } from "next/server";
import { getAllFailedPayments } from "@/lib/audit";

export const runtime = "nodejs";

export async function GET() {
  const failed = getAllFailedPayments();
  return NextResponse.json({ failedPayments: failed });
}
