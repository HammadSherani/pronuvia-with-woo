"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  listAdjustableOrders, createCommissionAdjustment, deleteCommissionAdjustment, type AdjustableOrder,
} from "@/actions/admin/commission-adjustment";
import { formatDate } from "@/lib/utils/timezone";

type Person = { id: string; name: string; email: string; role: "PHYSICIAN" | "SALES_REP" };

export type AdjustmentRow = {
  id: string; userName: string; userEmail: string; role: "PHYSICIAN" | "SALES_REP";
  orderNumber: string | null; period: string; amount: number; reason: string | null; by: string | null;
  status: "PENDING" | "NEEDS_REVIEW" | "PAID" | "CANCELLED"; createdAt: string;
};

const fmt = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });
const inp = "w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/20";
const lbl = "block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5";
const STATUS: Record<AdjustmentRow["status"], { label: string; cls: string }> = {
  PENDING:      { label: "In payout",  cls: "bg-amber-50 text-amber-700 border-amber-200" },
  NEEDS_REVIEW: { label: "Review",     cls: "bg-amber-50 text-amber-700 border-amber-200" },
  PAID:         { label: "Paid",       cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  CANCELLED:    { label: "Not paid",   cls: "bg-gray-100 text-gray-500 border-gray-200" },
};

/**
 * Commission Adjustment: an adjustment is always on one order. It is added to
 * that person's payout for the order's month (positive or negative) and paid
 * with it; until then it can be removed.
 */
export function CommissionAdjustmentClient({ people, rows }: { people: Person[]; rows: AdjustmentRow[] }) {
  const router = useRouter();
  const [role, setRole] = useState<"PHYSICIAN" | "SALES_REP">("PHYSICIAN");
  const [userId, setUserId] = useState("");
  const [orderSearch, setOrderSearch] = useState("");
  const [orders, setOrders] = useState<AdjustableOrder[]>([]);
  const [loadingOrders, startLoad] = useTransition();
  const [orderId, setOrderId] = useState("");
  const [direction, setDirection] = useState<"ADD" | "DEDUCT">("ADD");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, start] = useTransition();
  const [filter, setFilter] = useState("");

  const list = useMemo(() => people.filter((p) => p.role === role), [people, role]);
  const order = orders.find((o) => o.id === orderId);

  useEffect(() => {
    if (!userId) return;
    const t = setTimeout(() => startLoad(async () => {
      const r = await listAdjustableOrders(userId, role, orderSearch);
      setOrders(r);
      setOrderId((cur) => (r.some((o) => o.id === cur) ? cur : ""));
    }), 250);
    return () => clearTimeout(t);
  }, [userId, role, orderSearch]);

  const value = Number(amount);
  const valid = userId && orderId && Number.isFinite(value) && value > 0 && reason.trim().length > 0;

  const submit = () => start(async () => {
    const res = await createCommissionAdjustment({ userId, userRole: role, orderId, amount: direction === "ADD" ? value : -value, reason });
    if (res.success) { toast.success(res.message); setAmount(""); setReason(""); router.refresh(); }
    else toast.error(res.message);
  });

  const remove = (id: string) => start(async () => {
    const res = await deleteCommissionAdjustment(id);
    if (res.success) { toast.success(res.message); router.refresh(); } else toast.error(res.message);
  });

  const shown = rows.filter((r) => {
    const q = filter.trim().toLowerCase();
    return !q || r.userName.toLowerCase().includes(q) || r.userEmail.toLowerCase().includes(q) || (r.orderNumber ?? "").includes(q.replace(/^#/, ""));
  });

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-8">
        <h2 className="text-sm font-bold text-gray-800 mb-1">New adjustment</h2>
        <p className="text-xs text-gray-500 mb-5">Pick the person and the order. The adjustment goes into their payout for that order&apos;s month.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className={lbl} htmlFor="adj-role">Role</label>
            <select id="adj-role" className={inp} value={role} onChange={(e) => { setRole(e.target.value as typeof role); setUserId(""); setOrders([]); setOrderId(""); }}>
              <option value="PHYSICIAN">Doctor</option>
              <option value="SALES_REP">Medical Rep</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className={lbl} htmlFor="adj-user">{role === "PHYSICIAN" ? "Doctor" : "Medical Rep"}</label>
            <select id="adj-user" className={inp} value={userId} onChange={(e) => { setUserId(e.target.value); setOrders([]); setOrderId(""); setOrderSearch(""); }}>
              <option value="">Select…</option>
              {list.map((p) => <option key={p.id} value={p.id}>{p.name} — {p.email}</option>)}
            </select>
          </div>
        </div>

        {userId && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className={lbl} htmlFor="adj-search">Find order</label>
              <input id="adj-search" className={inp} placeholder="Order number" value={orderSearch} onChange={(e) => setOrderSearch(e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <label className={lbl} htmlFor="adj-order">Order {loadingOrders && <span className="normal-case font-normal text-gray-400">loading…</span>}</label>
              <select id="adj-order" className={inp} value={orderId} onChange={(e) => setOrderId(e.target.value)}>
                <option value="">{orders.length ? "Select the order…" : "No orders found"}</option>
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>#{o.orderNumber} · {formatDate(o.createdAt)} · {o.period} · commission {fmt(o.commission)}{o.status === "CANCELLED" || o.status === "REFUNDED" ? ` · ${o.status.toLowerCase()}` : ""}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {order && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <span className={lbl}>Type</span>
              <div className="flex gap-2" role="radiogroup" aria-label="Adjustment type">
                {(["ADD", "DEDUCT"] as const).map((d) => (
                  <button key={d} type="button" role="radio" aria-checked={direction === d} onClick={() => setDirection(d)}
                    className={`flex-1 py-2.5 text-sm font-semibold rounded-lg border transition-colors ${direction === d ? (d === "ADD" ? "bg-emerald-50 border-emerald-300 text-emerald-700" : "bg-red-50 border-red-300 text-red-600") : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
                    {d === "ADD" ? "Add (+)" : "Deduct (−)"}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className={lbl} htmlFor="adj-amount">Amount ($)</label>
              <input id="adj-amount" type="number" min="0.01" step="0.01" className={inp} placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div>
              <label className={lbl} htmlFor="adj-reason">Reason</label>
              <input id="adj-reason" className={inp} placeholder="Shown on the payout statement" value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-gray-500">
            {order && valid ? <>Adds <span className={`font-bold ${direction === "ADD" ? "text-emerald-600" : "text-red-600"}`}>{direction === "ADD" ? "+" : "−"}{fmt(value)}</span> to the <span className="font-semibold">{order.period}</span> payout (order #{order.orderNumber}).</> : "Fill in every field to add the adjustment."}
          </p>
          <button type="button" onClick={submit} disabled={!valid || busy}
            className="px-5 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed">
            {busy ? "Saving…" : "Add adjustment"}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between mb-3 gap-3">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Adjustments</h2>
        <input className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-64 max-w-full" placeholder="Search name, email or order" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Search adjustments" />
      </div>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-8">
        {shown.length === 0 ? (
          <p className="py-12 text-center text-sm text-gray-400">No adjustments yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                {["Date", "Name", "Order", "Payout month", "Amount", "Reason", "Status", ""].map((h) => (
                  <th key={h} className={`px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider ${h === "Amount" ? "text-right" : "text-left"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {shown.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50/40">
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{formatDate(r.createdAt)}</td>
                  <td className="px-4 py-3">
                    <p className="text-xs font-semibold text-gray-800">{r.userName}</p>
                    <p className="text-[11px] text-gray-400">{r.role === "PHYSICIAN" ? "Doctor" : "Medical Rep"} · {r.userEmail}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-700">{r.orderNumber ? `#${r.orderNumber}` : "—"}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{r.period}</td>
                  <td className={`px-4 py-3 text-right text-sm font-bold ${r.amount < 0 ? "text-red-600" : "text-emerald-600"}`}>{r.amount > 0 ? "+" : ""}{fmt(r.amount)}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{r.reason ?? "—"}{r.by && <span className="block text-[11px] text-gray-400">by {r.by}</span>}</td>
                  <td className="px-4 py-3"><span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold border ${STATUS[r.status].cls}`}>{STATUS[r.status].label}</span></td>
                  <td className="px-4 py-3 text-right">
                    {r.status === "PENDING" && (
                      <button type="button" disabled={busy} onClick={() => { if (confirm("Remove this adjustment? It will not be paid.")) remove(r.id); }}
                        className="text-xs font-medium text-red-500 hover:text-red-700 disabled:opacity-40">Remove</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
