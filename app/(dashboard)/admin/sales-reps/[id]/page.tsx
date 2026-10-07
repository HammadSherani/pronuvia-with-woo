import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/dal";
import { getSalesRepById } from "@/actions/admin/manage-sales-reps";
import { DownlineTable } from "@/components/admin/downline-table";
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

type AddressObj = { line1?: string; line2?: string; city?: string; state?: string; zipCode?: string; country?: string };

function AddressDisplay({ label, raw }: { label: string; raw?: string | null }) {
  let addr: AddressObj | null = null;
  if (raw) {
    try { addr = JSON.parse(raw); } catch { /* raw string, show as-is */ }
  }

  return (
    <div>
      <dt className="text-xs text-gray-400 font-medium mb-0.5 uppercase tracking-wide">{label}</dt>
      <dd className="text-sm text-gray-700 leading-relaxed">
        {!addr ? (
          raw ? <span>{raw}</span> : <span className="text-gray-300">—</span>
        ) : (
          <span className="whitespace-pre-line">
            {[
              addr.line1,
              addr.line2,
              [addr.city, addr.state, addr.zipCode].filter(Boolean).join(", "),
              addr.country,
            ].filter(Boolean).join("\n") || <span className="text-gray-300">—</span>}
          </span>
        )}
      </dd>
    </div>
  );
}

function Card({ title, children, wide }: { title: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-5">
      <h2 className="text-sm font-semibold text-gray-700 mb-4 pb-3 border-b border-gray-100">{title}</h2>
      {wide ? children : <dl className="grid grid-cols-2 gap-x-6 gap-y-4">{children}</dl>}
    </div>
  );
}

export default async function SalesRepViewPage({ params }: Props) {
  await requireAdmin();
  const { id } = await params;

  const rep = await getSalesRepById(id);
  if (!rep) notFound();

  return (
    <div className="max-w-4xl">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6">
        <Link href="/admin/sales-reps"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Medical Representatives
        </Link>
        <Link href={`/admin/sales-reps/${id}/edit`}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#3DBFA4] text-white text-sm font-medium rounded-lg hover:bg-[#35a993] transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Edit
        </Link>
      </div>

      {/* Avatar + name */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-16 h-16 rounded-full bg-[#3DBFA4]/10 flex items-center justify-center shrink-0">
          <span className="text-2xl font-bold text-[#3DBFA4]">
            {rep.firstName[0]}{rep.lastName[0]}
          </span>
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{rep.name}</h1>
          <p className="text-sm text-gray-500">{rep.email}</p>
        </div>
        <div className="ml-auto flex items-center gap-2 flex-wrap justify-end">
          <span className="inline-flex px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-sm font-medium">
            {rep.commission}% commission
          </span>
          <span className="inline-flex px-3 py-1 bg-teal-50 text-teal-700 border border-teal-200 rounded-full text-sm font-medium">
            ${rep.walletBalance.toFixed(2)} wallet
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-sm font-medium">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0" />
            </svg>
            {rep.physicians.length} downline
          </span>
        </div>
      </div>

      <Card title="Personal Information">
        <InfoRow label="First Name" value={rep.firstName} />
        <InfoRow label="Last Name" value={rep.lastName} />
        <InfoRow label="Email" value={rep.email} />
        <InfoRow label="Login ID" value={rep.loginId || "Not set"} />
        <InfoRow label="Phone" value={rep.phone} />
        <InfoRow label="Website" value={rep.website} />
        <InfoRow label="Commission" value={`${rep.commission}%`} />
        <InfoRow label="Wallet Balance" value={`$${rep.walletBalance.toFixed(2)}`} />
        <InfoRow label="Total Orders" value={String(rep.ordersCount)} />
        <InfoRow label="Member Since" value={formatDateLong(rep.createdAt)} />
      </Card>

      <Card title="Addresses">
        <div className="col-span-2">
          <AddressDisplay label="Billing Address" raw={rep.billingAddress} />
        </div>
        <div className="col-span-2">
          <AddressDisplay label="Shipping Address" raw={rep.shippingAddress} />
        </div>
      </Card>

      <Card title="Payout / Bank Details">
        <InfoRow label="Bank Name" value={rep.bankName} />
        <InfoRow label="SWIFT (for International)" value={rep.swiftCode} />
        <InfoRow label="Account Name" value={rep.bankAccountName} />
        <InfoRow label="Routing Number" value={rep.routingNumber} />
        <div className="col-span-2">
          <InfoRow label="Account Number" value={rep.bankAccountNumber} />
        </div>
      </Card>

      {/* Downline physicians */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-5">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
          <h2 className="text-sm font-semibold text-gray-700">Downline Physicians</h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">
              {rep.physicians.length} physician{rep.physicians.length !== 1 ? "s" : ""}
            </span>
            <span className="text-xs text-gray-300">·</span>
            <span className="text-xs text-gray-400">
              Upline commission is editable per-doctor
            </span>
          </div>
        </div>
        <DownlineTable doctors={rep.physicians} />
      </div>
    </div>
  );
}
