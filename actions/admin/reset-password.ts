"use server";

import { requireAdmin }        from "@/lib/auth/dal";
import { prisma }              from "@/lib/db/prisma";
import { hashPassword }        from "@/lib/auth/password";
import { sendMail }            from "@/lib/email/mailer";
import { forgotPasswordEmail } from "@/lib/email/templates";
import crypto                  from "crypto";

export type AdminPasswordState = { success?: boolean; message?: string } | undefined;

export async function adminSetPassword(
  userId: string,
  role:   "PHYSICIAN" | "SALES_REP",
  _state: AdminPasswordState,
  formData: FormData,
): Promise<AdminPasswordState> {
  await requireAdmin();

  const password = (formData.get("password") as string) ?? "";
  const confirm  = (formData.get("confirmPassword") as string) ?? "";

  if (password.length < 8)              return { message: "Password must be at least 8 characters." };
  if (!/[a-zA-Z]/.test(password))       return { message: "Password must contain a letter." };
  if (!/[0-9]/.test(password))          return { message: "Password must contain a number." };
  if (!/[^a-zA-Z0-9]/.test(password))  return { message: "Password must contain a special character." };
  if (password !== confirm)             return { message: "Passwords do not match." };

  const hashed = await hashPassword(password);

  if (role === "PHYSICIAN") {
    await prisma.partneringPhysician.update({
      where: { id: userId },
      data:  { password: hashed, passwordResetToken: null, passwordResetExpiry: null },
    });
  } else {
    await prisma.salesRepresentative.update({
      where: { id: userId },
      data:  { password: hashed, passwordResetToken: null, passwordResetExpiry: null },
    });
  }

  return { success: true, message: "Password updated successfully." };
}

export async function adminSendResetLink(
  userId: string,
  role:   "PHYSICIAN" | "SALES_REP",
  _state: AdminPasswordState,
  _formData: FormData,
): Promise<AdminPasswordState> {
  await requireAdmin();

  const token  = crypto.randomBytes(32).toString("hex");
  const expiry = new Date(Date.now() + 60 * 60 * 1000);
  const appUrl    = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const resetLink = `${appUrl}/reset-password/${token}`;

  if (role === "PHYSICIAN") {
    const p = await prisma.partneringPhysician.findUnique({
      where:  { id: userId },
      select: { firstName: true, email: true },
    });
    if (!p) return { message: "Physician not found." };
    await prisma.partneringPhysician.update({
      where: { id: userId },
      data:  { passwordResetToken: token, passwordResetExpiry: expiry },
    });
    const { subject, html } = forgotPasswordEmail({ firstName: p.firstName, resetLink });
    await sendMail({ to: p.email, subject, html, type: "Password Reset", relatedId: userId });
    return { success: true, message: `Reset link sent to ${p.email}.` };
  } else {
    const r = await prisma.salesRepresentative.findUnique({
      where:  { id: userId },
      select: { firstName: true, email: true },
    });
    if (!r) return { message: "Medical Rep not found." };
    await prisma.salesRepresentative.update({
      where: { id: userId },
      data:  { passwordResetToken: token, passwordResetExpiry: expiry },
    });
    const { subject, html } = forgotPasswordEmail({ firstName: r.firstName, resetLink });
    await sendMail({ to: r.email, subject, html, type: "Password Reset", relatedId: userId });
    return { success: true, message: `Reset link sent to ${r.email}.` };
  }
}
