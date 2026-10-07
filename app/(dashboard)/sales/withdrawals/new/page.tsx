import { requireSalesRep } from "@/lib/auth/dal";
import { prisma } from "@/lib/db/prisma";
import Link from "next/link";
import { NewWithdrawForm } from "./_components/new-withdraw-form";

export const metadata = { title: "New Withdrawal Request – Pronuvia" };

export default async function NewWithdrawPage() {
  const session = await requireSalesRep();

  const rep = await prisma.salesRepresentative.findUnique({
    where:  { id: session.userId },
    select: { walletBalance: true, bankName: true, bankAccountName: true, bankAccountNumber: true },
  });

  const hasPending = await prisma.withdrawRequest.findFirst({
    where: { userId: session.userId, userRole: "SALES_REP", status: "PENDING" },
  });

  const balance = rep?.walletBalance ?? 0;

  return (
    <div className="max-w-lg space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/sales/withdrawals" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </Link>
        <span className="text-gray-200">/</span>
        <h1 className="text-xl font-bold text-gray-900">New Withdrawal Request</h1>
      </div>

      {/* Balance card */}
      <div className="bg-gradient-to-br from-[#3DBFA4] to-[#2a8f7a] rounded-2xl p-6 text-white">
        <p className="text-sm font-medium text-white/70 mb-1">Available Balance</p>
        <p className="text-4xl font-black tracking-tight">
          {balance.toLocaleString("en-US", { style: "currency", currency: "USD" })}
        </p>
        <p className="text-xs text-white/60 mt-2">You may withdraw up to your full balance</p>
      </div>

      {/* Blocked states */}
      {!rep?.bankName && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-5">
          <p className="text-sm font-semibold text-amber-800">Bank details required</p>
          <p className="text-xs text-amber-600 mt-1">
            Add your bank details in{" "}
            <Link href="/sales/account" className="underline font-medium">Account Settings</Link>{" "}
            before requesting a withdrawal.
          </p>
        </div>
      )}

      {hasPending && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl px-5 py-5">
          <p className="text-sm font-semibold text-blue-800">Request already pending</p>
          <p className="text-xs text-blue-600 mt-1">
            You have a pending request. Please wait for it to be processed before submitting a new one.
          </p>
          <Link href="/sales/withdrawals" className="mt-3 inline-flex text-sm text-blue-700 font-medium hover:underline">
            View status →
          </Link>
        </div>
      )}

      {/* Form — only show if can submit */}
      {rep?.bankName && !hasPending && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
          {/* Bank info preview */}
          <div className="bg-gray-50 rounded-xl px-4 py-3.5 space-y-1">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-2">Payout destination</p>
            <p className="text-sm font-semibold text-gray-800">{rep.bankAccountName}</p>
            <p className="text-xs text-gray-500">{rep.bankName}</p>
            {rep.bankAccountNumber && (
              <p className="text-xs font-mono text-gray-600">
                ••••{rep.bankAccountNumber.slice(-4)}
              </p>
            )}
          </div>

          <NewWithdrawForm maxAmount={balance} />
        </div>
      )}
    </div>
  );
}
