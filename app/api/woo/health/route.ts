import { NextResponse } from "next/server";
import { rejectUnlessAdmin } from "@/lib/auth/api-guard";
import { checkWooHealth } from "@/lib/woo/health";

export async function GET() {
  const denied = await rejectUnlessAdmin();
  if (denied) return denied;

  const health = await checkWooHealth();
  return NextResponse.json(health, { status: health.ok ? 200 : 503 });
}
