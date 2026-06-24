import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const db = getDb();
  const failed = db.prepare("SELECT * FROM failed_payments ORDER BY created_at DESC").all();
  return NextResponse.json({ failedPayments: failed });
}
