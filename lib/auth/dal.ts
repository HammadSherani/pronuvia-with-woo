import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getSession, type SessionPayload } from "./session";
import { prisma } from "@/lib/db/prisma";
import { Role } from "@/generated/prisma/enums";

export const getCurrentSession = cache(async (): Promise<SessionPayload | null> => {
  return getSession();
});

export const requireAuth = cache(async (): Promise<SessionPayload> => {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  return session;
});

export const requireRole = cache(
  async (...roles: Role[]): Promise<SessionPayload> => {
    const session = await requireAuth();
    if (!roles.includes(session.role)) redirect("/login");
    return session;
  }
);

export const requireAdmin = cache(async (): Promise<SessionPayload> => {
  return requireRole(Role.ADMIN);
});

export const requireSalesRep = cache(async (): Promise<SessionPayload> => {
  return requireRole(Role.SALES_REP);
});

export const requireAdminOrSalesRep = cache(async (): Promise<SessionPayload> => {
  return requireRole(Role.ADMIN, Role.SALES_REP);
});

export const requirePhysician = cache(async (): Promise<SessionPayload> => {
  return requireRole(Role.PHYSICIAN);
});

export async function getAdminById(id: string) {
  return prisma.admin.findUnique({
    where: { id },
    select: { id: true, email: true, createdAt: true },
  });
}

export async function getSalesRepById(id: string) {
  return prisma.salesRepresentative.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      firstName: true,
      lastName: true,
      email: true,
      website: true,
      phone: true,
      ordersCount: true,
      commission: true,
      createdAt: true,
    },
  });
}

export async function getPhysicianById(id: string) {
  return prisma.partneringPhysician.findUnique({
    where: { id },
    select: {
      id: true,
      isApproved: true,
      firstName: true,
      lastName: true,
      email: true,
      aictherapy: true,
      license: true,
      websiteLink: true,
      addressOne: true,
      addressTwo: true,
      city: true,
      state: true,
      zipCode: true,
      phone: true,
      officeContactNumber: true,
      fax: true,
      nameOfPractice: true,
      yearsInPractice: true,
      fieldsOfSpeciality: true,
      commission: true,
      addedByRole: true,
      addedByAdminId: true,
      salesRepId: true,
      createdAt: true,
    },
  });
}

