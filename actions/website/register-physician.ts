"use server";

import { prisma }                       from "@/lib/db/prisma";
import { hashPassword }                 from "@/lib/auth/password";
import { Role, ApprovalStatus }         from "@/generated/prisma/enums";
import { z }                            from "zod";
import { sendMail }                     from "@/lib/email/mailer";
import { doctorRegistrationEmail, newPhysicianApplicationEmail } from "@/lib/email/templates";

// New applications are also sent here, for the team to review
const APPLICATIONS_TO = "pronuvia@gmail.com";
import { LoginIdSchema } from "@/lib/validations/login-id";
import { isLoginIdTaken } from "@/lib/auth/physician-lookup";
import { wooEmailTaken, wooEmailTakenMessage } from "@/lib/woo/customers";
import { duplicateKeyField } from "@/lib/db/prisma-errors";

const BaseSchema = z.object({
  email:               z.string().email("Valid email is required"),
  loginId:             LoginIdSchema,
  password:            z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword:     z.string().min(1, "Please confirm your password"),
  termsAccepted:       z.boolean().refine((accepted) => accepted, "You must agree to the Terms and Conditions"),
  firstName:           z.string().min(1, "First name is required"),
  lastName:            z.string().min(1, "Last name is required"),
  aictherapy:          z.string().min(1, "This field is required"),
  license:             z.string().min(1, "Doctor's license number is required"),
  websiteLink:         z.string().optional(),
  country:             z.string().min(1, "Country is required"),
  addressOne:          z.string().min(1, "Address is required"),
  addressTwo:          z.string().optional(),
  city:                z.string().min(1, "City is required"),
  state:               z.string().min(1, "State is required"),
  zipCode:             z.string().min(1, "Zip code is required"),
  phone:               z.string().min(1, "Phone is required"),
  officeContactNumber: z.string().min(1, "Office contact person is required"),
  fax:                 z.string().optional(),
  nameOfPractice:      z.string().min(1, "Name of practice is required"),
  yearsInPractice:     z.string()
    .min(1, "Years in practice is required")
    .transform((val, ctx) => {
      const n = Number(val);
      if (isNaN(n) || !Number.isInteger(n)) {
        ctx.addIssue({ code: "custom", message: "Must be a valid number" });
        return z.NEVER;
      }
      if (n < 0) {
        ctx.addIssue({ code: "custom", message: "Must be 0 or more" });
        return z.NEVER;
      }
      return n;
    }),
  credential:          z.string().optional(),
  patientsPerMonth:    z.string().optional()
    .transform((val, ctx) => {
      if (!val) return undefined;
      const n = Number(val);
      if (isNaN(n) || !Number.isInteger(n)) {
        ctx.addIssue({ code: "custom", message: "Must be a valid whole number" });
        return z.NEVER;
      }
      if (n < 0) {
        ctx.addIssue({ code: "custom", message: "Must be 0 or more" });
        return z.NEVER;
      }
      return n;
    }),
});

const Schema = BaseSchema.refine(
  (data) => data.password === data.confirmPassword,
  { message: "Passwords do not match", path: ["confirmPassword"] },
);

export type RegisterPhysicianState = {
  errors?:  Record<string, string[]>;
  message?: string;
  success?: boolean;
  values?:  Record<string, string>;
} | undefined;

