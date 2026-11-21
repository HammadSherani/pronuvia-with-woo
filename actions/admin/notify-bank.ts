"use server";

import { revalidatePath } from "next/cache";
import { prisma }        from "@/lib/db/prisma";
import { requireAdmin }  from "@/lib/auth/dal";
import { sendMail }      from "@/lib/email/mailer";
import { addBankDetailsEmail } from "@/lib/email/templates";
import { payoutsLocked, PAYOUTS_LOCKED_MESSAGE } from "@/lib/withdrawals/lock";
import { bankDetailsComplete } from "@/lib/bank/labels";

type PayoutRole = "PHYSICIAN" | "SALES_REP";

// Asks one user to add their bank details: the notice shows when they next
// log in (bankNotifyRequested), and they get an email about it.
async function askForBankDetails(userId: string, userRole: PayoutRole): Promise<{ email: string } | { email: string; emailFailed: true } | null> {
  let user: { firstName: string; email: string };
  try {
    user = userRole === "PHYSICIAN"
      ? await prisma.partneringPhysician.update({
          where:  { id: userId },
          data:   { bankNotifyRequested: true },
          select: { firstName: true, email: true },
        })
      : await prisma.salesRepresentative.update({
          where:  { id: userId },
          data:   { bankNotifyRequested: true },
          select: { firstName: true, email: true },
        });
  } catch {
    return null;
  }

  try {
    const { subject, html } = addBankDetailsEmail({
      firstName:   user.firstName,
      accountPath: userRole === "PHYSICIAN" ? "/physician/account" : "/sales/account",
    });
    await sendMail({ to: user.email, subject, html, type: "Add Bank Details", relatedId: userId });
  } catch (e) {
    console.error("[notify-bank] email failed:", e);
    return { email: user.email, emailFailed: true };
  }
  return { email: user.email };
}

// Admin "Notify" on Commission Payout, for one user.
export async function notifyUserAddBank(
  userId:   string,
  userRole: PayoutRole,
): Promise<{ success: boolean; message: string }> {
  await requireAdmin();
  if (payoutsLocked()) return { success: false, message: PAYOUTS_LOCKED_MESSAGE };

  const r = await askForBankDetails(userId, userRole);
  if (!r) return { success: false, message: "Failed to notify user." };
  revalidatePath("/admin/withdrawals");
  if ("emailFailed" in r) return { success: false, message: `Notice shown in their account, but the email to ${r.email} failed.` };
  return { success: true, message: `User notified (email sent to ${r.email}).` };
}

/** Pending payouts whose owner still has no complete bank details, and hasn't been asked yet. */
async function usersToNotify(): Promise<{ userId: string; userRole: PayoutRole }[]> {
  const pending = await prisma.withdrawRequest.findMany({
    where:  { status: "PENDING", amount: { gt: 0 } },
    select: { userId: true, userRole: true },
  });
  const docIds = [...new Set(pending.filter((p) => p.userRole === "PHYSICIAN").map((p) => p.userId))];
  const repIds = [...new Set(pending.filter((p) => p.userRole === "SALES_REP").map((p) => p.userId))];
  const bank = { bankName: true, bankAccountNumber: true, bankAccountName: true, bankAccountType: true, bankOwnershipType: true, bankNotifyRequested: true } as const;
  const [docs, reps] = await Promise.all([
    docIds.length ? prisma.partneringPhysician.findMany({ where: { id: { in: docIds } }, select: { id: true, ...bank } }) : [],
    repIds.length ? prisma.salesRepresentative.findMany({ where: { id: { in: repIds } }, select: { id: true, ...bank } }) : [],
  ]);
  const needs = (u: (typeof docs)[number]) => !bankDetailsComplete(u) && !u.bankNotifyRequested;
  return [
    ...docs.filter(needs).map((u) => ({ userId: u.id, userRole: "PHYSICIAN" as const })),
    ...reps.filter(needs).map((u) => ({ userId: u.id, userRole: "SALES_REP" as const })),
  ];
}

/** How many users "Notify all" would email right now. */
export async function countUsersToNotify(): Promise<number> {
  await requireAdmin();
  return (await usersToNotify()).length;
}

/**
 * "Notify all without bank details" on Commission Payout, for launch day:
 * asks every user with a pending payout and no complete bank details to add
 * them. Users already asked are skipped, so pressing it again only reaches
 * people who weren't asked yet (a single user can still be re-sent with the
 * row's Notify button).
 */
export async function notifyAllWithoutBank(): Promise<{ success: boolean; message: string; sent: number; failed: number }> {
  await requireAdmin();
  if (payoutsLocked()) return { success: false, message: PAYOUTS_LOCKED_MESSAGE, sent: 0, failed: 0 };

  const users = await usersToNotify();
  if (!users.length) return { success: true, message: "Everyone with a pending payout has bank details or was already notified.", sent: 0, failed: 0 };

  let sent = 0, failed = 0;
  // A few at a time: keeps the mail server from rate-limiting a big batch
  for (let i = 0; i < users.length; i += 5) {
    const results = await Promise.all(users.slice(i, i + 5).map((u) => askForBankDetails(u.userId, u.userRole)));
    for (const r of results) { if (r && !("emailFailed" in r)) sent++; else failed++; }
  }
  revalidatePath("/admin/withdrawals");
  const message = failed
    ? `${sent} user${sent !== 1 ? "s" : ""} notified; ${failed} email${failed !== 1 ? "s" : ""} failed (they still see the notice when they log in).`
    : `${sent} user${sent !== 1 ? "s" : ""} notified to add their bank details.`;
  return { success: failed === 0, message, sent, failed };
}
