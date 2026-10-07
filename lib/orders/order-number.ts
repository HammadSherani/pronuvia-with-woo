"use server";

import { prisma } from "@/lib/db/prisma";

const START = 13000;

/**
 * Generates a safe sequential order number starting from 13000.
 * Finds the highest existing numeric order number and increments it.
 * The unique constraint on orderNumber is the final safety net for concurrent orders.
 */
export async function generateOrderNumber(): Promise<string> {
  // Find the most recent numeric order number
  const last = await prisma.order.findFirst({
    orderBy: { createdAt: "desc" },
    select:  { orderNumber: true },
  });

  let next: number;
  if (!last) {
    next = START;
  } else {
    const n = parseInt(last.orderNumber, 10);
    next = isNaN(n) ? START : n + 1;
  }

  // If this number is already taken (concurrent order race), keep incrementing
  let candidate = String(next);
  while (await prisma.order.findUnique({ where: { orderNumber: candidate } })) {
    candidate = String(parseInt(candidate, 10) + 1);
  }

  return candidate;
}
