"use server";

import { prisma }        from "@/lib/db/prisma";
import { requireAdmin }  from "@/lib/auth/dal";
import { sendMail }      from "@/lib/email/mailer";
import { addBankDetailsEmail } from "@/lib/email/templates";

// Admin "Notify" on Commission Payout: the user is asked to add their bank
// details when they next log in, and gets an email about it.
export async function notifyUserAddBank(
  userId:   string,
  userRole: "PHYSICIAN" | "SALES_REP",
): Promise<{ success: boolean; message: string }> {
  await requireAdmin();

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
    return { success: false, message: "Failed to notify user." };
  }

  try {
    const { subject, html } = addBankDetailsEmail({
      firstName:   user.firstName,
      accountPath: userRole === "PHYSICIAN" ? "/physician/account" : "/sales/account",
    });
    await sendMail({ to: user.email, subject, html, type: "Add Bank Details", relatedId: userId });
  } catch (e) {
    console.error("[notify-bank] email failed:", e);
    return { success: false, message: `Notice shown in their account, but the email to ${user.email} failed.` };
  }
  return { success: true, message: `User notified (email sent to ${user.email}).` };
}
