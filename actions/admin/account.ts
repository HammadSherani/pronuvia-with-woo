"use server";

import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/dal";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword:     z.string().min(8, "New password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match",
    path:    ["confirmPassword"],
  });

export type ChangePasswordState = {
  errors?: { currentPassword?: string[]; newPassword?: string[]; confirmPassword?: string[] };
  message?: string;
  success?: boolean;
} | undefined;

export async function changeAdminPassword(
  _state: ChangePasswordState,
  formData: FormData
): Promise<ChangePasswordState> {
  const session = await requireAdmin();

  const raw = {
    currentPassword: formData.get("currentPassword"),
    newPassword:     formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  };

  const validated = ChangePasswordSchema.safeParse(raw);
  if (!validated.success) {
    return { errors: z.flattenError(validated.error).fieldErrors };
  }

  const { currentPassword, newPassword } = validated.data;

  try {
    const admin = await prisma.admin.findUnique({ where: { id: session.userId } });
    if (!admin) return { message: "Admin account not found." };

    const valid = await verifyPassword(currentPassword, admin.password);
    if (!valid) return { errors: { currentPassword: ["Current password is incorrect."] } };

    const hashed = await hashPassword(newPassword);
    await prisma.admin.update({ where: { id: session.userId }, data: { password: hashed } });

    return { success: true };
  } catch (err) {
    console.error("[changeAdminPassword]", err);
    return { message: "Failed to update password. Please try again." };
  }
}
