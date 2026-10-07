import { requireAdmin }                       from "@/lib/auth/dal";
import { prisma }                             from "@/lib/db/prisma";
import { PageHeader }                         from "@/components/admin/page-header";
import { WithdrawalsTableClient }             from "@/components/admin/withdrawals-table-client";
import { PhysicianWithdrawalsTableClient }    from "@/components/admin/physician-withdrawals-table-client";

export const metadata = { title: "Payout Requests – Pronuvia Admin" };

export default async function PayoutRequestsPage() {
  await requireAdmin();

  // Fetch all withdrawal requests ordered newest first
  const requests = await prisma.withdrawRequest.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true, userId: true, userRole: true,
      amount: true, status: true, note: true, adminNote: true, createdAt: true,
    },
  });

  const repRequests      = requests.filter((r) => r.userRole === "SALES_REP");
  const physicianRequests = requests.filter((r) => r.userRole === "PHYSICIAN");

  const repIds = [...new Set(repRequests.map((r) => r.userId))];
  const docIds = [...new Set(physicianRequests.map((r) => r.userId))];

  const [reps, physicians] = await Promise.all([
    repIds.length
      ? prisma.salesRepresentative.findMany({
          where:  { id: { in: repIds } },
          select: { id: true, firstName: true, lastName: true, email: true, bankName: true, bankAccountNumber: true, bankAccountName: true, bankAccountType: true, bankOwnershipType: true, walletBalance: true },
        })
      : [],
    docIds.length
      ? prisma.partneringPhysician.findMany({
          where:  { id: { in: docIds } },
          select: { id: true, firstName: true, lastName: true, email: true, bankName: true, bankAccountNumber: true, bankAccountName: true, bankAccountType: true, bankOwnershipType: true, walletBalance: true },
        })
      : [],
  ]);

  const repMap = new Map(reps.map((r) => [r.id, r]));
  const docMap = new Map(physicians.map((p) => [p.id, p]));

  const repRows = repRequests.flatMap((r) => {
    const rep = repMap.get(r.userId);
    if (!rep) return [];
    return [{
      id: r.id, amount: r.amount, status: r.status, note: r.note, adminNote: r.adminNote, createdAt: r.createdAt,
      salesRepId: r.userId,
      salesRep: {
        firstName: rep.firstName, lastName: rep.lastName, email: rep.email,
        bankName: rep.bankName, bankAccountNumber: rep.bankAccountNumber, bankAccountName: rep.bankAccountName, bankAccountType: rep.bankAccountType, bankOwnershipType: rep.bankOwnershipType,
        walletBalance: rep.walletBalance,
      },
    }];
  });

  const docRows = physicianRequests.flatMap((r) => {
    const doc = docMap.get(r.userId);
    if (!doc) return [];
    return [{
      id: r.id, amount: r.amount, status: r.status, note: r.note, adminNote: r.adminNote, createdAt: r.createdAt,
      physicianId: r.userId,
      physician: {
        firstName: doc.firstName, lastName: doc.lastName, email: doc.email,
        bankName: doc.bankName, bankAccountNumber: doc.bankAccountNumber, bankAccountType: doc.bankAccountType, bankOwnershipType: doc.bankOwnershipType, bankAccountName: doc.bankAccountName,
        walletBalance: doc.walletBalance,
      },
    }];
  });

  const pendingRep = repRows.filter((r) => r.status === "PENDING").length;
  const pendingDoc = docRows.filter((r) => r.status === "PENDING").length;

  return (
    <div>
      <PageHeader
        title="Payout Requests"
        description="Approve or reject withdrawal requests submitted by Medical Reps and Doctors"
      />

      {/* Medical Rep Requests */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-base font-bold text-gray-800">Medical Rep Requests</h2>
          {pendingRep > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700 border border-amber-200">
              {pendingRep} pending
            </span>
          )}
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <WithdrawalsTableClient requests={repRows} />
        </div>
      </div>

      {/* Physician Requests */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-base font-bold text-gray-800">Doctor Requests</h2>
          {pendingDoc > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700 border border-amber-200">
              {pendingDoc} pending
            </span>
          )}
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <PhysicianWithdrawalsTableClient requests={docRows} />
        </div>
      </div>
    </div>
  );
}
