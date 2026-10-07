"use server";

import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/dal";
import { parseDateOnlyInTZ, parseDateOnlyEndOfDayInTZ, toDateInputValue } from "@/lib/utils/timezone";

export type ReportFilters = {
  from?:        string; // YYYY-MM-DD
  to?:          string;
  physicianId?: string;
  salesRepId?:  string;
  status?:      string;
  product?:     string; // title search (products report only)
};

type ItemJson = {
  productId:   string;
  title:       string;
  variantSize: string;
  sku:         string;
  quantity:    number;
  unitPrice:   number;
  lineTotal:   number;
};

function dateWhere(f: ReportFilters) {
  if (!f.from && !f.to) return {};
  const range: Record<string, Date> = {};
  if (f.from) range.gte = parseDateOnlyInTZ(f.from);
  if (f.to)   range.lte = parseDateOnlyEndOfDayInTZ(f.to);
  return { createdAt: range };
}

function baseWhere(f: ReportFilters, extra: Record<string, unknown> = {}) {
  return {
    ...dateWhere(f),
    ...(f.physicianId ? { physicianId: f.physicianId } : {}),
    ...(f.salesRepId  ? { salesRepId:  f.salesRepId  } : {}),
    ...(f.status      ? { status:      f.status as "PENDING"|"PROCESSING"|"SHIPPED"|"DELIVERED"|"COMPLETED"|"CANCELLED"|"REFUNDED" } : {}),
    ...extra,
  };
}

function parseAddr(raw: string | null) {
  if (!raw) return "–";
  try {
    const p = JSON.parse(raw);
    return [p.firstName, p.lastName, p.address1, p.city, p.state, p.zip, p.countryName]
      .filter(Boolean).join(", ");
  } catch {
    return raw || "–";
  }
}

// ─────────────────────────────────────────────
// Filter options (doctor + sales rep dropdowns)
// ─────────────────────────────────────────────
export async function getReportFilterOptions() {
  await requireAdmin();
  const [doctors, salesReps, products] = await Promise.all([
    prisma.partneringPhysician.findMany({
      select: { id: true, firstName: true, lastName: true },
      orderBy: { lastName: "asc" },
    }),
    prisma.salesRepresentative.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.product.findMany({
      where:   { status: "ACTIVE" },
      select:  { id: true, title: true },
      orderBy: { title: "asc" },
    }),
  ]);
  return {
    doctors:   doctors.map(d => ({ id: d.id, name: ` ${d.firstName} ${d.lastName}` })),
    salesReps: salesReps.map(r => ({ id: r.id, name: r.name })),
    products:  products.map(p => ({ id: p.id, name: p.title })),
  };
}

// ─────────────────────────────────────────────
// 1. Overall Sales Report
// ─────────────────────────────────────────────
export type SalesRow = {
  id: string; orderNumber: string; date: string;
  doctor: string; salesRep: string; status: string;
  subtotal: number; shipping: number; discount: number; total: number;
  paymentMethod: string; placedByAdmin: boolean;
};

