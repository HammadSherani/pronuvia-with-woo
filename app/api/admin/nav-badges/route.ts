import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/dal";
import { Role } from "@/generated/prisma/enums";
import { getAdminNavBadges } from "@/lib/admin/nav-badges";

export const dynamic = "force-dynamic";

// The admin header's red dots (polled by components/dashboard/admin-badges.tsx)
export async function GET() {
  const session = await getCurrentSession();
  if (!session || session.role !== Role.ADMIN) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await getAdminNavBadges(session.userId), { headers: { "Cache-Control": "no-store" } });
}
