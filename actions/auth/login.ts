"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { z } from "zod";
import { createSession } from "@/lib/auth/session";
import { LoginSchema } from "@/lib/validations/auth";
import { findPhysicianByLoginIdentifier, findSalesRepByLoginIdentifier } from "@/lib/auth/physician-lookup";
import { isEmail } from "@/lib/validations/login-id";
import { Role } from "@/generated/prisma/enums";

// redirect() / notFound() throw objects with a `digest` field — must be re-thrown
function isNextInternalError(err: unknown): boolean {
  return err != null && typeof err === "object" && "digest" in err;
}

export type LoginState = {
  errors?: {
    email?: string[];
    password?: string[];
  };
  message?: string;
} | undefined;

const DASHBOARD_ROUTES: Record<Role, string> = {
  [Role.ADMIN]: "/admin/dashboard",
  [Role.SALES_REP]: "/sales/shop",
  [Role.PHYSICIAN]: "/physician/shop",
};

// Back to the page the user was sent to log in from (e.g. an order link in an
// email), when it is inside their own area; else their dashboard
function landing(role: Role, next: FormDataEntryValue | null): string {
  const prefix = { [Role.ADMIN]: "/admin/", [Role.SALES_REP]: "/sales/", [Role.PHYSICIAN]: "/physician/" }[role];
  return typeof next === "string" && next.startsWith(prefix) && !next.includes("//") ? next : DASHBOARD_ROUTES[role];
}

export async function login(
  _state: LoginState,
  formData: FormData
): Promise<LoginState> {
  const raw = {
    email: formData.get("email"),
    password: formData.get("password"),
  };

  const validated = LoginSchema.safeParse(raw);
  if (!validated.success) {
    return { errors: z.flattenError(validated.error).fieldErrors };
  }

  const { email, password } = validated.data;

  try {
    // Admin signs in with email only.
    if (isEmail(email)) {
      const admin = await prisma.admin.findUnique({ where: { email } });
      if (admin) {
        const valid = await verifyPassword(password, admin.password);
        if (!valid) return { message: "Invalid email or password." };
        await createSession(admin.id, Role.ADMIN, admin.email);
        redirect(landing(Role.ADMIN, formData.get("next")));
      }

    }

    // Medical reps and physicians can sign in with email or Login ID.
    const salesRep = await findSalesRepByLoginIdentifier(email);
    if (salesRep) {
      const valid = await verifyPassword(password, salesRep.password);
      if (!valid) return { message: "Invalid email or password." };
      await createSession(salesRep.id, Role.SALES_REP, salesRep.email);
      redirect(landing(Role.SALES_REP, formData.get("next")));
    }

    const physician = await findPhysicianByLoginIdentifier(email);
    if (physician) {
      if (physician.isApproved !== "APPROVED") {
        return {
          message:
            physician.isApproved === "PENDING"
              ? "Your account is pending admin approval."
              : "Your account has been rejected.",
        };
      }
      const valid = await verifyPassword(password, physician.password);
      if (!valid) return { message: "Invalid email or password." };
      await createSession(physician.id, Role.PHYSICIAN, physician.email);
      redirect(landing(Role.PHYSICIAN, formData.get("next")));
    }

    return { message: "Invalid email or password." };
  } catch (err) {
    // redirect() and notFound() in Next.js throw special objects with a `digest` — always re-throw
    if (isNextInternalError(err)) throw err;
    console.error("[login]", err);
    if (err instanceof Error && err.message.includes("SESSION_SECRET")) {
      return { message: "Server configuration error. Please contact support." };
    }
    return { message: "Unable to connect to the server. Please try again." };
  }
}
