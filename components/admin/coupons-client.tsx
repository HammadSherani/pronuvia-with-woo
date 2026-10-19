"use client";

import { useState, useMemo } from "react";
import { ClientPagination } from "@/components/shared/pagination";
import { formatDate } from "@/lib/utils/timezone";
import { wpAdmin } from "@/lib/woo/admin-links";

type Coupon = {
  id:             string;
  code:           string;
  description:    string | null;
  discountType:   string;
  discountValue:  number;
  minOrderAmount: number | null;
  maxUses:        number | null;
  usedCount:      number;
  expiresAt:      Date | null;
  isActive:       boolean;
  applicableTo:   string;
  createdAt:      Date;
};

interface Props { coupons: Coupon[] }

function fmtDate(d: Date | null) {
  if (!d) return "—";
  return formatDate(d);
}

// View only: coupons are created and changed in WooCommerce (WP admin)
export function CouponsClient({ coupons }: Props) {
  const [page,     setPage]        = useState(1);
  const [pageSize, setPageSize]    = useState(10);

  const pagedCoupons = useMemo(() => {
    const start = (page - 1) * pageSize;
    return coupons.slice(start, start + pageSize);
  }, [coupons, page, pageSize]);

  const discountLabel = (c: Coupon) =>
    c.discountType === "PERCENTAGE" ? `${c.discountValue}% off` : `$${c.discountValue.toFixed(2)} off`;

  const applicableLabel = (v: string) =>
    v === "ALL" ? "Everyone" : v === "SALES_REP" ? "Medical Reps" : "Physicians";

  return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Coupons</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {coupons.length} coupon{coupons.length !== 1 ? "s" : ""} total · created and managed in WooCommerce
            </p>
          </div>
          <a
            href={wpAdmin.coupons()}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-gray-900 hover:bg-gray-700 rounded-xl shadow-sm transition-colors"
          >
            Manage in WooCommerce ↗
          </a>
        </div>

        {coupons.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 text-center">
            <div className="w-14 h-14 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-gray-600">No coupons yet</p>
            <p className="text-xs text-gray-400 mt-1">Coupons created in WooCommerce show here.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  {["Code", "Discount", "Usage", "Expires", "Applicable To", "Status"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider first:pl-6 last:pr-6">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {pagedCoupons.map((c) => {
                  const isExpired = c.expiresAt && new Date(c.expiresAt) < new Date();
                  const isExhausted = c.maxUses !== null && c.usedCount >= c.maxUses;
                  const effectivelyInactive = !c.isActive || isExpired || isExhausted;

                  return (
                    <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="pl-6 pr-4 py-4">
                        <div>
                          <span className="font-mono font-bold text-gray-800 tracking-wider">{c.code}</span>
                          {c.description && (
                            <p className="text-xs text-gray-400 mt-0.5">{c.description}</p>
                          )}
                          {c.minOrderAmount && (
                            <p className="text-xs text-gray-400 mt-0.5">Min. ${c.minOrderAmount.toFixed(2)}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700">
                          {discountLabel(c)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-gray-600">
                        {c.usedCount}
                        {c.maxUses !== null && (
                          <span className="text-gray-400"> / {c.maxUses}</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <span className={isExpired ? "text-red-500 text-xs font-medium" : "text-gray-600"}>
                          {fmtDate(c.expiresAt)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-gray-600">
                        {applicableLabel(c.applicableTo)}
                      </td>
                      <td className="px-4 py-4">
                        {effectivelyInactive ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">
                            {isExpired ? "Expired" : isExhausted ? "Exhausted" : "Inactive"}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700">
                            Active
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <ClientPagination
              total={coupons.length}
              page={page}
              pageSize={pageSize}
              onPage={setPage}
              onPageSize={setPageSize}
            />
          </div>
        )}
      </div>
  );
}
