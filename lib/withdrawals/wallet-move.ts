import "server-only";
import { prisma } from "@/lib/db/prisma";
import { getCurrentPeriod } from "@/lib/withdrawals/monthly";

type WalletRole = "SALES_REP" | "PHYSICIAN";

/** Changes a wallet by `delta` in one atomic step (may go below zero); returns the new balance. */
export async function moveWallet(role: WalletRole, id: string, delta: number): Promise<number> {
  // Prisma delegates differ in type but share these calls
  const m = (role === "SALES_REP" ? prisma.salesRepresentative : prisma.partneringPhysician) as unknown as typeof prisma.salesRepresentative;
  const { walletBalance } = await m.update({ where: { id }, data: { walletBalance: { increment: delta } }, select: { walletBalance: true } });
  // Floating point leaves e.g. 5090.469999999999: store it rounded, unless
  // another change landed in between (then that one's value stands)
  const rounded = Number(walletBalance.toFixed(2));
  if (rounded !== walletBalance) await m.updateMany({ where: { id, walletBalance }, data: { walletBalance: rounded } });
  return rounded;
}

/**
 * Moves a wallet for an order's commission and writes the ledger entry
 * (CREDIT for a positive amount, DEBIT for a negative one) in this period.
 * Returns the new balance.
 */
export async function moveWalletForOrder(opts: {
  role: WalletRole; userId: string; orderId: string; delta: number; description: string;
}): Promise<number> {
  const balance = await moveWallet(opts.role, opts.userId, opts.delta);
  await prisma.walletTransaction.create({
    data: {
      userId: opts.userId, userRole: opts.role, amount: Math.abs(opts.delta), type: opts.delta >= 0 ? "CREDIT" : "DEBIT",
      description: opts.description, orderId: opts.orderId,
      periodKey: getCurrentPeriod(new Date(), process.env.PAYOUT_TIMEZONE ?? "UTC").key, balance,
    },
  });
  return balance;
}
