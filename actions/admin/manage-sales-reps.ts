"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/dal";
import { hashPassword } from "@/lib/auth/password";
import { generateResetToken, randomPlaceholderPassword } from "@/lib/auth/reset-token";
import { CreateSalesRepSchema, UpdateSalesRepSchema } from "@/lib/validations/sales-rep";
import { sendMail } from "@/lib/email/mailer";
import { passwordSetupEmail } from "@/lib/email/templates";
import { z } from "zod";
import { isLoginIdTaken } from "@/lib/auth/physician-lookup";
import { duplicateKeyField } from "@/lib/db/prisma-errors";

export type SalesRepActionState = {
  errors?: Record<string, string[]>;
  message?: string;
  success?: boolean;
} | undefined;

function parseCreate(formData: FormData) {
  return {
    firstName:         (formData.get("firstName")         as string)?.trim() || "",
    lastName:          (formData.get("lastName")          as string)?.trim() || "",
    email:             (formData.get("email")             as string)?.trim() || "",
    loginId:           (formData.get("loginId")             as string)?.trim() || undefined,
    phone:             (formData.get("phone")             as string) || undefined,
    commission:        Number(formData.get("commission") ?? 0),
    billingAddress:    (formData.get("billingAddress")    as string) || undefined,
    shippingAddress:   (formData.get("shippingAddress")   as string) || undefined,
    bankName:          (formData.get("bankName")          as string) || undefined,
    bankAccountNumber: (formData.get("bankAccountNumber") as string) || undefined,
    bankAccountName:   (formData.get("bankAccountName")   as string) || undefined,
    swiftCode:         (formData.get("swiftCode")         as string) || undefined,
    routingNumber:     (formData.get("routingNumber")     as string) || undefined,
  };
}

function parseUpdate(formData: FormData) {
  const num = (k: string) => { const v = formData.get(k); return v ? Number(v) : undefined; };
  return {
    firstName:         (formData.get("firstName")         as string)?.trim() || undefined,
    lastName:          (formData.get("lastName")          as string)?.trim() || undefined,
    email:             (formData.get("email")             as string)?.trim() || undefined,
    loginId:           (formData.get("loginId")             as string)?.trim() || undefined,
    phone:             (formData.get("phone")             as string) || undefined,
    commission:        num("commission"),
    billingAddress:    (formData.get("billingAddress")    as string) || undefined,
    shippingAddress:   (formData.get("shippingAddress")   as string) || undefined,
    bankName:          (formData.get("bankName")          as string) || undefined,
    bankAccountNumber: (formData.get("bankAccountNumber") as string) || undefined,
    bankAccountName:   (formData.get("bankAccountName")   as string) || undefined,
    swiftCode:         (formData.get("swiftCode")         as string) || undefined,
    routingNumber:     (formData.get("routingNumber")     as string) || undefined,
  };
}

export async function createSalesRep(
  _state: SalesRepActionState,
  formData: FormData
): Promise<SalesRepActionState> {
  await requireAdmin();

  const validated = CreateSalesRepSchema.safeParse(parseCreate(formData));
  if (!validated.success) return { errors: z.flattenError(validated.error).fieldErrors };

  const data = validated.data;

  const exists = await prisma.salesRepresentative.findUnique({ where: { email: data.email } });
  if (exists) return { errors: { email: ["A sales rep with this email already exists."] } };

  if (data.loginId && await isLoginIdTaken(data.loginId, undefined, "SALES_REP")) {
    return { errors: { loginId: ["This Login ID is already in use."] } };
  }

  const placeholder = randomPlaceholderPassword();
  const hashed      = await hashPassword(placeholder);
  const { token, expiry } = generateResetToken();

  let createdRepId: string;
  try {
    const created = await prisma.salesRepresentative.create({
      data: {
        ...data,
        name:               `${data.firstName} ${data.lastName}`,
        password:           hashed,
        commission:         data.commission ?? 0,
        passwordResetToken: token,
        passwordResetExpiry: expiry,
      },
    });
    createdRepId = created.id;
  } catch (err) {
    const field = duplicateKeyField(err);
    if (field === "loginId") return { errors: { loginId: ["This Login ID is already in use."] } };
    if (field === "email")   return { errors: { email: ["A sales rep with this email already exists."] } };
    throw err;
  }

  // Send password setup email
  const { subject, html } = passwordSetupEmail({
    firstName: data.firstName + " " +data.lastName,
    email:     data.email,
    resetToken: token,
    role:      "salesRep",
  });
  // Awaited — an un-awaited send can get cut off when the serverless
  // function freezes right after this action returns (Vercel), even though
  // it always finishes fine on a long-running local dev server.
  try {
    await sendMail({ to: data.email, subject, html, type: "Welcome Email", relatedId: createdRepId });
  } catch (err) {
    console.error("[email] salesRepSetupPassword failed:", err);
  }

  revalidatePath("/admin/sales-reps");
  return { success: true, message: "Sales representative created successfully." };
}

