import { NextResponse } from "next/server";
import { getAllSubscriptions } from "@/lib/audit";

export const runtime = "nodejs";

export async function GET() {
  const subs = getAllSubscriptions();
  return NextResponse.json({ subscriptions: subs });
}
