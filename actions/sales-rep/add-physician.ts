"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireSalesRep } from "@/lib/auth/dal";
import { z } from "zod";
import { hashPassword } from "@/lib/auth/password";
import { CreatePhysicianSchema } from "@/lib/validations/physician";
import { Role, ApprovalStatus } from "@/generated/prisma/enums";
import { sendMail }                                              from "@/lib/email/mailer";
import { doctorRegistrationEmail, salesRepDoctorSignupEmail }   from "@/lib/email/templates";
import { isLoginIdTaken } from "@/lib/auth/physician-lookup";
import { duplicateKeyField } from "@/lib/db/prisma-errors";

export type AddPhysicianState = {
  errors?:  Record<string, string[]>;
  message?: string;
  success?: boolean;
  values?:  Record<string, string>;
} | undefined;

export async function salesRepAddPhysician(
  _state: AddPhysicianState,
  formData: FormData
): Promise<AddPhysicianState> {
  const session = await requireSalesRep();

  const raw = {
    firstName: formData.get("firstName") as string,
    lastName: formData.get("lastName") as string,
    email: formData.get("email") as string,
    loginId: formData.get("loginId") as string,
    password: (formData.get("password") as string) ?? "",
    confirmPassword: (formData.get("confirmPassword") as string) ?? "",
    aictherapy: (formData.get("aictherapy") as string) || undefined,
    license: (formData.get("license") as string) || undefined,
    websiteLink: (formData.get("websiteLink") as string) || undefined,
    addressOne: (formData.get("addressOne") as string) || undefined,
    addressTwo: (formData.get("addressTwo") as string) || undefined,
    city: (formData.get("city") as string) || undefined,
    state: (formData.get("state") as string) || undefined,
    zipCode: (formData.get("zipCode") as string) || undefined,
    country: (formData.get("country") as string) || undefined,
    phone: (formData.get("phone") as string) || undefined,
    officeContactNumber: (formData.get("officeContactNumber") as string) || undefined,
    fax: (formData.get("fax") as string) || undefined,
    nameOfPractice: (formData.get("nameOfPractice") as string) || undefined,
    yearsInPractice: (formData.get("yearsInPractice") as string) || undefined,
    credential: (formData.get("credential") as string) || undefined,
    patientsPerMonth: (formData.get("patientsPerMonth") as string) || undefined,
    bankName: (formData.get("bankName") as string) || undefined,
    swiftCode: (formData.get("swiftCode") as string) || undefined,
    bankAccountName: (formData.get("bankAccountName") as string) || undefined,
    bankAccountNumber: (formData.get("bankAccountNumber") as string) || undefined,
    routingNumber: (formData.get("routingNumber") as string) || undefined,
    fieldsOfSpeciality: formData.get("fieldsOfSpeciality")
      ? JSON.parse(formData.get("fieldsOfSpeciality") as string)
      : [],
    commission: 0, // only admin can set commission
  };

  const { password: _rawPassword, confirmPassword: _rawConfirmPassword, ...rawForValues } = raw;
  const strValues: Record<string, string> = Object.fromEntries(
    Object.entries(rawForValues).map(([k, v]) => [k, String(v ?? "")])
  );

  const validated = CreatePhysicianSchema.safeParse(raw);
  const allErrors: Record<string, string[]> = validated.success
    ? {}
    : (z.flattenError(validated.error).fieldErrors as Record<string, string[]>);

  if (!raw.phone?.trim())          allErrors.phone          ??= ["Phone number is required."];
  if (!raw.nameOfPractice?.trim()) allErrors.nameOfPractice ??= ["Name of practice is required."];
  if (!raw.license?.trim())        allErrors.license        ??= ["License number is required."];
  if (!raw.addressOne?.trim())     allErrors.addressOne     ??= ["Address line 1 is required."];
  if (!raw.city?.trim())           allErrors.city           ??= ["City is required."];
  if (!raw.country?.trim())        allErrors.country        ??= ["Country is required."];
  if (!raw.state?.trim())          allErrors.state          ??= ["State is required."];
  if (!raw.zipCode?.trim())        allErrors.zipCode        ??= ["ZIP code is required."];
  if (validated.success && validated.data.fieldsOfSpeciality.length === 0) {
    allErrors.fieldsOfSpeciality ??= ["Please enter at least one specialty and click the Add button"];
  }

  if (Object.keys(allErrors).length > 0 || !validated.success) {
    return { errors: allErrors, values: strValues };
  }

  const exists = await prisma.partneringPhysician.findUnique({
    where: { email: validated.data.email },
  });
  if (exists) {
    return { errors: { email: ["A physician with this email already exists."] }, values: strValues };
  }

  if (await isLoginIdTaken(validated.data.loginId)) {
    return { errors: { loginId: ["This Login ID is already in use."] }, values: strValues };
  }

  if (validated.data.license) {
    const licenseExists = await prisma.partneringPhysician.findFirst({
      where: { license: validated.data.license },
    });
    if (licenseExists) {
      return { errors: { license: ["This license number is already registered with another physician."] }, values: strValues };
    }
  }

  const salesRepNote = (formData.get("salesRepNote") as string)?.trim() || null;

  // Password is set directly from the form so the physician can log in with
  // it immediately — no separate "set your password" step required.
  const { password, confirmPassword: _confirmPassword, ...rest } = validated.data;
  const hashed = await hashPassword(password);

  // Sales rep-added physicians are PENDING until admin approves (no setup email until approval)
  try {
    await prisma.partneringPhysician.create({
      data: {
        ...rest,
        password:          hashed,
        hasCustomPassword: true,
        salesRepNote,
        isApproved:  ApprovalStatus.PENDING,
        addedByRole: Role.SALES_REP,
        salesRepId:  session.userId,
        websiteLink: rest.websiteLink || null,
      },
    });
  } catch (err) {
    const field = duplicateKeyField(err);
    if (field === "loginId") return { errors: { loginId: ["This Login ID is already in use."] }, values: strValues };
    if (field === "email")   return { errors: { email: ["A physician with this email already exists."] }, values: strValues };
    throw err;
  }

  try {
    const salesRep = await prisma.salesRepresentative.findUnique({
      where: { id: session.userId },
      select: { firstName: true, lastName: true },
    });
    const { subject, html } = doctorRegistrationEmail({
      firstName:    validated.data.firstName,
      lastName:     validated.data.lastName,
      salesRepName: salesRep ? `${salesRep.firstName} ${salesRep.lastName}` : undefined,
    });
    await sendMail({ to: validated.data.email, subject, html });
  } catch (err) {
    console.error("[email] signup confirmation FAILED for", validated.data.email, err);
  }

  try {
    const { subject, html } = salesRepDoctorSignupEmail({
      doctorFirstName: validated.data.firstName,
      doctorLastName:  validated.data.lastName,
    });
    await sendMail({ to: session.email, subject, html });
  } catch (err) {
    console.error("[email] salesRep doctor signup notification FAILED for", session.email, err);
  }

  revalidatePath("/sales/physicians");
  revalidatePath("/admin/approvals");
  return {
    success: true,
    message: "Physician submitted for admin approval.",
  };
}

export async function listMyPhysicians(filters?: { approvalStatus?: ApprovalStatus }) {
  const session = await requireSalesRep();

  return prisma.partneringPhysician.findMany({
    where: {
      salesRepId: session.userId,
      ...(filters?.approvalStatus ? { isApproved: filters.approvalStatus } : {}),
    },
    select: {
      id: true,
      isApproved: true,
      firstName: true,
      lastName: true,
      email: true,
      loginId: true,
      nameOfPractice: true,
      phone: true,
      commission: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

