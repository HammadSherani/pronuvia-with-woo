import "server-only";
import { prisma } from "@/lib/db/prisma";

// Red dots on the admin's tabs when something new needs a look:
//   orders     — an order came in since the admin last opened Orders
//   approvals  — a doctor is waiting for approval (until none is)
//   payouts    — a payout request is new / changed since Commission Payout was last opened
//   emailLogs  — an email failed since Email Logs was last opened
// When each tab was last opened is kept on the admin (Admin.navSeen).

export type NavBadgeKey = "orders" | "approvals" | "payouts" | "emailLogs";
export type NavBadges = Record<NavBadgeKey, boolean>;
type Seen = Partial<Record<NavBadgeKey, string>>;

const EPOCH = new Date(0);
const seenAt = (seen: Seen, key: NavBadgeKey) => {
  const v = seen[key];
  return v && !Number.isNaN(Date.parse(v)) ? new Date(v) : EPOCH;
};

export async function getAdminNavBadges(adminId: string): Promise<NavBadges> {
  const admin = await prisma.admin.findUnique({ where: { id: adminId }, select: { navSeen: true } });
  const seen = (admin?.navSeen ?? {}) as Seen;
  const [order, approval, payout, failedEmail] = await Promise.all([
    prisma.order.findFirst({ where: { createdAt: { gt: seenAt(seen, "orders") } }, select: { id: true } }),
    prisma.partneringPhysician.findFirst({ where: { isApproved: "PENDING" }, select: { id: true } }),
    prisma.withdrawRequest.findFirst({ where: { status: "PENDING", updatedAt: { gt: seenAt(seen, "payouts") } }, select: { id: true } }),
    prisma.emailLog.findFirst({ where: { status: { in: ["FAILED", "BOUNCED"] }, createdAt: { gt: seenAt(seen, "emailLogs") } }, select: { id: true } }),
  ]);
  return { orders: !!order, approvals: !!approval, payouts: !!payout, emailLogs: !!failedEmail };
}

/** The admin opened this tab: its dot goes until something new comes. */
export async function markAdminNavSeen(adminId: string, key: Exclude<NavBadgeKey, "approvals">): Promise<void> {
  try {
    const admin = await prisma.admin.findUnique({ where: { id: adminId }, select: { navSeen: true } });
    const seen = { ...((admin?.navSeen ?? {}) as Seen), [key]: new Date().toISOString() };
    await prisma.admin.update({ where: { id: adminId }, data: { navSeen: seen } });
  } catch (e) {
    console.error("[nav-badges] could not mark seen:", e);
  }
}
