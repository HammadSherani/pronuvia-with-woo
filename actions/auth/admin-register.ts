"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";
import { z } from "zod";
import { createSession } from "@/lib/auth/session";
import { AdminRegisterSchema } from "@/lib/validations/auth";
import { Role } from "@/generated/prisma/enums";

export type AdminRegisterState = {
  errors?: {
    email?: string[];
    password?: string[];
    setupToken?: string[];
  };
  message?: string;
} | undefined;

export async function adminRegister(
  _state: AdminRegisterState,
  formData: FormData
): Promise<AdminRegisterState> {
  const raw = {
    email: formData.get("email"),
    password: formData.get("password"),
    setupToken: formData.get("setupToken"),
  };

  const validated = AdminRegisterSchema.safeParse(raw);
  if (!validated.success) {
    return { errors: z.flattenError(validated.error).fieldErrors };
  }

  const { email, password, setupToken } = validated.data;

  const expectedToken = process.env.ADMIN_SETUP_TOKEN;
  if (!expectedToken || setupToken !== expectedToken) {
    return { message: "Invalid setup token." };
  }

  try {
    const existingAdmin = await prisma.admin.findFirst();
    if (existingAdmin) {
      return { message: "An admin account already exists." };
    }

    const existingEmail = await prisma.admin.findUnique({ where: { email } });
    if (existingEmail) {
      return { errors: { email: ["This email is already in use."] } };
    }

    const hashed = await hashPassword(password);
    const admin = await prisma.admin.create({
      data: { email, password: hashed },
    });

    await createSession(admin.id, Role.ADMIN, admin.email);
    redirect("/admin/dashboard");
  } catch (err) {
    if (err != null && typeof err === "object" && "digest" in err) throw err;
    console.error("[adminRegister]", err);
    return { message: "Unable to connect to database. Please try again." };
  }
}