export async function getOverallSalesReport(f: ReportFilters): Promise<SalesRow[]> {
  await requireAdmin();
  const rows = await prisma.order.findMany({
    where: baseWhere(f),
    select: {
      id: true, orderNumber: true, status: true, createdAt: true,
      subtotal: true, total: true, shippingRate: true, discountAmount: true,
      paymentMethod: true, placedByAdmin: true,
      physician: { select: { firstName: true, lastName: true } },
      salesRep:  { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(o => ({
    id:            o.id,
    orderNumber:   o.orderNumber,
    date:          toDateInputValue(o.createdAt),
    doctor:        o.physician ? ` ${o.physician.firstName} ${o.physician.lastName}` : "–",
    salesRep:      o.salesRep?.name ?? "–",
    status:        o.status,
    subtotal:      o.subtotal,
    shipping:      o.shippingRate,
    discount:      o.discountAmount,
    total:         o.total,
    paymentMethod: o.paymentMethod ?? "–",
    placedByAdmin: o.placedByAdmin,
  }));
}

// ─────────────────────────────────────────────
// 2. Sales by Product Report
// ─────────────────────────────────────────────
export type ProductRow = {
  key: string; title: string; sku: string; size: string;
  quantity: number; unitPrice: number; revenue: number; orderCount: number;
};

export async function getSalesByProductReport(f: ReportFilters): Promise<ProductRow[]> {
  await requireAdmin();
  const orders = await prisma.order.findMany({
    where: baseWhere({ ...f, status: undefined }, {
      status: { notIn: ["CANCELLED", "REFUNDED"] },
    }),
    select: { items: true },
  });

  const map = new Map<string, ProductRow>();
  for (const o of orders) {
    const items = o.items as unknown as ItemJson[];
    for (const item of items) {
      if (f.product && !item.title.toLowerCase().includes(f.product.toLowerCase())) continue;
      const key = `${item.productId}|${item.variantSize ?? ""}`;
      const ex  = map.get(key);
      if (ex) {
        ex.quantity   += item.quantity;
        ex.revenue    += item.lineTotal;
        ex.orderCount += 1;
      } else {
        map.set(key, {
          key,
          title:      item.title,
          sku:        item.sku || "–",
          size:       item.variantSize || "–",
          quantity:   item.quantity,
          unitPrice:  item.unitPrice,
          revenue:    item.lineTotal,
          orderCount: 1,
        });
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
}

// ─────────────────────────────────────────────
// 3. Return Orders Report
// ─────────────────────────────────────────────
export type ReturnRow = {
  id: string; orderNumber: string; orderDate: string; returnDate: string;
  doctor: string; salesRep: string;
  originalTotal: number; returnedTotal: number;
  returnReason: string; srClawback: number; physicianClawback: number;
};

export async function getReturnOrdersReport(f: ReportFilters): Promise<ReturnRow[]> {
  await requireAdmin();
  const { status: _s, ...fBase } = f;
  const rows = await prisma.order.findMany({
    where: { ...baseWhere(fBase), returnedAt: { not: null } },
    select: {
      id: true, orderNumber: true, createdAt: true, returnedAt: true,
      returnReason: true, total: true, returnedTotal: true,
      salesRepClawback: true, physicianClawback: true,
      physician: { select: { firstName: true, lastName: true } },
      salesRep:  { select: { name: true } },
    },
    orderBy: { returnedAt: "desc" },
  });
  return rows.map(o => ({
    id:                o.id,
    orderNumber:       o.orderNumber,
    orderDate:         toDateInputValue(o.createdAt),
    returnDate:        toDateInputValue(o.returnedAt!),
    doctor:            o.physician ? ` ${o.physician.firstName} ${o.physician.lastName}` : "–",
    salesRep:          o.salesRep?.name ?? "–",
    originalTotal:     o.total,
    returnedTotal:     o.returnedTotal ?? 0,
    returnReason:      o.returnReason ?? "–",
    srClawback:        o.salesRepClawback ?? 0,
    physicianClawback: o.physicianClawback ?? 0,
  }));
}

// ─────────────────────────────────────────────
// 4. Sales Rep Commission Payout Report
// ─────────────────────────────────────────────
export type SalesRepCommRow = {
  repId: string; repName: string; orderCount: number;
  totalSales: number; avgRate: number;
  totalCommission: number; paidCommission: number; unpaidCommission: number;
  totalClawback: number; netCommission: number;
};

export async function getSalesRepCommissionReport(f: ReportFilters): Promise<SalesRepCommRow[]> {
  await requireAdmin();
  const { status: _s, physicianId: _p, ...fBase } = f;
  const rows = await prisma.order.findMany({
    where: {
      ...baseWhere(fBase),
      salesRepId: f.salesRepId ?? { not: null },
    },
    select: {
      total: true,
      salesRepCommissionRate: true, salesRepCommissionAmount: true,
      commissionPaid: true, salesRepClawback: true,
      salesRep: { select: { id: true, name: true } },
    },
  });

  const map = new Map<string, { row: SalesRepCommRow; rateSum: number }>();
  for (const o of rows) {
    if (!o.salesRep) continue;
    const key      = o.salesRep.id;
    const comm     = o.salesRepCommissionAmount;
    const clawback = o.salesRepClawback ?? 0;
    const paid     = o.commissionPaid ? comm : 0;
    const unpaid   = o.commissionPaid ? 0 : comm;
    const ex       = map.get(key);
    if (ex) {
      ex.row.orderCount++;
      ex.row.totalSales       += o.total;
      ex.row.totalCommission  += comm;
      ex.row.paidCommission   += paid;
      ex.row.unpaidCommission += unpaid;
      ex.row.totalClawback    += clawback;
      ex.row.netCommission    += comm - clawback;
      ex.rateSum              += o.salesRepCommissionRate;
    } else {
      map.set(key, {
        rateSum: o.salesRepCommissionRate,
        row: {
          repId: o.salesRep.id, repName: o.salesRep.name,
          orderCount: 1, totalSales: o.total, avgRate: 0,
          totalCommission: comm, paidCommission: paid, unpaidCommission: unpaid,
          totalClawback: clawback, netCommission: comm - clawback,
        },
      });
    }
  }
  return Array.from(map.values())
    .map(({ row, rateSum }) => ({ ...row, avgRate: parseFloat((rateSum / row.orderCount).toFixed(2)) }))
    .sort((a, b) => b.totalCommission - a.totalCommission);
}

// ─────────────────────────────────────────────
// 5. Overall Commission Payout Report
// ─────────────────────────────────────────────
export type OverallCommRow = {
  id: string; orderNumber: string; date: string;
  doctor: string; salesRep: string; orderTotal: number;
  srCommRate: number; srCommAmount: number;
  docCommRate: number; docCommAmount: number;
  totalCommission: number; paid: boolean;
};

export async function getOverallCommissionReport(f: ReportFilters): Promise<OverallCommRow[]> {
  await requireAdmin();
  const rows = await prisma.order.findMany({
    where: baseWhere(f),
    select: {
      id: true, orderNumber: true, createdAt: true, total: true,
      salesRepCommissionRate: true, salesRepCommissionAmount: true,
      physicianCommissionRate: true, physicianCommissionAmount: true,
      commissionPaid: true,
      physician: { select: { firstName: true, lastName: true } },
      salesRep:  { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(o => ({
    id:              o.id,
    orderNumber:     o.orderNumber,
    date:            toDateInputValue(o.createdAt),
    doctor:          o.physician ? ` ${o.physician.firstName} ${o.physician.lastName}` : "–",
    salesRep:        o.salesRep?.name ?? "–",
    orderTotal:      o.total,
    srCommRate:      o.salesRepCommissionRate,
    srCommAmount:    o.salesRepCommissionAmount,
    docCommRate:     o.physicianCommissionRate,
    docCommAmount:   o.physicianCommissionAmount,
    totalCommission: o.salesRepCommissionAmount + o.physicianCommissionAmount,
    paid:            o.commissionPaid,
  }));
}

// ─────────────────────────────────────────────
// 6. Doctor Commission Payout Report
// ─────────────────────────────────────────────
export type DoctorCommRow = {
  doctorId: string; doctorName: string; practice: string;
  orderCount: number; totalSales: number; avgRate: number;
  totalCommission: number; paidCommission: number; unpaidCommission: number;
};

export async function getDoctorCommissionReport(f: ReportFilters): Promise<DoctorCommRow[]> {
  await requireAdmin();
  const { status: _s, salesRepId: _sr, ...fBase } = f;
  const rows = await prisma.order.findMany({
    where: {
      ...baseWhere(fBase),
      physicianId: f.physicianId ?? { not: null },
    },
    select: {
      total: true,
      physicianCommissionRate: true, physicianCommissionAmount: true,
      commissionPaid: true,
      physician: { select: { id: true, firstName: true, lastName: true, nameOfPractice: true } },
    },
  });

  const map = new Map<string, { row: DoctorCommRow; rateSum: number }>();
  for (const o of rows) {
    if (!o.physician) continue;
    const key   = o.physician.id;
    const comm  = o.physicianCommissionAmount;
    const paid  = o.commissionPaid ? comm : 0;
    const unpaid= o.commissionPaid ? 0 : comm;
    const ex    = map.get(key);
    if (ex) {
      ex.row.orderCount++;
      ex.row.totalSales       += o.total;
      ex.row.totalCommission  += comm;
      ex.row.paidCommission   += paid;
      ex.row.unpaidCommission += unpaid;
      ex.rateSum              += o.physicianCommissionRate;
    } else {
      map.set(key, {
        rateSum: o.physicianCommissionRate,
        row: {
          doctorId:          o.physician.id,
          doctorName:        ` ${o.physician.firstName} ${o.physician.lastName}`,
          practice:          o.physician.nameOfPractice ?? "–",
          orderCount:        1,
          totalSales:        o.total,
          avgRate:           0,
          totalCommission:   comm,
          paidCommission:    paid,
          unpaidCommission:  unpaid,
        },
      });
    }
  }
  return Array.from(map.values())
    .map(({ row, rateSum }) => ({ ...row, avgRate: parseFloat((rateSum / row.orderCount).toFixed(2)) }))
    .sort((a, b) => b.totalCommission - a.totalCommission);
}

// ─────────────────────────────────────────────
// 7. Order Details
// ─────────────────────────────────────────────
export type CustomerHistoryRow = {
  id: string; orderNumber: string; date: string;
  doctor: string; doctorEmail: string;
  salesRep: string; salesRepEmail: string;
  patientEmail: string; patientPhone: string;
  status: string;
  itemsSummary: string;
  subtotal: number; shippingRate: number; discountAmount: number; total: number;
  couponCode: string; paymentMethod: string;
  trackingNumber: string; shippingCarrier: string;
  shippingAddress: string; billingAddress: string;
};

export async function getCustomerOrderHistoryReport(f: ReportFilters): Promise<CustomerHistoryRow[]> {
  await requireAdmin();
  const rows = await prisma.order.findMany({
    where: baseWhere(f),
    select: {
      id: true, orderNumber: true, status: true, createdAt: true,
      items: true, subtotal: true, total: true, shippingRate: true,
      couponCode: true, discountAmount: true,
      customerEmail: true, customerPhone: true,
      shippingAddress: true, billingAddress: true,
      paymentMethod: true, trackingNumber: true, shippingCarrier: true,
      physician: { select: { firstName: true, lastName: true, email: true } },
      salesRep:  { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(o => {
    const items = o.items as unknown as ItemJson[];
    const itemsSummary = items
      .map(i => `${i.title}${i.variantSize ? ` (${i.variantSize})` : ""} ×${i.quantity}`)
      .join("; ");
    return {
      id:              o.id,
      orderNumber:     o.orderNumber,
      date:            toDateInputValue(o.createdAt),
      doctor:          o.physician ? `${o.physician.firstName} ${o.physician.lastName}` : "–",
      doctorEmail:     o.physician?.email ?? "",
      salesRep:        o.salesRep?.name ?? "–",
      salesRepEmail:   o.salesRep?.email ?? "",
      patientEmail:    o.customerEmail ?? "",
      patientPhone:    o.customerPhone ?? "",
      status:          o.status,
      itemsSummary,
      subtotal:        o.subtotal,
      shippingRate:    o.shippingRate ?? 0,
      discountAmount:  o.discountAmount ?? 0,
      total:           o.total,
      couponCode:      o.couponCode ?? "",
      paymentMethod:   o.paymentMethod ?? "–",
      trackingNumber:  o.trackingNumber ?? "",
      shippingCarrier: o.shippingCarrier ?? "",
      shippingAddress: parseAddr(o.shippingAddress),
      billingAddress:  parseAddr(o.billingAddress),
    };
  });
}
