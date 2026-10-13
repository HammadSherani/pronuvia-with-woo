import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

const START = 13000;
const COUNTER = "orderNumber";

/**
 * The next order number (13000, 13001, …). An atomic counter hands each
 * number out once, even when the newest order is later deleted; its first use
 * starts after the highest number already in use.
 */
export async function generateOrderNumber(): Promise<string> {
  if (!(await prisma.counter.findUnique({ where: { id: COUNTER } }))) {
    const numbers = await prisma.order.findMany({ select: { orderNumber: true } });
    const highest = numbers.reduce((max, o) => {
      const n = parseInt(o.orderNumber, 10);
      return /^\d+$/.test(o.orderNumber) && n > max ? n : max;
    }, START - 1);
    try {
      await prisma.counter.create({ data: { id: COUNTER, value: highest } });
    } catch (e) {
      // Two first orders at once: the other one created it
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
    }
  }

  // An order number set by hand could still be taken: skip it
  for (;;) {
    const { value } = await prisma.counter.update({ where: { id: COUNTER }, data: { value: { increment: 1 } } });
    const candidate = String(value);
    if (!(await prisma.order.findUnique({ where: { orderNumber: candidate }, select: { id: true } }))) return candidate;
  }
}
