import { NextRequest, NextResponse } from "next/server";
import { decryptEdge } from "@/lib/auth/session-edge";

// Plain string literals — NO Prisma imports allowed in Edge Runtime
const DASHBOARD_ROUTES: Record<string, string> = {
  ADMIN:      "/admin/dashboard",
  SALES_REP:  "/sales/shop",
  PHYSICIAN:  "/physician/shop",
};

const ADMIN_SETUP_ROUTE = "/admin-setup";

const ROLE_ROUTES: Record<string, string[]> = {
  ADMIN:     ["/admin"],
  SALES_REP: ["/sales"],
  PHYSICIAN: ["/physician"],
};

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Redirect already-authenticated users away from /login
  if (pathname.startsWith("/login")) {
    const cookie = request.cookies.get("pronuvia_session")?.value;
    const session = cookie ? await decryptEdge(cookie) : null;
    const dest = session?.role ? DASHBOARD_ROUTES[session.role] : null;
    if (dest) {
      return NextResponse.redirect(new URL(dest, request.url));
    }
    return NextResponse.next();
  }

  // Allow public routes without a session check
  if (
    pathname.startsWith("/unauthorized") ||
    pathname.startsWith("/logout") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/api/")
  ) {
    return NextResponse.next();
  }

  // Secret admin setup route — only accessible with correct token query param
  if (pathname.startsWith(ADMIN_SETUP_ROUTE)) {
    const token = request.nextUrl.searchParams.get("token");
    const expectedToken = process.env.ADMIN_SETUP_TOKEN;
    if (!expectedToken || token !== expectedToken) {
      return NextResponse.redirect(new URL("/unauthorized", request.url));
    }
    return NextResponse.next();
  }

  // Validate session
  const cookie = request.cookies.get("pronuvia_session")?.value;
  const session = cookie ? await decryptEdge(cookie) : null;

  // if (!session) {
  //   return NextResponse.redirect(new URL("/login", request.url));
  // }

  // Role-based route protection
  for (const [role, prefixes] of Object.entries(ROLE_ROUTES)) {
    if (prefixes.some((p) => pathname.startsWith(p))) {
      if (!session || session.role !== role) {
        return NextResponse.redirect(new URL("/unauthorized", request.url));
      }
    }
  }

  // Refresh session cookie on every request (sliding window) — only when logged in
  const response = NextResponse.next();

  if (session?.userId && session?.role) {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const { SignJWT } = await import("jose");
    const secret = new TextEncoder().encode(process.env.SESSION_SECRET ?? "");
    const refreshed = await new SignJWT({
      userId: session.userId,
      role:   session.role,
      email:  session.email,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(expiresAt)
      .sign(secret);

    response.cookies.set("pronuvia_session", refreshed, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === "production",
      sameSite: "lax",
      expires:  expiresAt,
      path:     "/",
    });
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$).*)",
  ],
};
