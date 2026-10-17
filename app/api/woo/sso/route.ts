import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { SignJWT } from "jose";
import { getCurrentSession } from "@/lib/auth/dal";
import { Role } from "@/generated/prisma/enums";
import { isWpAdminPath } from "@/lib/woo/admin-links";

export const dynamic = "force-dynamic";

// GET /api/woo/sso?to=/wp-admin/... → signs the admin into WP admin.
// Hands WordPress a token that works once, for 60 seconds; the Pronuvia SSO
// plugin (wordpress/pronuvia-sso) checks it with the same secret, logs in the
// WP user with the admin's email and opens `to`.
export async function GET(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.redirect(new URL("/login", req.url));
  if (session.role !== Role.ADMIN) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const to = req.nextUrl.searchParams.get("to") ?? "/wp-admin/";
  if (!isWpAdminPath(to)) return NextResponse.json({ error: "Invalid destination." }, { status: 400 });

  const base   = (process.env.WOO_URL ?? "").replace(/\/$/, "");
  const secret = process.env.WOO_SSO_SECRET;
  // Not set up: open WP admin normally (it asks for the password)
  if (!base) return NextResponse.json({ error: "WOO_URL is not set." }, { status: 500 });
  if (!secret) return NextResponse.redirect(base + to);

  const token = await new SignJWT({ email: session.email, to })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime("60s")
    .setJti(randomUUID())
    .setAudience("pronuvia-wp-sso")
    .sign(new TextEncoder().encode(secret));

  return NextResponse.redirect(`${base}/?pronuvia_sso=${encodeURIComponent(token)}`);
}
