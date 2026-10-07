import { requireAdmin } from "@/lib/auth/dal";
import { prisma } from "@/lib/db/prisma";
import { AdminPasswordForm } from "./_components/admin-password-form";
import { formatDateLong } from "@/lib/utils/timezone";

export const metadata = { title: "Account Details – Pronuvia Admin" };

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</dt>
      <dd className="text-sm text-gray-800">{value ?? <span className="text-gray-300">—</span>}</dd>
    </div>
  );
}


function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <h2 className="text-sm font-semibold text-gray-700 mb-5 pb-3 border-b border-gray-100">{title}</h2>
      {children}
    </div>
  );
}

export default async function AdminAccountPage() {
  const session = await requireAdmin();
  const admin = await prisma.admin.findUnique({
    where:  { id: session.userId },
    select: { id: true, email: true, createdAt: true },
  });

  const memberSince = admin?.createdAt
    ? formatDateLong(admin.createdAt)
    : "—";

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Account Details</h1>
        <p className="text-sm text-gray-400 mt-0.5">Manage your administrator account</p>
      </div>

      {/* Avatar + identity */}
      <div className="flex items-center gap-4 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#3DBFA4] to-[#2a8f7a] flex items-center justify-center shrink-0">
          <span className="text-2xl font-black text-white">
            {session.email.charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="min-w-0">
          <p className="text-base font-bold text-gray-900 truncate">{session.email}</p>
          <p className="text-xs text-gray-400 mt-0.5">Administrator · Pronuvia</p>
          <span className="inline-flex items-center gap-1 mt-2 px-2.5 py-1 bg-gray-900/10 text-[#3DBFA4] rounded-full text-xs font-semibold">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Admin Access
          </span>
        </div>
      </div>

      {/* Account info */}
      <Card title="Account Information">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-5">
          <InfoRow label="Email Address" value={session.email} />
          <InfoRow label="Role" value="Administrator" />
          <InfoRow label="Member Since" value={memberSince} />
          <InfoRow label="Account ID" value={session.userId} />
        </dl>
      </Card>

      {/* Change password */}
      <Card title="Change Password">
        <AdminPasswordForm />
      </Card>
    </div>
  );
}
