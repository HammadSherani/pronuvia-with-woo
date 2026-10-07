"use client";

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function PhysicianWalletPanel({
  totalPending,
  totalWithdrawn,
  commissionOrderCount,
  hasPending,
  deficitApplied,
  bankName,
  bankAccountNumber,
  bankAccountName,
}: {
  totalPending:         number;
  totalWithdrawn:       number;
  commissionOrderCount: number;
  hasPending:           boolean;
  deficitApplied?:      number;
  bankName?:            string | null;
  bankAccountNumber?:   string | null;
  bankAccountName?:     string | null;
}) {
  const isDeficit = totalPending < 0;
  return (
    <>
      <div className="grid grid-cols-4 gap-5 mb-8">

        {/* Commission earned */}
        <div className="col-span-1 relative overflow-hidden bg-gradient-to-br from-[#3DBFA4] to-[#2a9f89] rounded-2xl p-6 text-white shadow-md">
          <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full border-[16px] border-white/10 pointer-events-none" />
          <div className="absolute -bottom-8 -left-4 w-24 h-24 rounded-full border-[12px] border-white/8 pointer-events-none" />

          <p className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-1">Total Commission Earned</p>
          <p className="text-3xl font-black tabular-nums leading-none mt-1">{fmt(totalPending + totalWithdrawn)}</p>
          {hasPending && (
            <p className="text-[10px] text-amber-200 mt-2 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-300 inline-block" />
              Pending request
            </p>
          )}
        </div>

        {/* Pending Commission */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Pending Commission</p>
            <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div>
            <p className={`text-2xl font-black tabular-nums ${isDeficit ? "text-red-500" : "text-gray-800"}`}>
              {isDeficit ? `-${fmt(Math.abs(totalPending))}` : fmt(totalPending)}
            </p>
            <p className={`text-xs mt-1 ${isDeficit ? "text-red-400" : "text-gray-400"}`}>
              {/* {isDeficit ? "Refund deficit" : "Awaiting payout"} */}
            </p>
            {!isDeficit && !!deficitApplied && (
              <p className="text-[11px] text-amber-600 mt-1.5 leading-snug">
                Net of {fmt(deficitApplied)} refund deficit already deducted.
              </p>
            )}
          </div>
        </div>

        {/* Withdrawn */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Commission Paid-out</p>
            <div className="w-8 h-8 rounded-full bg-gray-900/10 flex items-center justify-center">
              <svg className="w-4 h-4 text-[#5BB8D4]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
            </div>
          </div>
          <div>
            <p className="text-2xl font-black text-gray-800 tabular-nums">{fmt(totalWithdrawn)}</p>
            <p className="text-xs text-gray-400 mt-1">Approved payouts</p>
          </div>
        </div>

        {/* Commission orders */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Commission Orders</p>
            <div className="w-8 h-8 rounded-full bg-violet-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
          </div>
          <div>
            <p className="text-2xl font-black text-gray-800 tabular-nums">{commissionOrderCount}</p>
            <p className="text-xs text-gray-400 mt-1">Orders earning commission</p>
          </div>
        </div>
      </div>

    </>
  );
}
