"use client";

import { useState, useEffect, useRef } from "react";
import { getPhysicianWalletDetails } from "@/actions/admin/get-physician-wallet";
import { formatDate } from "@/lib/utils/timezone";

type WalletData = Awaited<ReturnType<typeof getPhysicianWalletDetails>>;

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

const wdStyle: Record<string, string> = {
  PENDING:  "bg-amber-50 text-amber-700 border-amber-200",
  APPROVED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  REJECTED: "bg-red-50 text-red-700 border-red-200",
};

export function PhysicianWalletModal({
  physicianId,
  physicianName,
}: {
  physicianId:   string;
  physicianName: string;
}) {
  const [open,    setOpen]    = useState(false);
  const [loading, setLoading] = useState(false);
  const [data,    setData]    = useState<WalletData | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    getPhysicianWalletDetails(physicianId).then((d) => {
      setData(d);
      setLoading(false);
    });
  }, [open, physicianId]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const balance = data?.physician?.walletBalance ?? 0;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-gray-900/10 text-[#5BB8D4] border border-[#5BB8D4]/30 rounded-lg hover:bg-gray-900/20 transition-colors">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 6h18M3 14h18M3 18h18" />
        </svg>
        Wallet
      </button>

      {open && (
        <div ref={overlayRef}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === overlayRef.current) setOpen(false); }}
        >
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 shrink-0">
              <div>
                <h2 className="text-base font-bold text-gray-800">Wallet — {physicianName}</h2>
                {data?.physician && (
                  <p className="text-xs text-gray-400 mt-0.5">{data.physician.email}</p>
                )}
              </div>
              <button type="button" onClick={() => setOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="overflow-y-auto px-6 py-5 space-y-6">
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <span className="w-6 h-6 border-2 border-gray-200 border-t-[#3DBFA4] rounded-full animate-spin" />
                </div>
              ) : !data?.physician ? (
                <p className="text-sm text-gray-400 text-center py-8">Failed to load wallet data.</p>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gradient-to-br from-[#3DBFA4] to-[#2a9f89] rounded-xl p-4 text-white">
                      <p className="text-xs font-semibold text-white/70 mb-1">Available Balance</p>
                      <p className="text-2xl font-black">{fmt(balance)}</p>
                    </div>
                    <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
                      <p className="text-xs font-semibold text-gray-500 mb-2">Bank Account</p>
                      {data.physician.bankName ? (
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-gray-800">{data.physician.bankAccountName}</p>
                          <p className="text-xs text-gray-600">{data.physician.bankName}</p>
                          {data.physician.bankAccountNumber && (
                            <p className="text-sm font-mono font-bold text-gray-800 tracking-wide">
                              {data.physician.bankAccountNumber}
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-red-400 font-medium">No bank account linked</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-3">Transaction History</h3>
                    {data.transactions.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-6 bg-gray-50 rounded-xl">No transactions yet</p>
                    ) : (
                      <div className="border border-gray-100 rounded-xl overflow-hidden divide-y divide-gray-50">
                        {data.transactions.map((tx) => (
                          <div key={tx.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50/60">
                            <div className="flex items-center gap-3">
                              <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${tx.type === "CREDIT" ? "bg-emerald-50" : "bg-red-50"}`}>
                                {tx.type === "CREDIT" ? (
                                  <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                                  </svg>
                                ) : (
                                  <svg className="w-3.5 h-3.5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
                                  </svg>
                                )}
                              </div>
                              <div>
                                <p className="text-xs font-medium text-gray-700">{tx.description ?? (tx.type === "CREDIT" ? "Credit" : "Debit")}</p>
                                <p className="text-[10px] text-gray-400">
                                  {formatDate(tx.createdAt)}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className={`text-sm font-bold ${tx.type === "CREDIT" ? "text-emerald-600" : "text-red-500"}`}>
                                {tx.type === "CREDIT" ? "+" : "−"}{fmt(tx.amount)}
                              </p>
                              <p className="text-[10px] text-gray-400">Bal: {fmt(tx.balance)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {data.withdrawRequests.length > 0 && (
                    <div>
                      <h3 className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-3">Withdrawal Requests</h3>
                      <div className="border border-gray-100 rounded-xl overflow-hidden divide-y divide-gray-50">
                        {data.withdrawRequests.map((r) => (
                          <div key={r.id} className="flex items-center justify-between px-4 py-3">
                            <div>
                              <p className="text-sm font-bold text-gray-800">{fmt(r.amount)}</p>
                              <p className="text-[10px] text-gray-400">
                                {formatDate(r.createdAt)}
                              </p>
                              {r.note      && <p className="text-xs text-gray-500 italic mt-0.5">"{r.note}"</p>}
                              {r.adminNote && <p className="text-xs text-[#3DBFA4] mt-0.5">↳ {r.adminNote}</p>}
                            </div>
                            <span className={`inline-flex px-2 py-0.5 border rounded-full text-xs font-medium ${wdStyle[r.status] ?? wdStyle["PENDING"]}`}>
                              {r.status.charAt(0) + r.status.slice(1).toLowerCase()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
