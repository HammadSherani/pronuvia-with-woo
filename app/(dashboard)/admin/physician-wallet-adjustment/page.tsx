import { requireAdmin } from "@/lib/auth/dal";
import { prisma } from "@/lib/db/prisma";
import { PageHeader } from "@/components/admin/page-header";
import { PhysicianWalletAdjustmentClient } from "@/components/admin/physician-wallet-adjustment-client";

export const metadata = { title: "Physician Commission Adjustment – Pronuvia Admin" };

export default async function PhysicianWalletAdjustmentPage() {
  await requireAdmin();

  const physicians = await prisma.partneringPhysician.findMany({
    where:   { isApproved: "APPROVED" },
    select: {
      id:            true,
      firstName:     true,
      lastName:      true,
      email:         true,
      walletBalance: true,
    },
    orderBy: { firstName: "asc" },
  });

  const totalWalletValue = physicians.reduce((s, p) => s + (p.walletBalance ?? 0), 0);

  return (
    <div>
      <PageHeader
        title="Physician Commission Adjustment"
        description="Manually credit or debit physician wallet balances"
      />

      <div className="grid grid-cols-2 gap-5 mb-6">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="w-8 h-1 rounded-full mb-3 bg-gray-900" />
          <p className="text-xl font-bold text-[#3DBFA4]">{physicians.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Approved Physicians</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="w-8 h-1 rounded-full mb-3 bg-blue-400" />
          <p className="text-xl font-bold text-blue-600">
            {totalWalletValue.toLocaleString("en-US", { style: "currency", currency: "USD" })}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">Total Wallet Value</p>
        </div>
      </div>

      <PhysicianWalletAdjustmentClient physicians={physicians} />
    </div>
  );
}
