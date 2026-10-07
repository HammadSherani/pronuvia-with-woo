import { Prisma } from "@/generated/prisma/client";

/**
 * Returns the field name a Prisma unique-constraint violation (P2002) was
 * on, or null if `error` isn't one. Used to turn a raw duplicate-key crash
 * from a race condition (two near-simultaneous submits past the app-level
 * uniqueness check) into the same clean field error the app-level check
 * would have produced.
 */
export function duplicateKeyField(error: unknown): string | null {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return null;
  const target = error.meta?.target;
  if (Array.isArray(target) && target.length) return String(target[0]);
  if (typeof target === "string") return target;
  return "value";
}
