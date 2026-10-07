import { requireAdmin } from "@/lib/auth/dal";
import { prisma } from "@/lib/db/prisma";
import { PhysiciansPageClient } from "@/components/admin/physicians-page-client";

export const metadata = { title: "Physicians – Pronuvia Admin" };

export default async function PhysiciansPage() {
  await requireAdmin();

  const [physicians, total] = await Promise.all([
    prisma.partneringPhysician.findMany({
      select: {
        id: true, isApproved: true,
        firstName: true, lastName: true, email: true, loginId: true,
        nameOfPractice: true, phone: true, officeContactNumber: true, fax: true,
        addressOne: true, addressTwo: true, city: true, state: true, zipCode: true, country: true,
        license: true, aictherapy: true, websiteLink: true,
        fieldsOfSpeciality: true, yearsInPractice: true,
        credential: true, patientsPerMonth: true,
        commission: true, uplineCommission: true,
        walletBalance: true, ordersCount: true,
        addedByRole: true, salesRepId: true,
        salesRep: { select: { id: true, name: true, firstName: true, lastName: true, email: true, commission: true } },
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.partneringPhysician.count(),
  ]);

  return (
    <PhysiciansPageClient physicians={physicians} total={total} />
  );
}
