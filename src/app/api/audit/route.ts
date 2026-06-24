import { NextResponse } from "next/server";
import { getAllAudit } from "@/lib/audit";

export const runtime = "nodejs";

export async function GET() {
  const audit = getAllAudit();
  return NextResponse.json({ audit });
}
