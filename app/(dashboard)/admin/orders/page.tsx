import { listOrders }           from "@/actions/admin/manage-orders";
import { ReturnOrderModal }     from "@/components/admin/return-order-modal";
import { OrdersTableClient }   from "@/components/admin/orders-table-client";
import { OrderStatusFilter }   from "@/components/admin/order-status-filter";
import { OrderSearchInput }    from "@/components/admin/order-search-input";
import { Pagination }          from "@/components/shared/pagination";
import { parsePagination }     from "@/lib/pagination";
import { Suspense }            from "react";

export const metadata = { title: "Order – Pronuvia Admin" };

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function SummaryCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <div className="w-8 h-1 rounded-full mb-3" style={{ background: color }} />
      <p className="text-xl font-bold text-gray-800">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const { page, pageSize, skip, take } = parsePagination(sp);
  const status = typeof sp.status === "string" && sp.status ? sp.status : undefined;
  const q      = typeof sp.q      === "string" && sp.q      ? sp.q      : undefined;

  // Paginated (filtered) + full unfiltered totals in parallel
  const [{ orders, total }, { orders: allOrders }] = await Promise.all([
    listOrders({ skip, take, status, q }),
    listOrders({}),
  ]);

  // Per-status counts for filter tab badges
  const statusCounts = allOrders.reduce<Record<string, number>>((acc, o) => {
    acc[o.status] = (acc[o.status] ?? 0) + 1;
    return acc;
  }, {});

  const totalRevenue   = allOrders.reduce((s, o) => s + o.total,                    0);
  const totalRepComm   = allOrders.reduce((s, o) => s + o.salesRepCommissionAmount,  0);
  const totalDrComm    = allOrders.reduce((s, o) => s + o.physicianCommissionAmount, 0);
  const totalClawback  = allOrders.reduce((s, o) => s + (o.salesRepClawback ?? 0),  0);
  const completedCount = allOrders.filter((o) => o.status === "COMPLETED").length;
  const pendingCount   = allOrders.filter((o) => o.status === "PENDING" || o.status === "PROCESSING").length;
  const returnedCount  = allOrders.filter((o) => !!o.returnedAt).length;

  return (
    <div className="space-y-6">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Order</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Track orders, update statuses, and manage commission clawbacks
          </p>
        </div>
        <ReturnOrderModal />
      </div>

      {/* ── Summary cards ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          label="Total Revenue"
          value={fmt(totalRevenue)}
          sub={`${allOrders.length} orders total`}
          color="#3DBFA4"
        />
        <SummaryCard
          label="Rep Commissions Paid"
          value={fmt(totalRepComm)}
          sub={`${completedCount} completed`}
          color="#5BB8D4"
        />
        <SummaryCard
          label="Commissions Earned"
          value={fmt(totalDrComm)}
          sub={`${pendingCount} pending`}
          color="#8b5cf6"
        />
        <SummaryCard
          label="Commissions Clawed Back"
          value={fmt(totalClawback)}
          sub={`${returnedCount} returned`}
          color="#f97316"
        />
      </div>

      {/* ── Orders table ───────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">

        {/* Table header + search + status dropdown */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-sm font-semibold text-gray-700">
            All Orders
            <span className="ml-2 text-xs font-normal text-gray-400">({total})</span>
          </h2>
          <div className="flex items-center gap-2">
            <OrderSearchInput current={q} status={status} />
            <OrderStatusFilter current={status} counts={statusCounts} />
          </div>
        </div>

        <OrdersTableClient orders={orders} />

        <Suspense>
          <Pagination total={total} page={page} pageSize={pageSize} />
        </Suspense>
      </div>
    </div>
  );
}
