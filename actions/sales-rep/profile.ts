"use server";

import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireSalesRep } from "@/lib/auth/dal";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { revalidatePath } from "next/cache";

const ProfileSchema = z.object({
  firstName:       z.string().min(1, "First name is required"),
  lastName:        z.string().min(1, "Last name is required"),
  phone:           z.string().optional(),
  website:         z.string().url("Must be a valid URL").optional().or(z.literal("")),
  billingAddress:  z.string().optional(),
  shippingAddress: z.string().optional(),
  bankName:          z.string().optional(),
  bankAccountName:   z.string().optional(),
  bankAccountNumber: z.string().optional(),
  bankAccountType:   z.enum(["CHECKING", "SAVINGS"]).optional(),
  bankOwnershipType: z.enum(["PERSONAL", "BUSINESS"]).optional(),
  swiftCode:         z.string().optional(),
  routingNumber:     z.string().optional(),
});

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

export type ProfileState = {
  errors?: Record<string, string[]>;
  message?: string;
  success?: boolean;
} | undefined;

export async function updateSalesRepProfile(
  _state: ProfileState,
  formData: FormData
): Promise<ProfileState> {
  const session = await requireSalesRep();

  const raw = {
    firstName:         formData.get("firstName"),
    lastName:          formData.get("lastName"),
    phone:             formData.get("phone") || undefined,
    website:           formData.get("website") || undefined,
    billingAddress:    formData.get("billingAddress") || undefined,
    shippingAddress:   formData.get("shippingAddress") || undefined,
    bankName:          formData.get("bankName") || undefined,
    bankAccountName:   formData.get("bankAccountName") || undefined,
    bankAccountNumber: formData.get("bankAccountNumber") || undefined,
    bankAccountType:   formData.get("bankAccountType") || undefined,
    bankOwnershipType: formData.get("bankOwnershipType") || undefined,
    swiftCode:         formData.get("swiftCode") || undefined,
    routingNumber:     formData.get("routingNumber") || undefined,
  };

  const validated = ProfileSchema.safeParse(raw);
  if (!validated.success) {
    return { errors: z.flattenError(validated.error).fieldErrors };
  }

  const { firstName, lastName, ...rest } = validated.data;

  try {
    await prisma.salesRepresentative.update({
      where: { id: session.userId },
      data: {
        firstName,
        lastName,
        name: `${firstName} ${lastName}`,
        ...rest,
        // Clear notify flag once bank details are provided
        ...(rest.bankName ? { bankNotifyRequested: false } : {}),
      },
    });

    revalidatePath("/sales/account");
    return { success: true };
  } catch (err) {
    console.error("[updateSalesRepProfile]", err);
    return { message: "Failed to save changes. Please try again." };
  }
}

const BankOnlySchema = z.object({
  bankName:          z.string().min(1, "Bank name is required"),
  bankAccountName:   z.string().min(1, "Account holder name is required"),
  bankAccountNumber: z.string().min(1, "Account number is required"),
  bankAccountType:   z.enum(["CHECKING", "SAVINGS"], { message: "Select checking or savings" }),
  bankOwnershipType: z.enum(["PERSONAL", "BUSINESS"], { message: "Select personal or business" }),
  swiftCode:         z.string().optional(),
  routingNumber:     z.string().optional(),
});

export async function updateSalesRepBankDetails(
  _state: ProfileState,
  formData: FormData
): Promise<ProfileState> {
  const session = await requireSalesRep();

  const raw = {
    bankName:          (formData.get("bankName") as string)?.trim(),
    bankAccountName:   (formData.get("bankAccountName") as string)?.trim(),
    bankAccountNumber: (formData.get("bankAccountNumber") as string)?.trim(),
    bankAccountType:   (formData.get("bankAccountType") as string)?.trim(),
    bankOwnershipType: (formData.get("bankOwnershipType") as string)?.trim(),
    swiftCode:         (formData.get("swiftCode") as string)?.trim() || undefined,
    routingNumber:     (formData.get("routingNumber") as string)?.trim() || undefined,
  };

  const validated = BankOnlySchema.safeParse(raw);
  if (!validated.success) {
    return { errors: z.flattenError(validated.error).fieldErrors };
  }

  try {
    await prisma.salesRepresentative.update({
      where: { id: session.userId },
      data: { ...validated.data, bankNotifyRequested: false },
    });
    return { success: true, message: "Bank details saved." };
  } catch (err) {
    console.error("[updateSalesRepBankDetails]", err);
    return { message: "Failed to save changes. Please try again." };
  }
}

export async function changeSalesRepPassword(
  _state: ProfileState,
  formData: FormData
): Promise<ProfileState> {
  const session = await requireSalesRep();

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
    const rep = await prisma.salesRepresentative.findUnique({ where: { id: session.userId } });
    if (!rep) return { message: "Account not found." };

    const valid = await verifyPassword(currentPassword, rep.password);
    if (!valid) return { errors: { currentPassword: ["Current password is incorrect."] } };

    const hashed = await hashPassword(newPassword);
    await prisma.salesRepresentative.update({
      where: { id: session.userId },
      data:  { password: hashed },
    });

    return { success: true };
  } catch (err) {
    console.error("[changeSalesRepPassword]", err);
    return { message: "Failed to update password. Please try again." };
  }
}
