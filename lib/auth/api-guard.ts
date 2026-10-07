import "server-only";
import { NextResponse } from "next/server";
import { getSession } from "./session";
import { Role } from "@/generated/prisma/enums";

// For Route Handlers: proxy.ts lets every /api/* request through, so each
// route must check the session itself. Returns a 401 response to send back,
// or null when the caller is an admin.
export async function rejectUnlessAdmin(): Promise<NextResponse | null> {
  const session = await getSession();
  if (!session || session.role !== Role.ADMIN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
