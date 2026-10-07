import { z } from "zod";

// Allows email-style Login IDs (e.g. "info.pronuvia@gmail.com") so doctors
// migrated from the old system who used their email as their Login ID keep
// working, alongside plain-username-style IDs.
export const LOGIN_ID_REGEX = /^[a-z0-9._@+-]{3,64}$/;

export const LoginIdSchema = z
  .string()
  .min(3, "Login ID must be at least 3 characters")
  .max(64, "Login ID must be at most 64 characters")
  .regex(/^[a-zA-Z0-9._@+-]+$/, "Login ID can only contain letters, numbers, dots, underscores, hyphens, @ and +")
  .trim()
  .toLowerCase()
  .refine((val) => LOGIN_ID_REGEX.test(val), {
    message: "Login ID must be 3–64 characters (letters, numbers, dots, underscores, hyphens, @ and +)",
  });

export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function normalizeLoginIdentifier(value: string): string {
  return value.trim().toLowerCase();
}
