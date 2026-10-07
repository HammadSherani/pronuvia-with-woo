import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { Role } from "@/generated/prisma/enums";

export const dynamic = "force-dynamic";

// Public callers (uptime monitors) only learn up/down; env and DB details are
// for admins, since they reveal configuration.
export async function GET() {
  const session = await getSession();
  const isAdmin = session?.role === Role.ADMIN;

  const result: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    database: "pending",
  };

  if (isAdmin) {
    result.node_env = process.env.NODE_ENV;
    result.env_vars = {
      DATABASE_URL:                       process.env.DATABASE_URL        ? "✅ SET" : "❌ MISSING",
      SESSION_SECRET:                     process.env.SESSION_SECRET      ? "✅ SET" : "❌ MISSING",
      ADMIN_SETUP_TOKEN:                  process.env.ADMIN_SETUP_TOKEN   ? "✅ SET" : "❌ MISSING",
      STRIPE_SECRET_KEY:                  process.env.STRIPE_SECRET_KEY   ? "✅ SET" : "❌ MISSING",
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ? "✅ SET" : "❌ MISSING",
      WOO_URL:                            process.env.WOO_URL             ? "✅ SET" : "❌ MISSING",
      WOO_CONSUMER_KEY:                   process.env.WOO_CONSUMER_KEY    ? "✅ SET" : "❌ MISSING",
      WOO_CONSUMER_SECRET:                process.env.WOO_CONSUMER_SECRET ? "✅ SET" : "❌ MISSING",
    };
  }

  try {
    const adminCount = await prisma.admin.count();
    result.database = "✅ CONNECTED";
    if (isAdmin) result.admin_count = adminCount;
  } catch (err) {
    result.database = "❌ FAILED";
    if (isAdmin) {
      result.database_error = err instanceof Error ? err.message : String(err);
      result.database_error_type = err instanceof Error ? err.constructor.name : typeof err;
    }
  }

  return NextResponse.json(result, {
    status: result.database === "✅ CONNECTED" ? 200 : 500,
    headers: { "Cache-Control": "no-store" },
  });
}
