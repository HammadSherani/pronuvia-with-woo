"use server";

import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requirePhysician } from "@/lib/auth/dal";

const Schema = z.object({
  firstName:           z.string().min(1, "First name is required"),
  lastName:            z.string().min(1, "Last name is required"),
  phone:               z.string().min(1, "Phone is required"),
  officeContactNumber: z.string().min(1, "Office contact is required"),
  fax:                 z.string().min(1, "Fax is required"),
  nameOfPractice:      z.string().min(1, "Practice name is required"),
  license:             z.string().min(1, "License number is required"),
  yearsInPractice:     z.coerce.number().min(0, "Must be 0 or more"),
  credential:          z.string().optional(),
  patientsPerMonth:    z.coerce.number().min(0, "Must be 0 or more").optional(),
  aictherapy:          z.string().min(1, "This field is required"),
  websiteLink:         z.string().url("Enter a valid URL (https://...)").optional().or(z.literal("")),
  addressOne:          z.string().min(1, "Address is required"),
  addressTwo:          z.string().optional(),
  city:                z.string().min(1, "City is required"),
  state:               z.string().min(1, "State is required"),
  zipCode:             z.string().min(1, "Zip code is required"),
  bankName:            z.string().optional(),
  bankAccountName:     z.string().optional(),
  bankAccountNumber:   z.string().optional(),
  bankAccountType:     z.enum(["CHECKING", "SAVINGS"]).optional(),
  bankOwnershipType:   z.enum(["PERSONAL", "BUSINESS"]).optional(),
  swiftCode:           z.string().optional(),
  routingNumber:       z.string().optional(),
});

export type UpdateProfileState = {
  errors?: Record<string, string[]>;
  message?: string;
  success?: boolean;
} | undefined;

export async function updatePhysicianProfile(
  _state: UpdateProfileState,
  formData: FormData,
): Promise<UpdateProfileState> {
  const session = await requirePhysician();

  const raw = {
    firstName:           (formData.get("firstName") as string)?.trim(),
    lastName:            (formData.get("lastName") as string)?.trim(),
    phone:               (formData.get("phone") as string)?.trim(),
    officeContactNumber: (formData.get("officeContactNumber") as string)?.trim(),
    fax:                 (formData.get("fax") as string)?.trim(),
    nameOfPractice:      (formData.get("nameOfPractice") as string)?.trim(),
    license:             (formData.get("license") as string)?.trim(),
    yearsInPractice:     formData.get("yearsInPractice") || undefined,
    credential:          (formData.get("credential") as string)?.trim() || undefined,
    patientsPerMonth:    formData.get("patientsPerMonth") || undefined,
    aictherapy:          (formData.get("aictherapy") as string)?.trim(),
    websiteLink:         (formData.get("websiteLink") as string)?.trim(),
    addressOne:          (formData.get("addressOne") as string)?.trim(),
    addressTwo:          (formData.get("addressTwo") as string) || undefined,
    city:                (formData.get("city") as string)?.trim(),
    state:               (formData.get("state") as string)?.trim(),
    zipCode:             (formData.get("zipCode") as string)?.trim(),
    bankName:            (formData.get("bankName") as string)?.trim() || undefined,
    bankAccountName:     (formData.get("bankAccountName") as string)?.trim() || undefined,
    bankAccountNumber:   (formData.get("bankAccountNumber") as string)?.trim() || undefined,
    bankAccountType:     (formData.get("bankAccountType") as string)?.trim() || undefined,
    bankOwnershipType:   (formData.get("bankOwnershipType") as string)?.trim() || undefined,
    swiftCode:           (formData.get("swiftCode") as string)?.trim() || undefined,
    routingNumber:       (formData.get("routingNumber") as string)?.trim() || undefined,
  };

  const validated = Schema.safeParse(raw);
  if (!validated.success) {
    return { errors: z.flattenError(validated.error).fieldErrors };
  }

  const specialtiesRaw = formData.get("fieldsOfSpeciality") as string;
  const fieldsOfSpeciality: string[] = specialtiesRaw ? JSON.parse(specialtiesRaw) : [];

  if (fieldsOfSpeciality.length === 0) {
    return { errors: { fieldsOfSpeciality: ["Please select at least one specialty"] } };
  }

  if (validated.data.license) {
    const licenseExists = await prisma.partneringPhysician.findFirst({
      where: { license: validated.data.license, NOT: { id: session.userId } },
    });
    if (licenseExists) {
      return { errors: { license: ["This license number is already registered with another physician."] } };
    }
  }

  await prisma.partneringPhysician.update({
    where: { id: session.userId },
    data: {
      ...validated.data,
      fieldsOfSpeciality,
      // Clear notify flag once bank details are provided
      ...(validated.data.bankName ? { bankNotifyRequested: false } : {}),
    },
  });

  return { success: true, message: "Profile updated successfully." };
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

export async function updatePhysicianBankDetails(
  _state: UpdateProfileState,
  formData: FormData,
): Promise<UpdateProfileState> {
  const session = await requirePhysician();

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

  await prisma.partneringPhysician.update({
    where: { id: session.userId },
    data: { ...validated.data, bankNotifyRequested: false },
  });

  return { success: true, message: "Bank details saved." };
}
