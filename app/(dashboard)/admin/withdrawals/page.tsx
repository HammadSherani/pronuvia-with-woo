import { requireAdmin }     from "@/lib/auth/dal";
import { prisma }           from "@/lib/db/prisma";
import { PageHeader }       from "@/components/admin/page-header";
import { CommissionPayoutClient } from "@/components/admin/commission-payout-client";
import { getCurrentPeriod } from "@/lib/withdrawals/monthly";

export const metadata = { title: "Commission Payout – Pronuvia Admin" };

export default async function CommissionPayoutPage() {
  await requireAdmin();

  // ── Current (still-open) commission period bounds ──────────────────────────
  // Same PAYOUT_TIMEZONE-aware boundary the monthly sweep/cron use, so this
  // preview always matches exactly what will be swept once the period closes.
  const currentPeriod = getCurrentPeriod(new Date(), process.env.PAYOUT_TIMEZONE ?? "UTC");
  const monthStart    = currentPeriod.start;
  const monthEnd      = currentPeriod.end;
  const monthLabel    = currentPeriod.label;

  // ── Fetch everything in parallel ──────────────────────────────────────────
  const [
    pendingWithdrawals,
    rejectedWithdrawals,
    currentMonthRepOrders,
    currentMonthDocOrders,
    currentMonthRefunds,
  ] = await Promise.all([
    // PENDING payout requests (previous months)
    prisma.withdrawRequest.findMany({
      where:   { status: "PENDING" },
      orderBy: { createdAt: "desc" },
      select:  { id: true, userId: true, userRole: true, amount: true, note: true, createdAt: true },
    }),
    // REJECTED payout requests
    prisma.withdrawRequest.findMany({
      where:   { status: "REJECTED" },
      orderBy: { createdAt: "desc" },
      select:  { id: true, userId: true, userRole: true, amount: true, note: true, adminNote: true, createdAt: true },
    }),
    // Current month orders for sales reps with commission not yet credited to their wallet
    prisma.order.findMany({
      where: {
        createdAt:               { gte: monthStart, lt: monthEnd },
        salesRepId:              { not: null },
        salesRepCommissionAmount: { gt: 0 },
        status:                  { not: "CANCELLED" },
        commissionPaid:          false,
      },
      select: {
        id: true,
        salesRepId: true, orderNumber: true, createdAt: true, status: true, returnedAt: true, returnReason: true,
        salesRepCommissionAmount: true, salesRepClawback: true, salesRepCommissionRate: true,
      },
    }),
    // Current month orders for physicians with commission not yet credited to their wallet
    prisma.order.findMany({
      where: {
        createdAt:                 { gte: monthStart, lt: monthEnd },
        physicianId:               { not: null },
        physicianCommissionAmount: { gt: 0 },
        status:                    { not: "CANCELLED" },
        commissionPaid:            false,
      },
      select: {
        id: true,
        physicianId: true, orderNumber: true, createdAt: true, status: true, returnedAt: true, returnReason: true,
        physicianCommissionAmount: true, physicianClawback: true, physicianCommissionRate: true,
      },
      }),
    // Refunds processed this month, including refunds for older orders.
    prisma.orderRefund.findMany({
      where: {
        processedAt: { gte: monthStart, lt: monthEnd },
        OR: [
          { salesRepClawback: { gt: 0 } },
          { physicianClawback: { gt: 0 } },
        ],
      },
      select: {
        orderId: true, processedAt: true, reason: true,
        salesRepClawback: true, physicianClawback: true,
      },
    }),
  ]);

  const refundTotals = new Map<string, {
    salesRep: number;
    physician: number;
    processedAt: Date;
    reason: string | null;
  }>();
  for (const refund of currentMonthRefunds) {
    const existing = refundTotals.get(refund.orderId);
    if (existing) {
      existing.salesRep = parseFloat((existing.salesRep + refund.salesRepClawback).toFixed(2));
      existing.physician = parseFloat((existing.physician + refund.physicianClawback).toFixed(2));
      if (refund.processedAt > existing.processedAt) {
        existing.processedAt = refund.processedAt;
        existing.reason = refund.reason;
      }
    } else {
      refundTotals.set(refund.orderId, {
        salesRep: refund.salesRepClawback,
        physician: refund.physicianClawback,
        processedAt: refund.processedAt,
        reason: refund.reason,
      });
    }
  }

  const refundedOrderIds = [...refundTotals.keys()];
  const refundedOrders = refundedOrderIds.length
    ? await prisma.order.findMany({
        where: { id: { in: refundedOrderIds } },
        select: {
          id: true, orderNumber: true, createdAt: true, status: true, returnedAt: true, returnReason: true,
          salesRepId: true, salesRepCommissionAmount: true, salesRepClawback: true, salesRepCommissionRate: true,
          physicianId: true, physicianCommissionAmount: true, physicianClawback: true, physicianCommissionRate: true,
        },
      })
    : [];

  // ── Collect all user IDs ──────────────────────────────────────────────────
  const withdrawRepIds = [...new Set([
    ...pendingWithdrawals.filter((r) => r.userRole === "SALES_REP").map((r) => r.userId),
    ...rejectedWithdrawals.filter((r) => r.userRole === "SALES_REP").map((r) => r.userId),
  ])];
  const withdrawDocIds = [...new Set([
    ...pendingWithdrawals.filter((r) => r.userRole === "PHYSICIAN").map((r) => r.userId),
    ...rejectedWithdrawals.filter((r) => r.userRole === "PHYSICIAN").map((r) => r.userId),
  ])];

  const currentRepIds = [...new Set(currentMonthRepOrders.map((o) => o.salesRepId!))];
  const currentDocIds = [...new Set(currentMonthDocOrders.map((o) => o.physicianId!))];
  const refundedRepIds = [...new Set(refundedOrders.filter((o) => o.salesRepId && o.salesRepCommissionAmount > 0).map((o) => o.salesRepId!))];
  const refundedDocIds = [...new Set(refundedOrders.filter((o) => o.physicianId && o.physicianCommissionAmount > 0).map((o) => o.physicianId!))];

  const allRepIds = [...new Set([...withdrawRepIds, ...currentRepIds, ...refundedRepIds])];
  const allDocIds = [...new Set([...withdrawDocIds, ...currentDocIds, ...refundedDocIds])];

  // ── Fetch user info + commission-paid orders for payout modals ─────────────
  const [reps, physicians, repCommOrders, docCommOrders] = await Promise.all([
    allRepIds.length
      ? prisma.salesRepresentative.findMany({
          where:  { id: { in: allRepIds } },
          select: { id: true, firstName: true, lastName: true, email: true, bankName: true, bankAccountNumber: true, bankAccountName: true },
        })
      : [],
    allDocIds.length
      ? prisma.partneringPhysician.findMany({
          where:  { id: { in: allDocIds } },
          select: { id: true, firstName: true, lastName: true, email: true, bankName: true, bankAccountNumber: true, bankAccountName: true },
        })
      : [],
    // Commission-paid orders for payout modal (Show Orders)
    withdrawRepIds.length
      ? prisma.order.findMany({
          where:   { salesRepId: { in: withdrawRepIds }, commissionPaid: true },
          select:  { salesRepId: true, orderNumber: true, createdAt: true, salesRepCommissionAmount: true, salesRepCommissionRate: true },
          orderBy: { createdAt: "desc" },
        })
      : [],
    withdrawDocIds.length
      ? prisma.order.findMany({
          where:   { physicianId: { in: withdrawDocIds }, commissionPaid: true },
          select:  { physicianId: true, orderNumber: true, createdAt: true, physicianCommissionAmount: true, physicianCommissionRate: true },
          orderBy: { createdAt: "desc" },
        })
      : [],
  ]);

  const repMap = new Map(reps.map((r) => [r.id, r]));
  const docMap = new Map(physicians.map((p) => [p.id, p]));

  // ── Build commission-paid order maps for payout modal ────────────────────
  type OrderRow = { orderNumber: string; createdAt: string; amount: number; rate: number };
  const repOrderMap = new Map<string, OrderRow[]>();
  const docOrderMap = new Map<string, OrderRow[]>();

  for (const o of repCommOrders) {
    const id = o.salesRepId!;
    const arr = repOrderMap.get(id) ?? [];
    arr.push({ orderNumber: o.orderNumber, createdAt: o.createdAt.toISOString(), amount: o.salesRepCommissionAmount ?? 0, rate: o.salesRepCommissionRate ?? 0 });
    repOrderMap.set(id, arr);
  }
  for (const o of docCommOrders) {
    const id = o.physicianId!;
    const arr = docOrderMap.get(id) ?? [];
    arr.push({ orderNumber: o.orderNumber, createdAt: o.createdAt.toISOString(), amount: o.physicianCommissionAmount ?? 0, rate: o.physicianCommissionRate ?? 0 });
    docOrderMap.set(id, arr);
  }

  // ── Build PENDING PAYOUT rows (previous months) ───────────────────────────
  type UserInfo = { firstName: string; lastName: string; email: string; bankName: string | null; bankAccountNumber: string | null; bankAccountName: string | null };

  const pending = pendingWithdrawals.flatMap((r) => {
    const user = r.userRole === "PHYSICIAN" ? docMap.get(r.userId) : repMap.get(r.userId);
    if (!user) return [];
    const orders = r.userRole === "PHYSICIAN" ? (docOrderMap.get(r.userId) ?? []) : (repOrderMap.get(r.userId) ?? []);
    return [{
      id: r.id, userId: r.userId, userRole: r.userRole as "PHYSICIAN" | "SALES_REP",
      amount: r.amount, note: r.note, createdAt: r.createdAt.toISOString(),
      user: user as UserInfo, orders,
    }];
  });

  const rejected = rejectedWithdrawals.flatMap((r) => {
    const user = r.userRole === "PHYSICIAN" ? docMap.get(r.userId) : repMap.get(r.userId);
    if (!user) return [];
    return [{
      id: r.id, userId: r.userId, userRole: r.userRole as "PHYSICIAN" | "SALES_REP",
      amount: r.amount, note: r.note, adminNote: r.adminNote, createdAt: r.createdAt.toISOString(),
      user: user as UserInfo,
    }];
  });

  // ── Build CURRENT MONTH commission rows ───────────────────────────────────
  type CurrentMonthOrder = { orderNumber: string; createdAt: string; amount: number; rate: number };
  type RejectedCommissionOrder = {
    orderNumber: string;
    createdAt: string;
    amount: number;
    rate: number;
    refundedAt: string;
    reason: string | null;
  };
  type CurrentMonthEntry = {
    userId:          string;
    userRole:        "PHYSICIAN" | "SALES_REP";
    userName:        string;
    userEmail:       string;
    orderCount:      number;
    totalCommission: number;
    orders:          CurrentMonthOrder[];
  };
  type RejectedCommissionEntry = {
    userId:              string;
    userRole:            "PHYSICIAN" | "SALES_REP";
    userName:            string;
    userEmail:           string;
    orderCount:          number;
    totalRejectedCommission: number;
    orders:              RejectedCommissionOrder[];
  };

  // Group rep orders by userId
  const repCurrentMap = new Map<string, CurrentMonthOrder[]>();
  for (const o of currentMonthRepOrders) {
    if (o.status === "CANCELLED") continue;
    const id = o.salesRepId!;
    const refundTotal = refundTotals.get(o.id)?.salesRep ?? 0;
    const clawback = Math.max(o.salesRepClawback ?? 0, refundTotal);
    const netCommission = Math.max(0, (o.salesRepCommissionAmount ?? 0) - clawback);
    if (netCommission <= 0) continue;
    const arr = repCurrentMap.get(id) ?? [];
    arr.push({ orderNumber: o.orderNumber, createdAt: o.createdAt.toISOString(), amount: netCommission, rate: o.salesRepCommissionRate ?? 0 });
    repCurrentMap.set(id, arr);
  }
  // Group doc orders by userId
  const docCurrentMap = new Map<string, CurrentMonthOrder[]>();
  for (const o of currentMonthDocOrders) {
    if (o.status === "CANCELLED") continue;
    const id = o.physicianId!;
    const refundTotal = refundTotals.get(o.id)?.physician ?? 0;
    const clawback = Math.max(o.physicianClawback ?? 0, refundTotal);
    const netCommission = Math.max(0, (o.physicianCommissionAmount ?? 0) - clawback);
    if (netCommission <= 0) continue;
    const arr = docCurrentMap.get(id) ?? [];
    arr.push({ orderNumber: o.orderNumber, createdAt: o.createdAt.toISOString(), amount: netCommission, rate: o.physicianCommissionRate ?? 0 });
    docCurrentMap.set(id, arr);
  }

  const currentMonth: CurrentMonthEntry[] = [
    ...[...repCurrentMap.entries()].map(([id, orders]) => {
      const user = repMap.get(id);
      return {
        userId:          id,
        userRole:        "SALES_REP" as const,
        userName:        user ? `${user.firstName} ${user.lastName}` : "Unknown",
        userEmail:       user?.email ?? "",
        orderCount:      orders.length,
        totalCommission: parseFloat(orders.reduce((s, o) => s + o.amount, 0).toFixed(2)),
        orders,
      };
    }),
    ...[...docCurrentMap.entries()].map(([id, orders]) => {
      const user = docMap.get(id);
      return {
        userId:          id,
        userRole:        "PHYSICIAN" as const,
        userName:        user ? `${user.firstName} ${user.lastName}` : "Unknown",
        userEmail:       user?.email ?? "",
        orderCount:      orders.length,
        totalCommission: parseFloat(orders.reduce((s, o) => s + o.amount, 0).toFixed(2)),
        orders,
      };
    }),
  ].sort((a, b) => b.totalCommission - a.totalCommission);

  // Group commission clawbacks from refunds processed during this month.
  const repRejectedMap = new Map<string, RejectedCommissionOrder[]>();
  const docRejectedMap = new Map<string, RejectedCommissionOrder[]>();
  const seenRejectedRepOrders = new Set<string>();
  const seenRejectedDocOrders = new Set<string>();

  for (const o of [...currentMonthRepOrders, ...refundedOrders]) {
    const refund = refundTotals.get(o.id);
    const amount = refund?.salesRep ?? 0;
    if (!o.salesRepId || amount <= 0 || seenRejectedRepOrders.has(o.id)) continue;
    seenRejectedRepOrders.add(o.id);
    const arr = repRejectedMap.get(o.salesRepId) ?? [];
    arr.push({
      orderNumber: o.orderNumber,
      createdAt: o.createdAt.toISOString(),
      amount,
      rate: o.salesRepCommissionRate ?? 0,
      refundedAt: (refund?.processedAt ?? o.returnedAt ?? o.createdAt).toISOString(),
      reason: refund?.reason ?? o.returnReason,
    });
    repRejectedMap.set(o.salesRepId, arr);
  }
  for (const o of [...currentMonthDocOrders, ...refundedOrders]) {
    const refund = refundTotals.get(o.id);
    const amount = refund?.physician ?? 0;
    if (!o.physicianId || amount <= 0 || seenRejectedDocOrders.has(o.id)) continue;
    seenRejectedDocOrders.add(o.id);
    const arr = docRejectedMap.get(o.physicianId) ?? [];
    arr.push({
      orderNumber: o.orderNumber,
      createdAt: o.createdAt.toISOString(),
      amount,
      rate: o.physicianCommissionRate ?? 0,
      refundedAt: (refund?.processedAt ?? o.returnedAt ?? o.createdAt).toISOString(),
      reason: refund?.reason ?? o.returnReason,
    });
    docRejectedMap.set(o.physicianId, arr);
  }

  const rejectedCommission: RejectedCommissionEntry[] = [
    ...[...repRejectedMap.entries()].map(([id, orders]) => {
      const user = repMap.get(id);
      return {
        userId: id,
        userRole: "SALES_REP" as const,
        userName: user ? `${user.firstName} ${user.lastName}` : "Unknown",
        userEmail: user?.email ?? "",
        orderCount: orders.length,
        totalRejectedCommission: parseFloat(orders.reduce((s, o) => s + o.amount, 0).toFixed(2)),
        orders,
      };
    }),
    ...[...docRejectedMap.entries()].map(([id, orders]) => {
      const user = docMap.get(id);
      return {
        userId: id,
        userRole: "PHYSICIAN" as const,
        userName: user ? `${user.firstName} ${user.lastName}` : "Unknown",
        userEmail: user?.email ?? "",
        orderCount: orders.length,
        totalRejectedCommission: parseFloat(orders.reduce((s, o) => s + o.amount, 0).toFixed(2)),
        orders,
      };
    }),
  ].sort((a, b) => b.totalRejectedCommission - a.totalRejectedCommission);

  return (
    <div>
      <PageHeader
        title="Commission Payout"
        description="Review and approve monthly commission payouts for Medical Reps and Doctors"
      />
      <CommissionPayoutClient
        pending={pending}
        rejected={rejected}
        currentMonth={currentMonth}
        rejectedCommission={rejectedCommission}
        monthLabel={monthLabel}
      />
    </div>
  );
}
