import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/dal";
import { getPhysicianById, updatePhysician } from "@/actions/admin/manage-physicians";
import { listSalesReps } from "@/actions/admin/manage-sales-reps";
import { PhysicianForm } from "@/components/admin/physician-form";

export const metadata = { title: "Edit Pending Physician – Pronuvia Admin" };

type Props = { params: Promise<{ id: string }> };

export default async function EditPendingPhysicianPage({ params }: Props) {
  await requireAdmin();
  const { id } = await params;

  const [p, { reps }] = await Promise.all([
    getPhysicianById(id),
    listSalesReps(),
  ]);
  if (!p) notFound();

  const boundUpdate = updatePhysician.bind(null, id);

  return (
    <div className="max-w-3xl">
      <Link
        href={`/admin/approvals/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-5 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to Review
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-800">
            Edit Physician — {p.firstName} {p.lastName}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Changes will be saved. The application will remain pending until approved.
          </p>
        </div>
        <span className="ml-auto shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          Pending Approval
        </span>
      </div>

      <PhysicianForm
        action={boundUpdate}
        submitLabel="Save Changes"
        backHref={`/admin/approvals/${id}`}
        successRedirect={`/admin/approvals/${id}`}
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
          bankName:            p.bankName             ?? undefined,
          bankAccountNumber:   p.bankAccountNumber    ?? undefined,
          bankAccountName:     p.bankAccountName      ?? undefined,
          swiftCode:           p.swiftCode            ?? undefined,
          routingNumber:       p.routingNumber        ?? undefined,
        }}
      />
    </div>
  );
}
