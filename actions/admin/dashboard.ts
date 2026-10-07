"use server";

import { prisma } from "@/lib/db/prisma";
import { getLocalDateParts, startOfDay, startOfMonth, endOfDay, formatDate } from "@/lib/utils/timezone";

// Noon-UTC anchors below are deliberately timezone/DST-agnostic — they only
// carry a calendar (year, month, day) forward, never a wall-clock time, so
// shifting by N days/months can't be thrown off by a DST transition or by
// which timezone the shift math itself runs in. The actual NY-local
// boundary is only derived afterward, via startOfDay/startOfMonth.
function shiftByDays(from: Date, days: number): Date {
  const p = getLocalDateParts(from);
  return new Date(Date.UTC(p.year, p.month - 1, p.day, 12, 0, 0) + days * 86_400_000);
}
function shiftByMonths(from: Date, months: number): Date {
  const p = getLocalDateParts(from);
  return new Date(Date.UTC(p.year, p.month - 1 + months, 15, 12, 0, 0));
}

function buildBuckets(period: "daily" | "weekly" | "monthly", count: number) {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const offset = count - 1 - i;
    if (period === "daily") {
      const anchor = shiftByDays(now, -offset);
      const start = startOfDay(anchor);
      const end = startOfDay(shiftByDays(anchor, 1));
      return { start, end, label: formatDate(start, { month: "short", day: "numeric" }) };
    } else if (period === "weekly") {
      const anchor = shiftByDays(now, -offset * 7);
      const p = getLocalDateParts(anchor);
      const anchorNoon = Date.UTC(p.year, p.month - 1, p.day, 12, 0, 0);
      const dow = new Date(anchorNoon).getUTCDay(); // 0=Sun, week starts Sunday to match prior behavior
      const weekStart = startOfDay(new Date(anchorNoon - dow * 86_400_000));
      const end = startOfDay(shiftByDays(weekStart, 7));
      return { start: weekStart, end, label: `Wk ${formatDate(weekStart, { month: "short", day: "numeric" })}` };
    } else {
      const anchor = shiftByMonths(now, -offset);
      const start = startOfMonth(anchor);
      const end = startOfMonth(shiftByMonths(anchor, 1));
      return { start, end, label: formatDate(start, { month: "short", year: "2-digit" }) };
    }
  });
}

export async function getDashboardStats(opts?: { from?: Date; to?: Date }) {
  const twelveMonthsAgo = startOfMonth(shiftByMonths(new Date(), -12));

  // When a date range is selected, use it; otherwise fall back to 12-month window for charts.
  // opts.from/opts.to are expected to already be NY-anchored instants (see
  // parseDateOnlyInTZ at the call site) — endOfDay here makes "to" inclusive
  // of that whole NY calendar day without relying on a fixed +24h offset.
  const rangeFrom = opts?.from;
  const rangeTo   = opts?.to ? endOfDay(opts.to) : undefined;

  const chartFrom  = rangeFrom ?? twelveMonthsAgo;
  const orderWhere = rangeFrom || rangeTo
    ? { createdAt: { gte: rangeFrom, ...(rangeTo ? { lte: rangeTo } : {}) } }
    : undefined;

  const [
    salesRepsCount,
    physiciansCount,
    pendingWithdrawals,
    totals,
    recentOrders,
    latestOrders,
    latestPhysicians,
  ] = await Promise.all([
    prisma.salesRepresentative.count(),
    prisma.partneringPhysician.count({ where: { isApproved: "APPROVED" } }),
    prisma.withdrawRequest.count({ where: { status: "PENDING" } }),
    prisma.order.aggregate({ where: orderWhere, _sum: { total: true }, _count: true }),
    prisma.order.findMany({
      where: { createdAt: { gte: chartFrom, ...(rangeTo ? { lte: rangeTo } : {}) } },
      select: {
        total: true,
        status: true,
        createdAt: true,
        salesRepCommissionAmount: true,
        physicianCommissionAmount: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.order.findMany({
      take: 6,
      where: orderWhere,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        orderNumber: true,
        total: true,
        status: true,
        createdAt: true,
        salesRep: { select: { firstName: true, lastName: true } },
        physician: { select: { firstName: true, lastName: true } },
      },
    }),
    prisma.partneringPhysician.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        isApproved: true,
        createdAt: true,
      },
    }),
  ]);

  function buildChartData(period: "daily" | "weekly" | "monthly", count: number) {
    return buildBuckets(period, count).map(({ start, end, label }) => {
      const slice = recentOrders.filter((o) => {
        const t = new Date(o.createdAt).getTime();
        return t >= start.getTime() && t < end.getTime();
      });
      return {
        label,
        orders: slice.length,
        revenue: Math.round(slice.reduce((s, o) => s + o.total, 0) * 100) / 100,
      };
    });
  }

  const statusCounts = recentOrders.reduce<Record<string, number>>((acc, o) => {
    acc[o.status] = (acc[o.status] ?? 0) + 1;
    return acc;
  }, {});

  const totalRepCommission = recentOrders.reduce((s, o) => s + o.salesRepCommissionAmount, 0);
  const totalDrCommission  = recentOrders.reduce((s, o) => s + o.physicianCommissionAmount, 0);

  const monthly = buildChartData("monthly", 12);
  const prevMonth = monthly[monthly.length - 2] ?? { orders: 0, revenue: 0 };
  const currMonth = monthly[monthly.length - 1] ?? { orders: 0, revenue: 0 };
  const ordersChange  = prevMonth.orders  > 0 ? Math.round(((currMonth.orders  - prevMonth.orders)  / prevMonth.orders)  * 100) : 0;
  const revenueChange = prevMonth.revenue > 0 ? Math.round(((currMonth.revenue - prevMonth.revenue) / prevMonth.revenue) * 100) : 0;

  return {
    kpis: {
      salesRepsCount,
      physiciansCount,
      pendingWithdrawals,
      totalOrders:   totals._count,
      totalRevenue:  Math.round((totals._sum.total ?? 0) * 100) / 100,
      ordersChange,
      revenueChange,
    },
    charts: {
      statusBreakdown: Object.entries(statusCounts).map(([status, count]) => ({ status, count })),
      commissionBreakdown: [
        { name: "Medical Rep", value: Math.round(totalRepCommission * 100) / 100 },
        { name: "Physician", value: Math.round(totalDrCommission  * 100) / 100 },
      ],
      daily:   buildChartData("daily",   30),
      weekly:  buildChartData("weekly",  12),
      monthly,
    },
    latestOrders: latestOrders.map((o) => ({
      id:          o.id,
      orderNumber: o.orderNumber,
      total:       o.total,
      status:      o.status,
      createdAt:   o.createdAt,
      repName:     o.salesRep ? `${o.salesRep.firstName} ${o.salesRep.lastName}` : null,
      drName:      o.physician ? `${o.physician.firstName} ${o.physician.lastName}` : null,
    })),
    latestPhysicians: latestPhysicians.map((p) => ({
      id:         p.id,
      name:       `${p.firstName} ${p.lastName}`,
      email:      p.email,
      isApproved: p.isApproved,
      createdAt:  p.createdAt,
    })),
  };
}

export type DashboardStats = Awaited<ReturnType<typeof getDashboardStats>>;