export async function registerPhysician(
  _state: RegisterPhysicianState,
  formData: FormData
): Promise<RegisterPhysicianState> {
  const raw = {
    email:               (formData.get("email") as string)?.trim().toLowerCase(),
    loginId:             (formData.get("loginId") as string)?.trim(),
    password:            (formData.get("password") as string) ?? "",
    confirmPassword:     (formData.get("confirmPassword") as string) ?? "",
    termsAccepted:       formData.get("termsAccepted") === "true",
    firstName:           (formData.get("firstName") as string)?.trim(),
    lastName:            (formData.get("lastName") as string)?.trim(),
    aictherapy:          (formData.get("aictherapy") as string)?.trim(),
    license:             (formData.get("license") as string)?.trim(),
    websiteLink:         (formData.get("websiteLink") as string)?.trim(),
    country:             (formData.get("country") as string)?.trim(),
    addressOne:          (formData.get("addressOne") as string)?.trim(),
    addressTwo:          (formData.get("addressTwo") as string) || undefined,
    city:                (formData.get("city") as string)?.trim(),
    state:               (formData.get("state") as string)?.trim() ?? "",
    zipCode:             (formData.get("zipCode") as string)?.trim(),
    phone:               (formData.get("phone") as string)?.trim(),
    officeContactNumber: (formData.get("officeContactNumber") as string)?.trim(),
    fax:                 (formData.get("fax") as string)?.trim(),
    nameOfPractice:      (formData.get("nameOfPractice") as string)?.trim(),
    yearsInPractice:     (formData.get("yearsInPractice") as string) ?? "",
    credential:          (formData.get("credential") as string)?.trim() || undefined,
    patientsPerMonth:    (formData.get("patientsPerMonth") as string) || undefined,
  };

  const { password: _rawPassword, confirmPassword: _rawConfirmPassword, ...rawForValues } = raw;
  const strValues: Record<string, string> = Object.fromEntries(
    Object.entries(rawForValues).map(([k, v]) => [k, String(v ?? "")])
  );

  const validated = Schema.safeParse(raw);
  if (!validated.success) {
    return { errors: z.flattenError(validated.error).fieldErrors, values: strValues };
  }

  const { termsAccepted, ...validatedProfile } = validated.data;
  if (!termsAccepted) {
    return { message: "You must agree to the Terms and Conditions.", values: strValues };
  }

  const specialtiesRaw = formData.get("fieldsOfSpeciality") as string;
  const fieldsOfSpeciality: string[] = specialtiesRaw ? JSON.parse(specialtiesRaw) : [];

  if (fieldsOfSpeciality.length === 0) {
    return { errors: { fieldsOfSpeciality: ["Please enter at least one specialty and click the Add button"] }, values: strValues };
  }

  const exists = await prisma.partneringPhysician.findUnique({
    where: { email: validated.data.email },
  });
  if (exists) {
    return { errors: { email: ["An account with this email already exists."] }, values: strValues };
  }
  // A WP account with this email that no current Pronuvia user has (e.g. left
  // by a deleted user) blocks the new account
  const takenInWp = await wooEmailTaken(validated.data.email);
  if (takenInWp) {
    return { errors: { email: [wooEmailTakenMessage(takenInWp, false)] }, values: strValues };
  }

  if (await isLoginIdTaken(validated.data.loginId)) {
    return { errors: { loginId: ["This Login ID is already in use."] }, values: strValues };
  }

  const licenseExists = await prisma.partneringPhysician.findFirst({
    where: { license: validated.data.license },
  });
  if (licenseExists) {
    return { errors: { license: ["This license number is already registered with another physician."] }, values: strValues };
  }

  // Password is set directly from the form so the physician can log in with
  // it immediately once approved — no separate "set your password" step required.
  const { password, confirmPassword: _confirmPassword, ...rest } = validatedProfile;
  const hashed = await hashPassword(password);

  let createdId: string;
  try {
    ({ id: createdId } = await prisma.partneringPhysician.create({
      data: {
        ...rest,
        password:          hashed,
        hasCustomPassword: true,
        fieldsOfSpeciality,
        isApproved:        ApprovalStatus.PENDING,
        addedByRole:       Role.PHYSICIAN,
        commission:        0,
        uplineCommission:  0,
      },
      select: { id: true },
    }));
  } catch (err) {
    const field = duplicateKeyField(err);
    if (field === "loginId") return { errors: { loginId: ["This Login ID is already in use."] }, values: strValues };
    if (field === "email")   return { errors: { email: ["An account with this email already exists."] }, values: strValues };
    throw err;
  }

  try {
    const { subject, html } = doctorRegistrationEmail({
      firstName: validated.data.firstName,
      lastName:  validated.data.lastName,
    });
    await sendMail({ to: validated.data.email, subject, html });
  } catch (err) {
    console.error("[email] signup confirmation FAILED for", validated.data.email, err);
  }

  // The team is told about the new application
  try {
    const d = validated.data;
    const { subject, html } = newPhysicianApplicationEmail({
      physicianId: createdId,
      firstName: d.firstName, lastName: d.lastName, email: d.email, loginId: d.loginId, phone: d.phone,
      nameOfPractice: d.nameOfPractice, license: d.license, fieldsOfSpeciality,
      address: [d.addressOne, d.addressTwo, [d.city, d.state, d.zipCode].filter(Boolean).join(", "), d.country].filter(Boolean).join(", "),
    });
    await sendMail({ to: APPLICATIONS_TO, subject, html, type: "New Physician Application", relatedId: createdId });
  } catch (err) {
    console.error("[email] new application notice FAILED:", err);
  }

  return {
    success: true,
    message: "Your application has been submitted! We will review it and notify you by email once approved — you can then log in with the password you just created.",
  };
}
