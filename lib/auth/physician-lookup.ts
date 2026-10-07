import { prisma } from "@/lib/db/prisma";
import { normalizeLoginIdentifier } from "@/lib/validations/login-id";

export async function findPhysicianByLoginIdentifier(identifier: string) {
  const normalized = normalizeLoginIdentifier(identifier);

  return prisma.partneringPhysician.findFirst({
    where: {
      OR: [{ email: normalized }, { loginId: normalized }],
    },
  });
}

export async function findSalesRepByLoginIdentifier(identifier: string) {
  const normalized = normalizeLoginIdentifier(identifier);

  return prisma.salesRepresentative.findFirst({
    where: {
      OR: [{ email: normalized }, { loginId: normalized }],
    },
  });
}

export async function isLoginIdTaken(
  loginId: string,
  excludeId?: string,
  excludeRole: "PHYSICIAN" | "SALES_REP" = "PHYSICIAN",
): Promise<boolean> {
  const [physician, salesRep] = await Promise.all([
    prisma.partneringPhysician.findUnique({ where: { loginId }, select: { id: true } }),
    prisma.salesRepresentative.findUnique({ where: { loginId }, select: { id: true } }),
  ]);

  const physicianTaken = !!physician && !(excludeRole === "PHYSICIAN" && physician.id === excludeId);
  const salesRepTaken = !!salesRep && !(excludeRole === "SALES_REP" && salesRep.id === excludeId);
  return physicianTaken || salesRepTaken;
}
