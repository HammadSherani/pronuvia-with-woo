import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/dal";
import { getPhysicianById } from "@/actions/admin/manage-physicians";
import { ApprovalStatus } from "@/generated/prisma/enums";
import { PhysicianApprovalActions } from "@/components/admin/physician-approval-actions";
import { formatDateLong } from "@/lib/utils/timezone";

type Props = { params: Promise<{ id: string }> };

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs text-gray-400 font-medium mb-0.5">{label}</dt>
      <dd className="text-sm text-gray-700">{value || <span className="text-gray-300">—</span>}</dd>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-5">
      <h2 className="text-sm font-semibold text-gray-700 mb-4 pb-3 border-b border-gray-100">{title}</h2>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4">{children}</dl>
    </div>
  );
}

const statusBadge: Record<ApprovalStatus, { label: string; cls: string }> = {
  APPROVED: { label: "Approved", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  PENDING:  { label: "Pending",  cls: "bg-amber-50 text-amber-700 border-amber-200" },
  REJECTED: { label: "Rejected", cls: "bg-red-50 text-red-700 border-red-200" },
};

export default async function PhysicianViewPage({ params }: Props) {
  await requireAdmin();
  const { id } = await params;

  const p = await getPhysicianById(id);
  if (!p) notFound();

  const badge = statusBadge[p.isApproved];

  return (
    <div className="max-w-3xl">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6">
        <Link href="/admin/physicians"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Physicians
        </Link>
        <div className="flex items-center gap-2">
          {p.isApproved === ApprovalStatus.PENDING && (
            <PhysicianApprovalActions
              physicianId={id}
              physicianName={` ${p.firstName} ${p.lastName}`}
            />
          )}
          <Link href={`/admin/physicians/${id}/edit`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#3DBFA4] text-white text-sm font-medium rounded-lg hover:bg-[#35a993] transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit
          </Link>
        </div>
      </div>

      {/* Avatar + name */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-16 h-16 rounded-full bg-[#5BB8D4]/10 flex items-center justify-center shrink-0">
          <span className="text-2xl font-bold text-[#5BB8D4]">
            {p.firstName[0]}{p.lastName[0]}
          </span>
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900"> {p.firstName} {p.lastName}</h1>
          <p className="text-sm text-gray-500">{p.email}</p>
          {p.nameOfPractice && <p className="text-xs text-gray-400 mt-0.5">{p.nameOfPractice}</p>}
        </div>
        <div className="ml-auto flex flex-col items-end gap-2">
          <span className={`inline-flex items-center px-3 py-1 border rounded-full text-xs font-medium ${badge.cls}`}>
            {badge.label}
          </span>
          <span className="inline-flex px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-medium">
            Doctor: {p.commission}%
          </span>
          {p.uplineCommission > 0 && (
            <span className="inline-flex px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-xs font-medium">
              Upline: {p.uplineCommission}%
            </span>
          )}
        </div>
      </div>

      <Card title="Personal Information">
        <InfoRow label="First Name" value={p.firstName} />
        <InfoRow label="Last Name" value={p.lastName} />
        <InfoRow label="Email" value={p.email} />
        <InfoRow label="Login ID / Username" value={p.loginId || "Not set"} />
        <InfoRow label="Phone" value={p.phone} />
        <InfoRow label="Office Contact" value={p.officeContactNumber} />
        <InfoRow label="Fax" value={p.fax} />
      </Card>

      <Card title="Practice Information">
        <InfoRow label="Name of Practice" value={p.nameOfPractice} />
        <InfoRow label="Years in Practice" value={p.yearsInPractice != null ? String(p.yearsInPractice) : null} />
        <InfoRow label="Credential" value={p.credential} />
        <InfoRow label="Patients Seen Per Month" value={p.patientsPerMonth != null ? String(p.patientsPerMonth) : null} />
        <InfoRow label="License Number" value={p.license} />
        <InfoRow label="How did you hear about AIC Therapy? " value={p.aictherapy} />
        <div className="col-span-2">
          <InfoRow label="Website" value={p.websiteLink} />
        </div>
      </Card>

      <Card title="Practice Address">
        <div className="col-span-2">
          <InfoRow label="Address Line 1" value={p.addressOne} />
        </div>
        <div className="col-span-2">
          <InfoRow label="Address Line 2" value={p.addressTwo} />
        </div>
        <InfoRow label="City" value={p.city} />
        <InfoRow label="State" value={p.state} />
        <InfoRow label="ZIP Code" value={p.zipCode} />
        <InfoRow label="Country" value={p.country} />
      </Card>

      {/* Specialties */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4 pb-3 border-b border-gray-100">Fields of Speciality</h2>
        {p.fieldsOfSpeciality.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {p.fieldsOfSpeciality.map((s) => (
              <span key={s} className="px-3 py-1.5 bg-[#5BB8D4]/10 text-[#5BB8D4] rounded-lg text-xs font-medium">
                {s}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">No specialties listed.</p>
        )}
      </div>

      {/* Commission / Hierarchy */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4 pb-3 border-b border-gray-100">Hierarchy & Commission</h2>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-4">
            <p className="text-xs text-emerald-600 font-medium mb-1">Doctor&apos;s Commission</p>
            <p className="text-2xl font-bold text-emerald-700">{p.commission}%</p>
            <p className="text-xs text-emerald-500 mt-0.5">Earned on own sales</p>
          </div>
          <div className="rounded-lg bg-blue-50 border border-blue-100 p-4">
            <p className="text-xs text-blue-600 font-medium mb-1">Upline (Medical Rep) Commission</p>
            <p className="text-2xl font-bold text-blue-700">{p.uplineCommission}%</p>
            <p className="text-xs text-blue-500 mt-0.5">Per order from this doctor</p>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
          <InfoRow label="Assigned Medical Rep" value={p.salesRep?.name ?? "—"} />
          <InfoRow label="Medical Rep Email"     value={p.salesRep?.email ?? "—"} />
        </dl>
      </div>

      {/* Bank Details */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4 pb-3 border-b border-gray-100">Bank / Payout Details</h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
          <InfoRow label="Bank Name"       value={p.bankName} />
          <InfoRow label="Account Name"    value={p.bankAccountName} />
          <InfoRow label="SWIFT (for International)" value={p.swiftCode} />
          <InfoRow label="Routing Number"  value={p.routingNumber} />
          <div className="col-span-2">
            <InfoRow label="Account Number" value={p.bankAccountNumber} />
          </div>
        </dl>
      </div>

      {/* Meta */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4 pb-3 border-b border-gray-100">Account Details</h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
          <InfoRow label="Added By"    value={p.addedByRole} />
          <InfoRow label="Member Since" value={formatDateLong(p.createdAt)} />
          <InfoRow label="Last Updated" value={formatDateLong(p.updatedAt)} />
        </dl>
      </div>
    </div>
  );
}
