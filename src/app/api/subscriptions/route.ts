import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const db = getDb();
  const subs = db.prepare("SELECT * FROM subscriptions ORDER BY monthly_cost DESC").all();
  return NextResponse.json({ subscriptions: subs });
}
