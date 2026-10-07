import { z } from "zod";
import { LoginIdSchema } from "@/lib/validations/login-id";

export const CreateSalesRepSchema = z.object({
  firstName:         z.string().min(1, "First name is required").trim(),
  lastName:          z.string().min(1, "Last name is required").trim(),
  email:             z.string().email("Invalid email address").trim().toLowerCase(),
  loginId:           LoginIdSchema.optional(),
  phone:             z.string().optional(),
  commission:        z.number().min(0, "Must be ≥ 0").max(100, "Must be ≤ 100").default(0),
  billingAddress:    z.string().optional(),
  shippingAddress:   z.string().optional(),
  bankName:          z.string().optional(),
  bankAccountNumber: z.string().optional(),
  bankAccountName:   z.string().optional(),
  swiftCode:         z.string().optional(),
  routingNumber:     z.string().optional(),
});

export const UpdateSalesRepSchema = z.object({
  firstName:         z.string().min(1, "First name is required").trim().optional(),
  lastName:          z.string().min(1, "Last name is required").trim().optional(),
  email:             z.string().email("Invalid email address").trim().toLowerCase().optional(),
  loginId:           LoginIdSchema.optional(),
  phone:             z.string().optional(),
  commission:        z.number().min(0).max(100).optional(),
  billingAddress:    z.string().optional(),
  shippingAddress:   z.string().optional(),
  bankName:          z.string().optional(),
  bankAccountNumber: z.string().optional(),
  bankAccountName:   z.string().optional(),
  swiftCode:         z.string().optional(),
  routingNumber:     z.string().optional(),
});

export type CreateSalesRepInput = z.infer<typeof CreateSalesRepSchema>;
export type UpdateSalesRepInput = z.infer<typeof UpdateSalesRepSchema>;
