import "server-only";
import { prisma } from "@/lib/db/prisma";

// Red counts on the admin's tabs: how many new things came in since the admin
// last opened that tab (opening it clears it):
//   orders     — orders placed
//   approvals  — doctors waiting for approval who applied
//   payouts    — payout requests new / changed (commission came in)
//   emailLogs  — emails that failed
// When each tab was last opened is kept on the admin (Admin.navSeen).

export type NavBadgeKey = "orders" | "approvals" | "payouts" | "emailLogs";
export type NavBadges = Record<NavBadgeKey, number>;
type Seen = Partial<Record<NavBadgeKey, string>>;

const EPOCH = new Date(0);
const seenAt = (seen: Seen, key: NavBadgeKey) => {
  const v = seen[key];
  return v && !Number.isNaN(Date.parse(v)) ? new Date(v) : EPOCH;
};

export async function getAdminNavBadges(adminId: string): Promise<NavBadges> {
  const admin = await prisma.admin.findUnique({ where: { id: adminId }, select: { navSeen: true } });
  const seen = (admin?.navSeen ?? {}) as Seen;
  const [orders, approvals, payouts, emailLogs] = await Promise.all([
    prisma.order.count({ where: { createdAt: { gt: seenAt(seen, "orders") } } }),
    prisma.partneringPhysician.count({ where: { isApproved: "PENDING", createdAt: { gt: seenAt(seen, "approvals") } } }),
    prisma.withdrawRequest.count({ where: { status: "PENDING", updatedAt: { gt: seenAt(seen, "payouts") } } }),
    prisma.emailLog.count({ where: { status: { in: ["FAILED", "BOUNCED"] }, createdAt: { gt: seenAt(seen, "emailLogs") } } }),
  ]);
  return { orders, approvals, payouts, emailLogs };
}

/** The admin opened this tab: its count goes until something new comes. */
export async function markAdminNavSeen(adminId: string, key: NavBadgeKey): Promise<void> {
  try {
    const admin = await prisma.admin.findUnique({ where: { id: adminId }, select: { navSeen: true } });
    const seen = { ...((admin?.navSeen ?? {}) as Seen), [key]: new Date().toISOString() };
    await prisma.admin.update({ where: { id: adminId }, data: { navSeen: seen } });
  } catch (e) {
    console.error("[nav-badges] could not mark seen:", e);
  }
}
