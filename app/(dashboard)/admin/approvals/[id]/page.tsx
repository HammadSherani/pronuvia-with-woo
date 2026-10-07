import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/dal";
import { prisma } from "@/lib/db/prisma";
import { ApprovalDetailActions } from "@/components/admin/approval-detail-actions";
import { formatDateLong } from "@/lib/utils/timezone";

export const metadata = { title: "Review Physician – Pronuvia Admin" };

type Props = { params: Promise<{ id: string }> };

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-sm text-gray-800">{value ?? <span className="text-gray-300">—</span>}</p>
    </div>
  );
}

const sec = "bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-4";
const head = "text-sm font-semibold text-gray-700 mb-4 pb-3 border-b border-gray-100";

export default async function ApprovalDetailPage({ params }: Props) {
  await requireAdmin();
  const { id } = await params;

  const p = await prisma.partneringPhysician.findUnique({
    where: { id, isApproved: "PENDING" },
    select: {
      id: true,
      firstName: true, lastName: true, email: true, loginId: true,
      phone: true, officeContactNumber: true, fax: true,
      aictherapy: true, license: true, websiteLink: true,
      addressOne: true, addressTwo: true, city: true, state: true, zipCode: true,
      nameOfPractice: true, yearsInPractice: true, credential: true, patientsPerMonth: true, fieldsOfSpeciality: true,
      bankName: true, bankAccountNumber: true, bankAccountName: true,
      salesRepNote: true,
      salesRep: { select: { firstName: true, lastName: true, email: true, phone: true } },
      createdAt: true,
    },
  });

  if (!p) notFound();

  const fullName = ` ${p.firstName} ${p.lastName}`;

  return (
    <div className="max-w-3xl">
      {/* Back */}
      <Link
        href="/admin/approvals"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-5 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to Approvals
      </Link>

      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <div className="w-14 h-14 rounded-full bg-[#5BB8D4]/10 flex items-center justify-center shrink-0">
          <span className="text-lg font-bold text-[#5BB8D4]">{p.firstName[0]}{p.lastName[0]}</span>
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-gray-800">{fullName}</h1>
          <p className="text-sm text-gray-400">{p.email}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              Pending Approval
            </span>
            <span className="text-xs text-gray-400">
              Submitted {formatDateLong(p.createdAt)}
            </span>
          </div>
        </div>
        {/* Edit + Approve / Reject buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href={`/admin/approvals/${id}/edit`}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit
          </Link>
          <ApprovalDetailActions id={p.id} name={fullName} />
        </div>
      </div>

      {/* Sales rep note */}
      {p.salesRepNote && (
        <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl flex gap-3">
          <svg className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
          </svg>
          <div>
            <p className="text-xs font-semibold text-amber-700 mb-0.5">Commission Note from Medical Rep</p>
            <p className="text-sm text-amber-800 italic">{p.salesRepNote}</p>
          </div>
        </div>
      )}

      {/* Submitted by */}
      {p.salesRep && (
        <div className={sec}>
          <p className={head}>Submitted By</p>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#3DBFA4]/10 flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-[#3DBFA4]">{p.salesRep.firstName[0]}</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">{p.salesRep.firstName} {p.salesRep.lastName}</p>
              <p className="text-xs text-gray-400">{p.salesRep.email}</p>
              {p.salesRep.phone && <p className="text-xs text-gray-400">{p.salesRep.phone}</p>}
            </div>
          </div>
        </div>
      )}

      {/* Personal information */}
      <div className={sec}>
        <p className={head}>Personal Information</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          <InfoRow label="First Name"   value={p.firstName} />
          <InfoRow label="Last Name"    value={p.lastName} />
          <InfoRow label="Email"        value={p.email} />
          <InfoRow label="Login ID"     value={p.loginId || "Not set"} />
          <InfoRow label="Phone" value={p.phone} />
          <InfoRow label="Office Phone" value={p.officeContactNumber} />
          <InfoRow label="Fax"          value={p.fax} />
        </div>
      </div>

      {/* Practice */}
      <div className={sec}>
        <p className={head}>Practice Information</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          <InfoRow label="Name of Practice"  value={p.nameOfPractice} />
          <InfoRow label="Years in Practice" value={p.yearsInPractice} />
          <InfoRow label="Credential" value={p.credential} />
          <InfoRow label="Patients Seen Per Month" value={p.patientsPerMonth} />
          <InfoRow label="License Number"    value={p.license} />
          <InfoRow label="How did you hear about AIC Therapy? "    value={p.aictherapy} />
          <div className="col-span-2">
            <InfoRow label="Website" value={p.websiteLink} />
          </div>
        </div>

        {p.fieldsOfSpeciality.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-50">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Fields of Speciality</p>
            <div className="flex flex-wrap gap-1.5">
              {p.fieldsOfSpeciality.map((s) => (
                <span key={s} className="inline-flex px-2.5 py-1 bg-[#3DBFA4]/10 text-[#3DBFA4] text-xs rounded-full font-medium">
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Address */}
      <div className={sec}>
        <p className={head}>Practice Address</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          <div className="col-span-2">
            <InfoRow label="Address Line 1" value={p.addressOne} />
          </div>
          <div className="col-span-2">
            <InfoRow label="Address Line 2" value={p.addressTwo} />
          </div>
          <InfoRow label="City"     value={p.city} />
          <InfoRow label="State"    value={p.state} />
          <InfoRow label="ZIP Code" value={p.zipCode} />
        </div>
      </div>

      {/* Bank */}
      {(p.bankName || p.bankAccountNumber || p.bankAccountName) && (
        <div className={sec}>
          <p className={head}>Bank / Payout Details</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <InfoRow label="Bank Name"       value={p.bankName} />
            <InfoRow label="Account Name"    value={p.bankAccountName} />
            <InfoRow label="Account Number"  value={p.bankAccountNumber} />
          </div>
        </div>
      )}

      {/* Bottom approve/reject */}
      <div className="mt-2 pb-8">
        <ApprovalDetailActions id={p.id} name={fullName} />
      </div>
    </div>
  );
}
