import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const db = getDb();
  const audit = db.prepare("SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 50").all();
  return NextResponse.json({ audit });
}
