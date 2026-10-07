import { z } from "zod";
import { LoginIdSchema } from "@/lib/validations/login-id";

const CreatePhysicianBaseSchema = z.object({
  firstName:           z.string().min(1, "First name is required").trim(),
  lastName:            z.string().min(1, "Last name is required").trim(),
  email:               z.string().email("Invalid email address").trim().toLowerCase(),
  loginId:             LoginIdSchema,
  password:            z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword:     z.string().min(1, "Please confirm the password"),
  aictherapy:          z.string().optional(),
  license:             z.string().optional(),
  websiteLink:         z.string().optional(),
  addressOne:          z.string().optional(),
  addressTwo:          z.string().optional(),
  city:                z.string().optional(),
  state:               z.string({ error: "State / Province is required" }).min(1, "State / Province is required"),
  zipCode:             z.string().optional(),
  country:             z.string({ error: "Country is required" }).min(1, "Country is required"),
  phone:               z.string().optional(),
  officeContactNumber: z.string().optional(),
  fax:                 z.string().optional(),
  nameOfPractice:      z.string().optional(),
  yearsInPractice:     z.string({ error: "Years in practice is required" })
    .min(1, "Years in practice is required")
    .transform((val, ctx) => {
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
  fieldsOfSpeciality:  z.array(z.string()).optional().default([]),
  commission:          z.number().min(0).max(100).optional().default(0),
  uplineCommission:    z.number().min(0).max(100).optional().default(0),
  salesRepId:          z.string().optional(),
  bankName:            z.string().optional(),
  bankAccountNumber:   z.string().optional(),
  bankAccountName:     z.string().optional(),
  swiftCode:           z.string().optional(),
  routingNumber:       z.string().optional(),
});

export const CreatePhysicianSchema = CreatePhysicianBaseSchema.refine(
  (data) => data.password === data.confirmPassword,
  { message: "Passwords do not match", path: ["confirmPassword"] },
);

export const UpdatePhysicianSchema = z.object({
  firstName:           z.string().min(1).trim().optional(),
  lastName:            z.string().min(1).trim().optional(),
  email:               z.string().email().trim().toLowerCase().optional(),
  loginId:             LoginIdSchema.optional(),
  aictherapy:          z.string().optional(),
  license:             z.string().optional(),
  websiteLink:         z.string().optional(),
  addressOne:          z.string().optional(),
  addressTwo:          z.string().optional(),
  city:                z.string().optional(),
  state:               z.string().optional(),
  zipCode:             z.string().optional(),
  country:             z.string().optional(),
  phone:               z.string().optional(),
  officeContactNumber: z.string().optional(),
  fax:                 z.string().optional(),
  nameOfPractice:      z.string().optional(),
  yearsInPractice:     z.number().int().min(0).optional(),
  credential:          z.string().optional(),
  patientsPerMonth:    z.number().int().min(0).optional(),
  fieldsOfSpeciality:  z.array(z.string()).optional(),
  commission:          z.number().min(0).max(100).optional(),
  uplineCommission:    z.number().min(0).max(100).optional(),
  salesRepId:          z.string().optional(),
  bankName:            z.string().optional(),
  bankAccountNumber:   z.string().optional(),
  bankAccountName:     z.string().optional(),
  swiftCode:           z.string().optional(),
  routingNumber:       z.string().optional(),
});

export type CreatePhysicianInput = z.infer<typeof CreatePhysicianSchema>;
export type UpdatePhysicianInput = z.infer<typeof UpdatePhysicianSchema>;
