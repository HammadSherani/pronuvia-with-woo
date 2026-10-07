"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { createOrder } from "@/actions/admin/manage-orders";

type Physician = {
  id: string; firstName: string; lastName: string; nameOfPractice: string | null;
  commission: number;
  salesRep: { id: string; name: string; commission: number } | null;
};

type Variant = { size?: string; sku?: string; salePrice?: number | string; status?: string; isDefault?: boolean; [k: string]: unknown };

function variantStatusSuffix(v: Variant): string {
  const s = v.status ?? "in_stock";
  if (s === "out_of_stock") return " (Out of Stock)";
  if (s === "discontinued") return " (Discontinued)";
  if (s === "inactive")     return " (Inactive)";
  return "";
}

type ProductOption = {
  id: string; title: string;
  variants: unknown[];
  sku: string; salePrice: number;
};

interface Props { physicians: Physician[]; products: ProductOption[]; }

type OrderLine = {
  productId: string; title: string; variantSize: string; sku: string;
  quantity: number; unitPrice: number; lineTotal: number;
};

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

const base = "w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-gray-700 placeholder:text-gray-400 outline-none focus:ring-1 focus:border-gray-900 focus:ring-gray-900 transition bg-white";

export function CreateOrderForm({ physicians, products }: Props) {
  const [state, formAction, pending] = useActionState(createOrder, undefined);
  const router = useRouter();

  const [physicianId, setPhysicianId] = useState("");
  const [lines, setLines]             = useState<OrderLine[]>([]);
  const [notes, setNotes]             = useState("");

  const physician = physicians.find((p) => p.id === physicianId);
  const subtotal  = lines.reduce((s, l) => s + l.lineTotal, 0);
  const salesRepCommission   = physician?.salesRep?.commission ?? 0;
  const physicianCommission  = physician?.commission ?? 0;
  const projectedRepAmt      = parseFloat(((subtotal * salesRepCommission)  / 100).toFixed(2));
  const projectedDrAmt       = parseFloat(((subtotal * physicianCommission) / 100).toFixed(2));

  useEffect(() => {
    if (!state) return;
    if (state.success) { toast.success(state.message ?? "Order created"); router.push("/admin/orders"); }
    else if (state.message && !state.errors) toast.error(state.message);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  function addLine() {
    setLines((prev) => [...prev, { productId: "", title: "", variantSize: "", sku: "", quantity: 1, unitPrice: 0, lineTotal: 0 }]);
  }

  function updateLine(idx: number, patch: Partial<OrderLine>) {
    setLines((prev) => prev.map((l, i) => {
      if (i !== idx) return l;
      const updated = { ...l, ...patch };
      updated.lineTotal = parseFloat((updated.quantity * updated.unitPrice).toFixed(2));
      return updated;
    }));
  }

  function selectProduct(idx: number, productId: string) {
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;
    const variants = (prod.variants ?? []) as Variant[];
    const defaultVariant = variants.find((v) => v.isDefault) ?? variants[0];
    const unitPrice = defaultVariant?.salePrice ? Number(defaultVariant.salePrice) : prod.salePrice;
    const sku       = defaultVariant?.sku ?? prod.sku;
    const size      = defaultVariant?.size ?? "";
    updateLine(idx, { productId, title: prod.title, variantSize: size, sku, unitPrice, lineTotal: 1 * unitPrice });
  }

  function selectVariant(idx: number, prod: ProductOption, variantSize: string) {
    const variants = (prod.variants ?? []) as Variant[];
    const v = variants.find((v) => (v.size ?? "") === variantSize);
    const unitPrice = v?.salePrice ? Number(v.salePrice) : prod.salePrice;
    const sku       = v?.sku ?? prod.sku;
    updateLine(idx, { variantSize, sku, unitPrice });
  }

  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  }

  const e = state?.errors ?? {};

  return (
    <form action={formAction} noValidate>
      <input type="hidden" name="physicianId" value={physicianId} />
      <input type="hidden" name="items"       value={JSON.stringify(lines)} />
      <input type="hidden" name="notes"       value={notes} />

      {/* ── Physician ── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-5">
        <p className="text-sm font-semibold text-gray-700 mb-4 pb-3 border-b border-gray-100">Physician</p>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Select Physician <span className="text-red-400">*</span>
          </label>
          <select value={physicianId} onChange={(e) => setPhysicianId(e.target.value)} className={base}>
            <option value="">— choose a physician —</option>
            {physicians.map((p) => (
              <option key={p.id} value={p.id}>
                 {p.firstName} {p.lastName}
                {p.nameOfPractice ? ` — ${p.nameOfPractice}` : ""}
              </option>
            ))}
          </select>
          {e.physicianId && <p className="text-xs text-red-500 mt-1">{e.physicianId[0]}</p>}
        </div>

        {physician && (
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg bg-gray-900/5 border border-gray-900/20 p-3">
              <p className="text-xs text-gray-500 mb-1">Physician Commission (current rate)</p>
              <p className="text-lg font-bold text-[#8b5cf6]">{physician.commission}%</p>
              <p className="text-xs text-gray-400 mt-0.5">Projected: {fmt(projectedDrAmt)}</p>
            </div>
            <div className="rounded-lg bg-gray-900/5 border border-[#5BB8D4]/20 p-3">
              <p className="text-xs text-gray-500 mb-1">
                Medical Rep Commission {physician.salesRep ? `(${physician.salesRep.name})` : "(none linked)"}
              </p>
              <p className="text-lg font-bold text-[#5BB8D4]">{salesRepCommission}%</p>
              <p className="text-xs text-gray-400 mt-0.5">Projected: {fmt(projectedRepAmt)}</p>
            </div>
          </div>
        )}
        {physician && (
          <p className="text-xs text-amber-600 mt-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            These rates will be <strong>locked</strong> into this order when submitted. Future rate changes won&apos;t affect it.
          </p>
        )}
      </div>

      {/* ── Products ── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-5">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-700">Products</p>
          <button type="button" onClick={addLine}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-900/10 text-[#3DBFA4] text-xs font-medium rounded-lg hover:bg-gray-900/20 transition-colors cursor-pointer">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Product
          </button>
        </div>

        {e.items && <p className="text-xs text-red-500 mb-3">{e.items[0]}</p>}

        {lines.length === 0 ? (
          <div className="text-center py-8 text-gray-400 border-2 border-dashed border-gray-100 rounded-xl">
            <p className="text-sm">No products added yet.</p>
            <button type="button" onClick={addLine}
              className="mt-2 text-sm text-[#3DBFA4] hover:underline cursor-pointer">
              + Add first product
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {lines.map((line, idx) => {
              const prod = products.find((p) => p.id === line.productId);
              const variants = (prod?.variants ?? []) as Variant[];
              return (
                <div key={idx} className="border border-gray-100 rounded-xl p-4 bg-gray-50/40">
                  <div className="grid grid-cols-12 gap-3 items-start">
                    {/* Product select */}
                    <div className="col-span-4">
                      <label className="text-xs text-gray-500 mb-1 block">Product</label>
                      <select value={line.productId} onChange={(e) => selectProduct(idx, e.target.value)} className={base}>
                        <option value="">— select —</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>{p.title}</option>
                        ))}
                      </select>
                    </div>

                    {/* Variant / size */}
                    <div className="col-span-2">
                      <label className="text-xs text-gray-500 mb-1 block">Size</label>
                      {variants.length > 1 ? (
                        <select value={line.variantSize}
                          onChange={(e) => prod && selectVariant(idx, prod, e.target.value)}
                          className={base}>
                          {variants.map((v, vi) => (
                            <option key={vi} value={v.size ?? ""}>
                              {(v.size ?? `Variant ${vi + 1}`) + variantStatusSuffix(v)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input readOnly value={line.variantSize || "—"} className={`${base} bg-gray-50`} />
                      )}
                    </div>

                    {/* Unit price */}
                    <div className="col-span-2">
                      <label className="text-xs text-gray-500 mb-1 block">Unit Price</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                        <input type="number" step="0.01" min="0"
                          value={line.unitPrice}
                          onChange={(e) => updateLine(idx, { unitPrice: parseFloat(e.target.value) || 0 })}
                          className={`${base} pl-6`} />
                      </div>
                    </div>

                    {/* Qty */}
                    <div className="col-span-2">
                      <label className="text-xs text-gray-500 mb-1 block">Qty</label>
                      <input type="number" min="1"
                        value={line.quantity}
                        onChange={(e) => updateLine(idx, { quantity: parseInt(e.target.value) || 1 })}
                        className={base} />
                    </div>

                    {/* Line total */}
                    <div className="col-span-1">
                      <label className="text-xs text-gray-500 mb-1 block">Total</label>
                      <p className="text-sm font-medium text-gray-800 py-2.5">{fmt(line.lineTotal)}</p>
                    </div>

                    {/* Remove */}
                    <div className="col-span-1 pt-5">
                      <button type="button" onClick={() => removeLine(idx)}
                        className="p-2 text-gray-400 hover:text-red-500 transition-colors cursor-pointer rounded-lg hover:bg-red-50">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Subtotal row */}
            <div className="flex justify-end pt-2 border-t border-gray-100">
              <div className="text-right">
                <p className="text-xs text-gray-400">Order Total</p>
                <p className="text-xl font-bold text-gray-800">{fmt(subtotal)}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Notes ── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-5">
        <p className="text-sm font-semibold text-gray-700 mb-3 pb-3 border-b border-gray-100">Notes (optional)</p>
        <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)}
          className={`${base} resize-none`} placeholder="Internal notes for this order…" />
      </div>

      {/* ── Actions ── */}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending || lines.length === 0 || !physicianId}
          className="px-6 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors cursor-pointer flex items-center gap-2">
          {pending && <div className="w-3.5 h-3.5 border-2 border-white/50 border-t-white rounded-full animate-spin" />}
          {pending ? "Creating…" : "Create Order"}
        </button>
        <a href="/admin/orders" className="px-4 py-2.5 text-sm text-gray-500 hover:text-gray-700 transition-colors">
          Cancel
        </a>
      </div>
    </form>
  );
}
