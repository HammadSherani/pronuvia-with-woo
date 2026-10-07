"use client";

import { useState, useMemo, useTransition } from "react";
import toast                       from "react-hot-toast";
import { ClientPagination } from "@/components/shared/pagination";
import {
  createCoupon,
  updateCoupon,
  toggleCoupon,
  deleteCoupon,
  type CouponInput,
  type CouponRecord,
} from "@/actions/admin/coupons";
import { formatDate, toDateInputValue } from "@/lib/utils/timezone";

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

const BLANK: CouponInput = {
  code:           "",
  description:    "",
  discountType:   "PERCENTAGE",
  discountValue:  10,
  minOrderAmount: null,
  maxUses:        null,
  expiresAt:      null,
  isActive:       true,
  applicableTo:   "ALL",
};

function inp(extra = "") {
  return `w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/40 focus:border-gray-900 ${extra}`;
}

function fmtDate(d: Date | null) {
  if (!d) return "—";
  return formatDate(d);
}

function CouponFormModal({
  initial,
  onClose,
  onSave,
  editId,
}: {
  initial:  CouponInput;
  onClose:  () => void;
  onSave:   (coupon: CouponRecord) => void;
  editId?:  string;
}) {
  const [form, setForm] = useState<CouponInput>(initial);
  const [isPending, start] = useTransition();

  const set = <K extends keyof CouponInput>(k: K, v: CouponInput[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = () => {
    start(async () => {
      const res = editId
        ? await updateCoupon(editId, form)
        : await createCoupon(form);
      if (res.success) {
        toast.success(res.message);
        onSave(res.coupon);
      } else {
        toast.error(res.message);
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-auto">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-800">
            {editId ? "Edit Coupon" : "Create Coupon"}
          </h2>
          <button type="button" onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">

          {/* Code */}
          {!editId && (
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Coupon Code *</label>
              <input
                type="text" placeholder="e.g. SUMMER20"
                value={form.code}
                onChange={(e) => set("code", e.target.value.toUpperCase())}
                className={inp("font-mono tracking-widest")}
              />
            </div>
          )}

          {/* Description */}
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Description</label>
            <input
              type="text" placeholder="e.g. Summer sale 20% off"
              value={form.description ?? ""}
              onChange={(e) => set("description", e.target.value)}
              className={inp()}
            />
          </div>

          {/* Discount type + value */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Discount Type</label>
              <select
                value={form.discountType}
                onChange={(e) => set("discountType", e.target.value as "PERCENTAGE" | "FIXED")}
                className={inp()}
              >
                <option value="PERCENTAGE">Percentage (%)</option>
                <option value="FIXED">Fixed Amount ($)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1.5 block">
                {form.discountType === "PERCENTAGE" ? "Discount (%)" : "Discount ($)"}
              </label>
              <input
                type="number" min="0.01" step="0.01"
                value={form.discountValue}
                onChange={(e) => set("discountValue", parseFloat(e.target.value) || 0)}
                className={inp()}
              />
            </div>
          </div>

          {/* Min order + max uses */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Min Order ($)</label>
              <input
                type="number" min="0" step="0.01" placeholder="None"
                value={form.minOrderAmount ?? ""}
                onChange={(e) => set("minOrderAmount", e.target.value ? parseFloat(e.target.value) : null)}
                className={inp()}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Max Uses</label>
              <input
                type="number" min="1" step="1" placeholder="Unlimited"
                value={form.maxUses ?? ""}
                onChange={(e) => set("maxUses", e.target.value ? parseInt(e.target.value) : null)}
                className={inp()}
              />
            </div>
          </div>

          {/* Expiry */}
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Expiry Date</label>
            <input
              type="date"
              value={form.expiresAt ?? ""}
              onChange={(e) => set("expiresAt", e.target.value || null)}
              className={inp()}
            />
          </div>

          {/* Applicable to + Active */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Applicable To</label>
              <select
                value={form.applicableTo}
                onChange={(e) => set("applicableTo", e.target.value as CouponInput["applicableTo"])}
                className={inp()}
              >
                <option value="ALL">Everyone</option>
                <option value="SALES_REP">Medical Reps only</option>
                <option value="PHYSICIAN">Physicians only</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Status</label>
              <select
                value={form.isActive ? "1" : "0"}
                onChange={(e) => set("isActive", e.target.value === "1")}
                className={inp()}
              >
                <option value="1">Active</option>
                <option value="0">Inactive</option>
              </select>
            </div>
          </div>
        </div>

        <div className="px-6 pb-5 flex justify-end gap-3">
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors">
            Cancel
          </button>
          <button type="button" onClick={handleSubmit} disabled={isPending}
            className="px-5 py-2 text-sm font-bold text-white bg-gray-900 hover:bg-gray-700 disabled:opacity-50 rounded-lg transition-colors">
            {isPending ? "Saving…" : editId ? "Save Changes" : "Create Coupon"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function CouponsClient({ coupons: initial }: Props) {
  const [coupons, setCoupons]     = useState<Coupon[]>(initial);
  const [showForm, setShowForm]   = useState(false);
  const [editCoupon, setEditCoupon] = useState<Coupon | null>(null);
  const [deleting, setDeleting]   = useState<string | null>(null);
  const [isPending, start]         = useTransition();
  const [page,     setPage]        = useState(1);
  const [pageSize, setPageSize]    = useState(10);

  const pagedCoupons = useMemo(() => {
    const start = (page - 1) * pageSize;
    return coupons.slice(start, start + pageSize);
  }, [coupons, page, pageSize]);

  const handleToggle = (id: string, current: boolean) => {
    start(async () => {
      const res = await toggleCoupon(id, !current);
      if (res.success) {
        setCoupons((p) => p.map((c) => c.id === id ? res.coupon : c));
        toast.success(res.message);
      } else {
        toast.error(res.message);
      }
    });
  };

  const handleDelete = (id: string) => {
    start(async () => {
      const res = await deleteCoupon(id);
      if (res.success) {
        setCoupons((p) => p.filter((c) => c.id !== id));
        toast.success(res.message);
      } else {
        toast.error(res.message);
      }
      setDeleting(null);
    });
  };

  const discountLabel = (c: Coupon) =>
    c.discountType === "PERCENTAGE" ? `${c.discountValue}% off` : `$${c.discountValue.toFixed(2)} off`;

  const applicableLabel = (v: string) =>
    v === "ALL" ? "Everyone" : v === "SALES_REP" ? "Medical Reps" : "Physicians";

  return (
    <>
      {(showForm || editCoupon) && (
        <CouponFormModal
          initial={editCoupon
            ? {
                code:           editCoupon.code,
                description:    editCoupon.description ?? "",
                discountType:   editCoupon.discountType as "PERCENTAGE" | "FIXED",
                discountValue:  editCoupon.discountValue,
                minOrderAmount: editCoupon.minOrderAmount,
                maxUses:        editCoupon.maxUses,
                expiresAt:      editCoupon.expiresAt
                  ? toDateInputValue(editCoupon.expiresAt)
                  : null,
                isActive:      editCoupon.isActive,
                applicableTo:  editCoupon.applicableTo as CouponInput["applicableTo"],
              }
            : BLANK}
          editId={editCoupon?.id}
          onClose={() => { setShowForm(false); setEditCoupon(null); }}
          onSave={(saved) => {
            if (editCoupon) {
              setCoupons((p) => p.map((c) => c.id === saved.id ? saved : c));
            } else {
              setCoupons((p) => [saved, ...p]);
            }
            setShowForm(false);
            setEditCoupon(null);
          }}
        />
      )}

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Coupons</h1>
            <p className="text-sm text-gray-500 mt-0.5">{coupons.length} coupon{coupons.length !== 1 ? "s" : ""} total</p>
          </div>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-gray-900 hover:bg-gray-700 rounded-xl shadow-sm transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Create Coupon
          </button>
        </div>

        {/* Table */}
        {coupons.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 text-center">
            <div className="w-14 h-14 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-gray-600">No coupons yet</p>
            <p className="text-xs text-gray-400 mt-1">Create your first coupon to offer discounts.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  {["Code", "Discount", "Usage", "Expires", "Applicable To", "Status", ""].map((h) => (
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
                      <td className="pr-6 pl-4 py-4">
                        <div className="flex items-center gap-2 justify-end">
                          {/* Toggle */}
                          <button
                            type="button"
                            onClick={() => handleToggle(c.id, c.isActive)}
                            disabled={isPending}
                            title={c.isActive ? "Deactivate" : "Activate"}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                          >
                            {c.isActive ? (
                              <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5.636 5.636a9 9 0 1012.728 12.728A9 9 0 005.636 5.636zM9 9l6 6m0-6l-6 6" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            )}
                          </button>

                          {/* Edit */}
                          <button
                            type="button"
                            onClick={() => setEditCoupon(c)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>

                          {/* Delete */}
                          {deleting === c.id ? (
                            <div className="flex items-center gap-1">
                              <button type="button" onClick={() => handleDelete(c.id)} disabled={isPending}
                                className="px-2 py-1 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 rounded transition-colors">
                                Confirm
                              </button>
                              <button type="button" onClick={() => setDeleting(null)}
                                className="px-2 py-1 text-xs text-gray-500 border border-gray-200 rounded hover:border-gray-300 transition-colors">
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button type="button" onClick={() => setDeleting(c.id)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
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
    </>
  );
}
