"use server";

import { prisma } from "@/lib/db/prisma";
import { sendMail } from "@/lib/email/mailer";
import { forgotPasswordEmail } from "@/lib/email/templates";
import { findPhysicianByLoginIdentifier } from "@/lib/auth/physician-lookup";
import { ForgotPasswordSchema } from "@/lib/validations/auth";
import { isEmail } from "@/lib/validations/login-id";
import { z } from "zod";
import crypto from "crypto";

export type ForgotPasswordState = {
  message?: string;
  success?: boolean;
  errors?: { email?: string[] };
} | undefined;

export async function forgotPassword(
  _state: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const validated = ForgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });
  if (!validated.success) {
    return { errors: z.flattenError(validated.error).fieldErrors };
  }

  const identifier = validated.data.email;

  const token  = crypto.randomBytes(32).toString("hex");
  const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  const appUrl    = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const resetLink = `${appUrl}/reset-password/${token}`;

  // Physicians can reset using email or Login ID; link is sent to their registered email
  const physician = await findPhysicianByLoginIdentifier(identifier);
  if (physician) {
    await prisma.partneringPhysician.update({
      where: { id: physician.id },
      data: { passwordResetToken: token, passwordResetExpiry: expiry },
    });
    const { subject, html } = forgotPasswordEmail({ firstName: physician.firstName, resetLink });
    await sendMail({ to: physician.email, subject, html, type: "Password Reset", relatedId: physician.id });
    return { success: true };
  }

  // Sales reps reset with email only
  if (isEmail(identifier)) {
    const salesRep = await prisma.salesRepresentative.findUnique({
      where: { email: identifier },
      select: { id: true, firstName: true, email: true },
    });
    if (salesRep) {
      await prisma.salesRepresentative.update({
        where: { id: salesRep.id },
        data: { passwordResetToken: token, passwordResetExpiry: expiry },
      });
      const { subject, html } = forgotPasswordEmail({ firstName: salesRep.firstName, resetLink });
      await sendMail({ to: salesRep.email, subject, html, type: "Password Reset", relatedId: salesRep.id });
      return { success: true };
    }
  }

  // Always return success — don't reveal if email exists
  return { success: true };
}
