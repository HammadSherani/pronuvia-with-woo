"use client";

import { useState, useTransition, useCallback, useMemo } from "react";
import * as XLSX from "xlsx";
import {
  getOverallSalesReport,         type SalesRow,
  getSalesByProductReport,       type ProductRow,
  getReturnOrdersReport,         type ReturnRow,
  getOverallCommissionReport,    type OverallCommRow,
  getCustomerOrderHistoryReport, type CustomerHistoryRow,
  type ReportFilters,
} from "@/actions/admin/reports";
import { toDateInputValue } from "@/lib/utils/timezone";

type FilterOption = { id: string; name: string };

interface Props {
  doctors:   FilterOption[];
  salesReps: FilterOption[];
  products:  FilterOption[];
}

// ── Tabs ──────────────────────────────────────────────────────
const TABS = [
  { id: "overall-sales",      label: "Overall Sales" },
  { id: "by-product",         label: "Sales by Product" },
  { id: "returns",            label: "Return Orders" },
  { id: "overall-commission", label: "Overall Commission" },
  { id: "customer-history",   label: "Order Details" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const ORDER_STATUSES = ["PENDING","PROCESSING","SHIPPED","DELIVERED","COMPLETED","CANCELLED","REFUNDED"];
const PAGE_SIZE = 50;

// ── Helpers ───────────────────────────────────────────────────
function usd(n: number) { return n.toLocaleString("en-US", { style: "currency", currency: "USD" }); }
function pct(n: number) { return `${n.toFixed(2)}%`; }

function StatusBadge({ status }: { status: string }) {
  const color: Record<string, string> = {
    PENDING:    "bg-yellow-100 text-yellow-700",
    PROCESSING: "bg-blue-100 text-blue-700",
    SHIPPED:    "bg-purple-100 text-purple-700",
    DELIVERED:  "bg-teal-100 text-teal-700",
    COMPLETED:  "bg-green-100 text-green-700",
    CANCELLED:  "bg-red-100 text-red-700",
    REFUNDED:   "bg-orange-100 text-orange-700",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${color[status] ?? "bg-gray-100 text-gray-600"}`}>
      {status}
    </span>
  );
}

// ── Generic table ─────────────────────────────────────────────
type Col = {
  key: string; label: string; align?: "right";
  render?: (val: unknown, row: Record<string, unknown>) => React.ReactNode;
};

function ReportTable({ cols, rows, loading }: {
  cols: Col[]; rows: Record<string, unknown>[]; loading: boolean;
}) {
  if (loading) return (
    <div className="flex items-center justify-center py-20 text-sm text-gray-400 gap-2">
      <span className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
      Loading report…
    </div>
  );
  if (!rows.length) return (
    <div className="text-center py-16 text-sm text-gray-400">No data found for the selected filters.</div>
  );
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50/80 border-b border-gray-200">
            {cols.map(c => (
              <th key={c.key} className={`px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap ${c.align === "right" ? "text-right" : "text-left"}`}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-gray-50/50 transition-colors">
              {cols.map(c => (
                <td key={c.key} className={`px-4 py-2.5 text-gray-700 whitespace-nowrap ${c.align === "right" ? "text-right font-medium" : ""}`}>
                  {c.render ? c.render(row[c.key], row) : String(row[c.key] ?? "–")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Export helpers ────────────────────────────────────────────
function exportExcel(
  data: Record<string, unknown>[],
  cols: Col[],
  filename: string,
  tab: TabId,
) {
  if (!data.length) return;

  let exportData: Record<string, unknown>[];

  if (tab === "customer-history") {
    // Full detailed export for Order Details tab
    exportData = (data as unknown as CustomerHistoryRow[]).map(r => ({
      "Order #":             r.orderNumber,
      "Order Date":          r.date,
      "Status":              r.status,
      "Items":               r.itemsSummary,
      "Patient Email":       r.patientEmail,
      "Patient Phone":       r.patientPhone,
      "Doctor":              r.doctor,
      "Doctor Email":        r.doctorEmail,
      "Medical Rep":         r.salesRep,
      "Medical Rep Email":   r.salesRepEmail,
      "Subtotal":            r.subtotal,
      "Shipping":            r.shippingRate,
      "Coupon Code":         r.couponCode,
      "Discount":            r.discountAmount,
      "Total":               r.total,
      "Payment Method":      r.paymentMethod,
      "Tracking #":          r.trackingNumber,
      "Carrier":             r.shippingCarrier,
      "Billing Address":     r.billingAddress,
      "Shipping Address":    r.shippingAddress,
    }));
  } else {
    exportData = data.map(row => {
      const out: Record<string, unknown> = {};
      cols.forEach(c => { out[c.label] = row[c.key] ?? ""; });
      return out;
    });
  }

  const ws = XLSX.utils.json_to_sheet(exportData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Report");
  XLSX.writeFile(wb, `${filename}_${toDateInputValue(new Date())}.xlsx`);
}

// ── Column definitions ────────────────────────────────────────
const COLS: Record<TabId, Col[]> = {
  "overall-sales": [
    { key: "orderNumber", label: "Order #" },
    { key: "date",        label: "Date" },
    { key: "doctor",      label: "Doctor" },
    { key: "salesRep",    label: "Medical Rep" },
    { key: "status",      label: "Status", render: v => <StatusBadge status={String(v)} /> },
    { key: "subtotal",    label: "Subtotal",  align: "right", render: v => usd(Number(v)) },
    { key: "shipping",    label: "Shipping",  align: "right", render: v => usd(Number(v)) },
    { key: "discount",    label: "Discount",  align: "right", render: v => v ? `−${usd(Number(v))}` : "–" },
    { key: "total",       label: "Total",     align: "right", render: v => <span className="font-bold">{usd(Number(v))}</span> },
    { key: "paymentMethod", label: "Payment" },
  ],
  "by-product": [
    { key: "title",      label: "Product" },
    { key: "sku",        label: "SKU" },
    { key: "size",       label: "Size / Variant" },
    { key: "quantity",   label: "Qty Sold",    align: "right" },
    { key: "unitPrice",  label: "Unit Price",  align: "right", render: v => usd(Number(v)) },
    { key: "revenue",    label: "Revenue",     align: "right", render: v => <span className="font-bold">{usd(Number(v))}</span> },
    { key: "orderCount", label: "# Orders",    align: "right" },
  ],
  "returns": [
    { key: "orderNumber",       label: "Order #" },
    { key: "orderDate",         label: "Order Date" },
    { key: "returnDate",        label: "Return Date" },
    { key: "doctor",            label: "Doctor" },
    { key: "salesRep",          label: "Medical Rep" },
    { key: "originalTotal",     label: "Original Total",  align: "right", render: v => usd(Number(v)) },
    { key: "returnedTotal",     label: "Returned Total",  align: "right", render: v => usd(Number(v)) },
    { key: "returnReason",      label: "Reason" },
    { key: "srClawback",        label: "SR Clawback",     align: "right", render: v => usd(Number(v)) },
    { key: "physicianClawback", label: "Dr Clawback",     align: "right", render: v => usd(Number(v)) },
  ],
  "overall-commission": [
    { key: "orderNumber",    label: "Order #" },
    { key: "date",           label: "Date" },
    { key: "doctor",         label: "Doctor" },
    { key: "salesRep",       label: "Medical Rep" },
    { key: "orderTotal",     label: "Order Total",    align: "right", render: v => usd(Number(v)) },
    { key: "srCommRate",     label: "SR Rate",        align: "right", render: v => pct(Number(v)) },
    { key: "srCommAmount",   label: "SR Commission",  align: "right", render: v => usd(Number(v)) },
    { key: "docCommRate",    label: "Dr Rate",        align: "right", render: v => pct(Number(v)) },
    { key: "docCommAmount",  label: "Dr Commission",  align: "right", render: v => usd(Number(v)) },
    { key: "totalCommission",label: "Total Comm.",    align: "right", render: v => <span className="font-bold">{usd(Number(v))}</span> },
    { key: "paid",           label: "Paid?", render: v => v
      ? <span className="text-green-600 font-semibold">Yes</span>
      : <span className="text-orange-500">No</span> },
  ],
  "customer-history": [
    { key: "orderNumber",  label: "Order #" },
    { key: "date",         label: "Date" },
    { key: "doctor",       label: "Doctor", render: (v, row) => (
      <div>
        <p className="font-medium text-gray-800">{(v != null && v !== "") ? String(v) : "–"}</p>
        {(row.doctorEmail != null && row.doctorEmail !== "") && (
          <a href={`mailto:${String(row.doctorEmail)}`} className="text-[11px] text-blue-500 hover:underline mt-0.5 block">{String(row.doctorEmail)}</a>
        )}
      </div>
    )},
    { key: "salesRep",     label: "Medical Rep", render: (v, row) => (
      <div>
        <p className="font-medium text-gray-800">{(v != null && v !== "") ? String(v) : "–"}</p>
        {(row.salesRepEmail != null && row.salesRepEmail !== "") && (
          <a href={`mailto:${String(row.salesRepEmail)}`} className="text-[11px] text-blue-500 hover:underline mt-0.5 block">{String(row.salesRepEmail)}</a>
        )}
      </div>
    )},
    { key: "patientEmail", label: "Patient", render: (v, row) => {
      const pe = (v != null && v !== "") ? String(v) : "";
      const ph = (row.patientPhone != null && row.patientPhone !== "") ? String(row.patientPhone) : "";
      if (pe || ph) return (
        <div>
          {pe && <a href={`mailto:${pe}`} className="text-xs text-blue-600 hover:underline block">{pe}</a>}
          {ph && <p className="text-[11px] text-gray-400 mt-0.5">{ph}</p>}
        </div>
      );
      const de = (row.doctorEmail != null && row.doctorEmail !== "") ? String(row.doctorEmail) : "";
      if (de) return (
        <span className="text-xs text-gray-400">
          {de}{" "}<span className="text-[10px] bg-gray-100 text-gray-400 px-1 rounded">Dr</span>
        </span>
      );
      return <span className="text-gray-300">–</span>;
    }},
    { key: "status",       label: "Status", render: v => <StatusBadge status={String(v)} /> },
    { key: "itemsSummary", label: "Items", render: v => (
      <span className="max-w-xs truncate block" title={String(v)}>{String(v) || "–"}</span>
    )},
    { key: "subtotal",     label: "Subtotal",  align: "right", render: v => usd(Number(v)) },
    { key: "shippingRate", label: "Shipping",  align: "right", render: v => Number(v) > 0 ? usd(Number(v)) : <span className="text-[#3DBFA4] font-medium">Free</span> },
    { key: "total",        label: "Total",     align: "right", render: v => <span className="font-bold">{usd(Number(v))}</span> },
    { key: "trackingNumber", label: "Tracking", render: (v, row) => {
      const tn = v != null && v !== "" ? String(v) : "";
      if (!tn) return <span className="text-gray-300 text-xs">–</span>;
      const carrier = row.shippingCarrier != null && row.shippingCarrier !== "" ? String(row.shippingCarrier) : "";
      return (
        <div>
          {carrier && <p className="text-[11px] text-gray-400">{carrier}</p>}
          <p className="text-xs font-mono font-semibold text-indigo-600">{tn}</p>
        </div>
      );
    }},
  ],
};

// ── Filters shown per tab ────────────────────────────────────
const TAB_FILTERS: Record<TabId, { doctor?: boolean; salesRep?: boolean; status?: boolean; product?: boolean }> = {
  "overall-sales":      { doctor: true, salesRep: true, status: true },
  "by-product":         { doctor: true, salesRep: true, product: true },
  "returns":            { doctor: true, salesRep: true },
  "overall-commission": { doctor: true, salesRep: true, status: true },
  "customer-history":   { doctor: true, salesRep: true, status: true },
};

// ── Summary cards ────────────────────────────────────────────
function SummaryCards({ tab, data }: { tab: TabId; data: Record<string, unknown>[] }) {
  const cards = useMemo(() => {
    if (!data.length) return [];
    if (tab === "overall-sales") {
      const total  = (data as unknown as SalesRow[]).reduce((s, r) => s + r.total, 0);
      const orders = data.length;
      return [
        { label: "Total Orders",    value: orders.toString() },
        { label: "Revenue",         value: usd(total) },
        { label: "Avg Order Value", value: usd(total / orders) },
      ];
    }
    if (tab === "by-product") {
      const revenue = (data as unknown as ProductRow[]).reduce((s, r) => s + r.revenue, 0);
      const qty     = (data as unknown as ProductRow[]).reduce((s, r) => s + r.quantity, 0);
      return [
        { label: "Unique Products", value: data.length.toString() },
        { label: "Units Sold",      value: qty.toString() },
        { label: "Total Revenue",   value: usd(revenue) },
      ];
    }
    if (tab === "returns") {
      const returnedTotal = (data as unknown as ReturnRow[]).reduce((s, r) => s + r.returnedTotal, 0);
      const clawback      = (data as unknown as ReturnRow[]).reduce((s, r) => s + r.srClawback, 0);
      return [
        { label: "Total Returns",     value: data.length.toString() },
        { label: "Amount Returned",   value: usd(returnedTotal) },
        { label: "Total SR Clawback", value: usd(clawback) },
      ];
    }
    if (tab === "overall-commission") {
      const total = (data as unknown as OverallCommRow[]).reduce((s, r) => s + r.totalCommission, 0);
      const sr    = (data as unknown as OverallCommRow[]).reduce((s, r) => s + r.srCommAmount, 0);
      const doc   = (data as unknown as OverallCommRow[]).reduce((s, r) => s + r.docCommAmount, 0);
      return [
        { label: "Total Commissions", value: usd(total) },
        { label: "Medical Rep Share", value: usd(sr) },
        { label: "Doctor Share",      value: usd(doc) },
      ];
    }
    if (tab === "customer-history") {
      const total    = (data as unknown as CustomerHistoryRow[]).reduce((s, r) => s + r.total, 0);
      const shipping = (data as unknown as CustomerHistoryRow[]).reduce((s, r) => s + r.shippingRate, 0);
      return [
        { label: "Total Orders",   value: data.length.toString() },
        { label: "Total Revenue",  value: usd(total) },
        { label: "Total Shipping", value: usd(shipping) },
      ];
    }
    return [];
  }, [tab, data]);

  if (!cards.length) return null;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
      {cards.map(c => (
        <div key={c.label} className="bg-white border border-gray-100 rounded-xl px-4 py-3 shadow-sm">
          <p className="text-xs text-gray-500 mb-0.5">{c.label}</p>
          <p className="text-lg font-bold text-gray-800">{c.value}</p>
        </div>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────
export function ReportsClient({ doctors, salesReps, products }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>("overall-sales");
  const [filters,   setFilters]   = useState<ReportFilters>({});
  const [search,    setSearch]    = useState("");
  const [data,      setData]      = useState<Record<string, unknown>[]>([]);
  const [loaded,    setLoaded]    = useState(false);
  const [page,      setPage]      = useState(1);
  const [isPending, startTransition] = useTransition();

  const tf   = TAB_FILTERS[activeTab];
  const cols = COLS[activeTab];

  const runReport = useCallback((tab: TabId, f: ReportFilters) => {
    startTransition(async () => {
      let rows: Record<string, unknown>[] = [];
      if (tab === "overall-sales")      rows = (await getOverallSalesReport(f))           as unknown as Record<string, unknown>[];
      else if (tab === "by-product")    rows = (await getSalesByProductReport(f))         as unknown as Record<string, unknown>[];
      else if (tab === "returns")       rows = (await getReturnOrdersReport(f))           as unknown as Record<string, unknown>[];
      else if (tab === "overall-commission") rows = (await getOverallCommissionReport(f)) as unknown as Record<string, unknown>[];
      else if (tab === "customer-history")  rows = (await getCustomerOrderHistoryReport(f)) as unknown as Record<string, unknown>[];
      setData(rows);
      setLoaded(true);
      setPage(1);
    });
  }, []);

  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab);
    setData([]);
    setLoaded(false);
    setSearch("");
    setPage(1);
  };

  const handleApply = () => runReport(activeTab, filters);

  const handleReset = () => {
    setFilters({});
    setSearch("");
    setData([]);
    setLoaded(false);
    setPage(1);
  };

  // Client-side search filter
  const filteredData = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter(row =>
      Object.values(row).some(v => String(v ?? "").toLowerCase().includes(q))
    );
  }, [data, search]);

  // Pagination
  const totalPages = Math.ceil(filteredData.length / PAGE_SIZE);
  const pageData   = filteredData.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const inp = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition";
  const sel = inp;

  return (
    <div>
      {/* Tab bar */}
      <div className="border-b border-gray-200 mb-6 overflow-x-auto">
        <div className="flex min-w-max">
          {TABS.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => handleTabChange(t.id)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors cursor-pointer ${
                activeTab === t.id
                  ? "border-gray-900 text-gray-900"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filter panel */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          {/* Date range — always shown */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
            <input type="date" className={inp} value={filters.from ?? ""}
              onChange={e => setFilters(f => ({ ...f, from: e.target.value || undefined }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
            <input type="date" className={inp} value={filters.to ?? ""}
              onChange={e => setFilters(f => ({ ...f, to: e.target.value || undefined }))} />
          </div>

          {tf.doctor && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Doctor</label>
              <select className={sel} value={filters.physicianId ?? ""}
                onChange={e => setFilters(f => ({ ...f, physicianId: e.target.value || undefined }))}>
                <option value="">All Doctors</option>
                {doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          )}

          {tf.salesRep && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Medical Rep</label>
              <select className={sel} value={filters.salesRepId ?? ""}
                onChange={e => setFilters(f => ({ ...f, salesRepId: e.target.value || undefined }))}>
                <option value="">All Medical Reps</option>
                {salesReps.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
          )}

          {tf.status && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
              <select className={sel} value={filters.status ?? ""}
                onChange={e => setFilters(f => ({ ...f, status: e.target.value || undefined }))}>
                <option value="">All Statuses</option>
                {ORDER_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}

          {tf.product && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Product</label>
              <select className={sel} value={filters.product ?? ""}
                onChange={e => setFilters(f => ({ ...f, product: e.target.value || undefined }))}>
                <option value="">All Products</option>
                {products.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
              </select>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 mt-3">
          <button type="button" onClick={handleApply} disabled={isPending}
            className="px-5 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors flex items-center gap-2 cursor-pointer">
            {isPending && <span className="w-3.5 h-3.5 border-2 border-white/50 border-t-white rounded-full animate-spin" />}
            {isPending ? "Loading…" : "Run Report"}
          </button>
          <button type="button" onClick={handleReset}
            className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg transition-colors cursor-pointer">
            Reset
          </button>
        </div>
      </div>

      {/* Results panel */}
      {loaded && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <input
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-gray-900 w-52 transition"
                placeholder="Search results…"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
              />
              <span className="text-xs text-gray-400">
                {filteredData.length} result{filteredData.length !== 1 ? "s" : ""}
              </span>
            </div>
            <button
              type="button"
              disabled={!filteredData.length}
              onClick={() => exportExcel(filteredData, cols, activeTab, activeTab)}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 border border-emerald-300 bg-emerald-50 text-emerald-700 text-sm font-medium rounded-lg hover:bg-emerald-100 disabled:opacity-40 transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export Excel
            </button>
          </div>

          {/* Summary cards */}
          <div className="px-4 pt-4">
            <SummaryCards tab={activeTab} data={filteredData} />
          </div>

          {/* Table */}
          <ReportTable cols={cols} rows={pageData} loading={isPending} />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-sm text-gray-500">
              <span>Page {page} of {totalPages} ({filteredData.length} rows)</span>
              <div className="flex items-center gap-1">
                <button disabled={page <= 1} onClick={() => setPage(1)}
                  className="px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40 cursor-pointer">«</button>
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                  className="px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40 cursor-pointer">‹</button>
                <span className="px-3">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const pg = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
                    return (
                      <button key={pg} onClick={() => setPage(pg)}
                        className={`px-2.5 py-1 rounded mx-0.5 border transition-colors cursor-pointer ${page === pg ? "bg-gray-900 text-white border-gray-900" : "border-gray-200 hover:bg-gray-50"}`}>
                        {pg}
                      </button>
                    );
                  })}
                </span>
                <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                  className="px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40 cursor-pointer">›</button>
                <button disabled={page >= totalPages} onClick={() => setPage(totalPages)}
                  className="px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40 cursor-pointer">»</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty state (before first run) */}
      {!loaded && !isPending && (
        <div className="text-center py-20 text-gray-400">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-sm font-medium text-gray-500">Select filters and click <strong>Run Report</strong></p>
          <p className="text-xs text-gray-400 mt-1">Leave filters empty to load all data</p>
        </div>
      )}
    </div>
  );
}
