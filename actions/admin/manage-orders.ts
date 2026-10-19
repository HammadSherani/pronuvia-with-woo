"use server";

import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/dal";
import { OrderStatus } from "@/generated/prisma/enums";
import { refreshOrderFromWoo } from "@/lib/orders/order-woo";

// Orders are changed in WooCommerce (status, refunds, notes, emails,
// commission review); the Pronuvia admin only reads them.

export type OrderItem = {
  productId: string;
  title: string;
  variantSize: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export async function listOrders(opts?: { skip?: number; take?: number; status?: string; q?: string }) {
  await requireAdmin();
  const where: Record<string, unknown> = {};
  if (opts?.status) where.status = opts.status as OrderStatus;
  if (opts?.q) {
    // Order number, WooCommerce order number (#124), patient (name / email in
    // the shipping address), physician or rep name
    const q = opts.q.trim();
    const has = { contains: q, mode: "insensitive" as const };
    const wooId = /^#?\d+$/.test(q) ? Number(q.replace("#", "")) : null;
    where.OR = [
      { orderNumber: has },
      ...(wooId !== null ? [{ wooOrderId: wooId }] : []),
      { customerEmail: has },
      { shippingAddress: has },
      { physician: { is: { OR: [{ firstName: has }, { lastName: has }, { nameOfPractice: has }, { email: has }] } } },
      { salesRep:  { is: { OR: [{ name: has }, { email: has }] } } },
    ];
  }
  const whereArg = Object.keys(where).length ? where : undefined;
  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where: whereArg,
      select: {
        id: true, orderNumber: true, status: true, total: true,
        items: true,
        subtotal: true, placedByAdmin: true, placedBySalesRep: true, commissionPaid: true,
        salesRepCommissionRate: true, salesRepCommissionAmount: true,
        physicianCommissionRate: true, physicianCommissionAmount: true,
        paymentMethod: true, paymentStatus: true, transactionId: true,
        shippingCarrier: true, trackingNumber: true, shippingRate: true, estimatedDelivery: true,
        returnedAt: true, returnedTotal: true,
        salesRepClawback: true, physicianClawback: true,
        shippingAddress: true,
        customerEmail: true,
        physician: { select: { firstName: true, lastName: true, nameOfPractice: true, email: true } },
        salesRep:  { select: { name: true, email: true } },
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      skip: opts?.skip,
      take: opts?.take,
    }),
    prisma.order.count({ where: whereArg }),
  ]);
  return { orders, total };
}

export async function getOrderById(id: string) {
  await requireAdmin();
  // Changes made in WP admin show up here
  await refreshOrderFromWoo({ id });
  return prisma.order.findUnique({
    where: { id },
    include: {
      physician: {
        select: {
          id: true, firstName: true, lastName: true, email: true,
          nameOfPractice: true, commission: true,
          phone: true, addressOne: true, addressTwo: true, city: true, state: true, zipCode: true,
          walletBalance: true,
        },
      },
      salesRep: {
        select: {
          id: true, name: true, firstName: true, lastName: true, email: true,
          phone: true, commission: true, billingAddress: true,
          walletBalance: true,
        },
      },
    },
  });
}

export type StoredRefundItem = { index: number; returnedQty: number; lineTotal: number };

export async function getOrderRefunds(orderId: string) {
  await requireAdmin();
  return prisma.orderRefund.findMany({
    where:   { orderId },
    orderBy: { processedAt: "asc" },
  });
}

export async function getCommissionSummary(opts?: { salesRepId?: string; physicianId?: string }) {
  await requireAdmin();
  const where = opts?.salesRepId
    ? { salesRepId: opts.salesRepId }
    : opts?.physicianId
    ? { physicianId: opts.physicianId }
    : {};

  const orders = await prisma.order.findMany({
    where,
    select: {
      salesRepCommissionRate: true, salesRepCommissionAmount: true,
      physicianCommissionRate: true, physicianCommissionAmount: true,
      total: true, status: true, createdAt: true, orderNumber: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const totalSalesRepCommission   = orders.reduce((s, o) => s + o.salesRepCommissionAmount,  0);
  const totalPhysicianCommission  = orders.reduce((s, o) => s + o.physicianCommissionAmount, 0);
  const totalRevenue              = orders.reduce((s, o) => s + o.total, 0);

  return { orders, totalSalesRepCommission, totalPhysicianCommission, totalRevenue };
}

