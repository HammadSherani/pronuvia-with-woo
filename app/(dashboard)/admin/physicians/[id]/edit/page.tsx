import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/dal";
import { getPhysicianById, updatePhysician } from "@/actions/admin/manage-physicians";
import { listSalesReps } from "@/actions/admin/manage-sales-reps";
import { adminSetPassword, adminSendResetLink } from "@/actions/admin/reset-password";
import { PhysicianForm } from "@/components/admin/physician-form";
import { AdminPasswordReset } from "@/components/admin/admin-password-reset";

export const metadata = { title: "Edit Physician – Pronuvia Admin" };

type Props = { params: Promise<{ id: string }> };

export default async function EditPhysicianPage({ params }: Props) {
  await requireAdmin();
  const { id } = await params;

  const [p, { reps }] = await Promise.all([
    getPhysicianById(id),
    listSalesReps(),
  ]);
  if (!p) notFound();

  const boundUpdate     = updatePhysician.bind(null, id);
  const boundSetPw      = adminSetPassword.bind(null, id, "PHYSICIAN");
  const boundSendReset  = adminSendResetLink.bind(null, id, "PHYSICIAN");

  return (
    <div className="max-w-3xl">
      <Link href="/admin/physicians"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-5 transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to Physicians
      </Link>
      <h1 className="text-xl font-bold text-gray-800 mb-6">Edit Physician</h1>

      <AdminPasswordReset
        setPasswordAction={boundSetPw}
        sendResetLinkAction={boundSendReset}
      />

      <PhysicianForm
        action={boundUpdate}
        submitLabel="Save Changes"
        backHref="/admin/physicians"
        successRedirect="/admin/physicians"
        salesReps={reps.map((r) => ({ id: r.id, name: r.name, email: r.email }))}
        defaults={{
          firstName:           p.firstName,
          lastName:            p.lastName,
          email:               p.email,
          loginId:             p.loginId            ?? undefined,
          phone:               p.phone               ?? undefined,
          officeContactNumber: p.officeContactNumber  ?? undefined,
          fax:                 p.fax                  ?? undefined,
          aictherapy:          p.aictherapy           ?? undefined,
          license:             p.license              ?? undefined,
          websiteLink:         p.websiteLink          ?? undefined,
          addressOne:          p.addressOne           ?? undefined,
          addressTwo:          p.addressTwo           ?? undefined,
          city:                p.city                 ?? undefined,
          state:               p.state                ?? undefined,
          zipCode:             p.zipCode              ?? undefined,
          country:             p.country              ?? undefined,
          nameOfPractice:      p.nameOfPractice       ?? undefined,
          yearsInPractice:     p.yearsInPractice      ?? undefined,
          credential:          p.credential           ?? undefined,
          patientsPerMonth:    p.patientsPerMonth     ?? undefined,
          fieldsOfSpeciality:  p.fieldsOfSpeciality,
          commission:          p.commission,
          uplineCommission:    p.uplineCommission,
          salesRepId:          p.salesRepId           ?? undefined,
          salesRepName:        p.salesRep?.name,
          bankName:            p.bankName            ?? undefined,
          bankAccountNumber:   p.bankAccountNumber   ?? undefined,
          bankAccountName:     p.bankAccountName      ?? undefined,
          swiftCode:           p.swiftCode            ?? undefined,
          routingNumber:       p.routingNumber        ?? undefined,
        }}
      />
    </div>
  );
}
