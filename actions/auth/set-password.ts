"use server";

import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";
import { z } from "zod";

const schema = z
  .object({
    password:        z.string().min(8, "Min 8 characters")
                       .regex(/[a-zA-Z]/, "Must contain a letter")
                       .regex(/[0-9]/, "Must contain a number")
                       .regex(/[^a-zA-Z0-9]/, "Must contain a special character"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type SetPasswordState = {
  errors?: { password?: string[]; confirmPassword?: string[] };
  message?: string;
  success?: boolean;
} | undefined;

export async function setPassword(
  token: string,
  _state: SetPasswordState,
  formData: FormData,
): Promise<SetPasswordState> {
  const raw = {
    password:        formData.get("password") as string,
    confirmPassword: formData.get("confirmPassword") as string,
  };

  const validated = schema.safeParse(raw);
  if (!validated.success) {
    return { errors: z.flattenError(validated.error).fieldErrors };
  }

  const now = new Date();

  // Try sales rep first
  const salesRep = await prisma.salesRepresentative.findFirst({
    where: { passwordResetToken: token, passwordResetExpiry: { gt: now } },
  });
  if (salesRep) {
    const hashed = await hashPassword(validated.data.password);
    await prisma.salesRepresentative.update({
      where: { id: salesRep.id },
      data: { password: hashed, passwordResetToken: null, passwordResetExpiry: null },
    });
    return { success: true, message: "Password set successfully. You can now log in." };
  }

  // Try physician
  const physician = await prisma.partneringPhysician.findFirst({
    where: { passwordResetToken: token, passwordResetExpiry: { gt: now } },
  });
  if (physician) {
    const hashed = await hashPassword(validated.data.password);
    await prisma.partneringPhysician.update({
      where: { id: physician.id },
      data: { password: hashed, passwordResetToken: null, passwordResetExpiry: null },
    });
    return { success: true, message: "Password set successfully. You can now log in." };
  }

  return { message: "This link is invalid or has expired. Please contact your administrator." };
}

export async function validateResetToken(token: string): Promise<"salesRep" | "physician" | null> {
  const now = new Date();
  const salesRep = await prisma.salesRepresentative.findFirst({
    where: { passwordResetToken: token, passwordResetExpiry: { gt: now } },
    select: { id: true },
  });
  if (salesRep) return "salesRep";

  const physician = await prisma.partneringPhysician.findFirst({
    where: { passwordResetToken: token, passwordResetExpiry: { gt: now } },
    select: { id: true },
  });
  if (physician) return "physician";

  return null;
}
