import { NextRequest, NextResponse } from "next/server";
import { rejectUnlessAdmin } from "@/lib/auth/api-guard";
import { syncAllWooCustomers } from "@/lib/woo/customers";

// POST /api/woo/sync-customers?dryRun=1  → report only, nothing written
// POST /api/woo/sync-customers           → link/create a Woo customer for every
//                                          sales rep and approved physician
export async function POST(req: NextRequest) {
  const denied = await rejectUnlessAdmin();
  if (denied) return denied;

  const dryRun = req.nextUrl.searchParams.get("dryRun") === "1";
  const report = await syncAllWooCustomers({ dryRun });
  return NextResponse.json(report, { status: report.totals.failed ? 207 : 200 });
}