export async function updateSalesRep(
  id: string,
  _state: SalesRepActionState,
  formData: FormData
): Promise<SalesRepActionState> {
  await requireAdmin();

  const validated = UpdateSalesRepSchema.safeParse(parseUpdate(formData));
  if (!validated.success) return { errors: z.flattenError(validated.error).fieldErrors };

  const existing = await prisma.salesRepresentative.findUnique({ where: { id } });
  if (!existing) return { message: "Sales representative not found." };

  const data = validated.data;

  if (data.email && data.email !== existing.email) {
    const taken = await prisma.salesRepresentative.findUnique({ where: { email: data.email } });
    if (taken) return { errors: { email: ["This email is already in use."] } };
  }

  if (data.loginId && await isLoginIdTaken(data.loginId, id, "SALES_REP")) {
    return { errors: { loginId: ["This Login ID is already in use."] } };
  }

  const firstName = data.firstName ?? existing.firstName;
  const lastName  = data.lastName  ?? existing.lastName;

  try {
    await prisma.salesRepresentative.update({
      where: { id },
      data: { ...data, name: `${firstName} ${lastName}` },
    });
  } catch (err) {
    const field = duplicateKeyField(err);
    if (field === "loginId") return { errors: { loginId: ["This Login ID is already in use."] } };
    if (field === "email")   return { errors: { email: ["This email is already in use."] } };
    throw err;
  }

  revalidatePath("/admin/sales-reps");
  revalidatePath(`/admin/sales-reps/${id}`);
  return { success: true, message: "Sales representative updated successfully." };
}

export async function updateSalesRepCommission(
  id: string,
  commission: number,
): Promise<SalesRepActionState> {
  await requireAdmin();

  if (commission < 0 || commission > 100) {
    return { message: "Commission must be between 0 and 100." };
  }

  const existing = await prisma.salesRepresentative.findUnique({ where: { id } });
  if (!existing) return { message: "Sales representative not found." };

  await prisma.salesRepresentative.update({ where: { id }, data: { commission } });

  revalidatePath("/admin/physicians");
  revalidatePath("/admin/sales-reps");
  revalidatePath(`/admin/sales-reps/${id}`);
  return { success: true, message: "Commission updated." };
}

export async function getSalesRepOrders(id: string, opts?: { skip?: number; take?: number }) {
  await requireAdmin();
  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where:   { salesRepId: id },
      select: {
        id: true, orderNumber: true, status: true,
        total: true, subtotal: true, shippingRate: true,
        paymentMethod: true, paymentStatus: true,
        salesRepCommissionRate: true, salesRepCommissionAmount: true,
        shippingCarrier: true, trackingNumber: true,
        placedByAdmin: true,
        physician: { select: { firstName: true, lastName: true, nameOfPractice: true } },
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      skip: opts?.skip,
      take: opts?.take,
    }),
    prisma.order.count({ where: { salesRepId: id } }),
  ]);
  return { orders, total };
}

export async function deleteSalesRep(id: string): Promise<SalesRepActionState> {
  await requireAdmin();
  const existing = await prisma.salesRepresentative.findUnique({ where: { id } });
  if (!existing) return { message: "Sales representative not found." };
  await prisma.salesRepresentative.delete({ where: { id } });
  revalidatePath("/admin/sales-reps");
  return { success: true, message: "Sales representative deleted." };
}

export async function listSalesReps(opts?: { skip?: number; take?: number }) {
  await requireAdmin();
  const [reps, total] = await Promise.all([
    prisma.salesRepresentative.findMany({
      select: {
        id: true, name: true, firstName: true, lastName: true,
        email: true, loginId: true, phone: true, commission: true, ordersCount: true, createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      skip: opts?.skip,
      take: opts?.take,
    }),
    prisma.salesRepresentative.count(),
  ]);
  return { reps, total };
}

export async function getAllSalesRepsForExport() {
  await requireAdmin();
  return prisma.salesRepresentative.findMany({
    select: {
      id: true, name: true, firstName: true, lastName: true,
      email: true, loginId: true, phone: true, commission: true, ordersCount: true, walletBalance: true,
      billingAddress: true, shippingAddress: true,
      bankName: true, bankAccountNumber: true, bankAccountName: true,
      swiftCode: true, routingNumber: true,
      createdAt: true,
      physicians: {
        select: { firstName: true, lastName: true, email: true, state: true, nameOfPractice: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getSalesRepById(id: string) {
  await requireAdmin();
  return prisma.salesRepresentative.findUnique({
    where: { id },
    select: {
      id: true, name: true, firstName: true, lastName: true, email: true,
      loginId: true,
      phone: true, website: true, commission: true, ordersCount: true, walletBalance: true,
      billingAddress: true, shippingAddress: true,
      bankName: true, bankAccountNumber: true, bankAccountName: true, swiftCode: true, routingNumber: true,
      createdAt: true, updatedAt: true,
      physicians: {
        select: {
          id: true, firstName: true, lastName: true, email: true,
          nameOfPractice: true, credential: true, uplineCommission: true, commission: true,
          ordersCount: true, createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
}
