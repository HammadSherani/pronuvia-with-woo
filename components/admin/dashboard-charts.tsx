"use client";

import { useState } from "react";
import {
  Area, Bar, ComposedChart, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import type { DashboardStats } from "@/actions/admin/dashboard";

type Period = "daily" | "weekly" | "monthly";

const STATUS_COLORS: Record<string, string> = {
  PENDING:    "#f59e0b",
  PROCESSING: "#3b82f6",
  SHIPPED:    "#8b5cf6",
  DELIVERED:  "#10b981",
  COMPLETED:  "#3DBFA4",
  CANCELLED:  "#ef4444",
  REFUNDED:   "#94a3b8",
};

const COMMISSION_COLORS = ["#3DBFA4", "#5BB8D4"];

function fmtMoney(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n);
}

function ChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-100 shadow-xl rounded-xl px-4 py-3 text-sm min-w-[140px]">
      <p className="text-gray-400 font-medium mb-2 text-xs">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
            <span className="text-gray-500 text-xs">{p.name}</span>
          </div>
          <span className="font-bold text-gray-800 text-xs">
            {p.name === "Revenue" ? fmtMoney(p.value) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-40 text-gray-300">
      <svg className="w-8 h-8 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
      <span className="text-xs">{message}</span>
    </div>
  );
}

function OrdersRevenueChart({ data }: { data: { label: string; orders: number; revenue: number }[] }) {
  const hasData = data.some((d) => d.orders > 0 || d.revenue > 0);
  if (!hasData) return <EmptyState message="No orders in this period" />;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
        <defs>
          <linearGradient id="areaRevenue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3DBFA4" stopOpacity={0.2} />
            <stop offset="100%" stopColor="#3DBFA4" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
        <YAxis yAxisId="left" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={28} />
        <YAxis
          yAxisId="right" orientation="right"
          tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={44}
          tickFormatter={(v) => v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f8fafc" }} />
        <Bar yAxisId="left" dataKey="orders" name="Orders" fill="#5BB8D4" fillOpacity={0.75} radius={[4, 4, 0, 0]} maxBarSize={32} />
        <Area yAxisId="right" dataKey="revenue" name="Revenue" stroke="#3DBFA4" strokeWidth={2.5} fill="url(#areaRevenue)" dot={false} activeDot={{ r: 4, strokeWidth: 0, fill: "#3DBFA4" }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function StatusDonut({ data }: { data: { status: string; count: number }[] }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  if (!total) return <EmptyState message="No order data" />;
  return (
    <div className="flex flex-col gap-4">
      <div className="relative flex items-center justify-center">
        <ResponsiveContainer width={160} height={160}>
          <PieChart>
            <Pie data={data} dataKey="count" nameKey="status" innerRadius={50} outerRadius={75} paddingAngle={2} startAngle={90} endAngle={450}>
              {data.map((entry) => (
                <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? "#94a3b8"} strokeWidth={0} />
              ))}
            </Pie>
            <Tooltip formatter={(v) => [`${v} orders`, "Count"]} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl font-bold text-gray-800">{total}</span>
          <span className="text-[11px] text-gray-400">orders</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
        {data.map((d) => (
          <div key={d.status} className="flex items-center gap-1.5 min-w-0">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: STATUS_COLORS[d.status] ?? "#94a3b8" }} />
            <span className="text-[11px] text-gray-500 capitalize truncate">{d.status.toLowerCase()}</span>
            <span className="text-[11px] font-bold text-gray-700 ml-auto shrink-0">{d.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CommissionDonut({ data }: { data: { name: string; value: number }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (!total) return <EmptyState message="No commission data" />;
  return (
    <div className="flex items-center gap-6">
      <div className="relative shrink-0">
        <ResponsiveContainer width={140} height={140}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={44} outerRadius={66} paddingAngle={4} startAngle={90} endAngle={450}>
              {data.map((_, i) => (
                <Cell key={i} fill={COMMISSION_COLORS[i % COMMISSION_COLORS.length]} strokeWidth={0} />
              ))}
            </Pie>
            <Tooltip formatter={(v) => [fmtMoney(Number(v)), "Commission"]} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-sm font-bold text-gray-800">{fmtMoney(total)}</span>
          <span className="text-[10px] text-gray-400">total</span>
        </div>
      </div>
      <div className="flex-1 space-y-3">
        {data.map((d, i) => (
          <div key={d.name}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: COMMISSION_COLORS[i] }} />
                <span className="text-xs text-gray-500">{d.name}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-gray-800 text-xs">{fmtMoney(d.value)}</span>
                <span className="text-gray-300 text-xs">·</span>
                <span className="text-gray-400 text-xs">{total > 0 ? Math.round((d.value / total) * 100) : 0}%</span>
              </div>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${total > 0 ? (d.value / total) * 100 : 0}%`,
                  background: COMMISSION_COLORS[i],
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DashboardChartsPanel({ charts }: { charts: DashboardStats["charts"] }) {
  const [period, setPeriod] = useState<Period>("monthly");

  const totalOrders  = charts[period].reduce((s, d) => s + d.orders,  0);
  const totalRevenue = charts[period].reduce((s, d) => s + d.revenue, 0);

  return (
    <div className="space-y-5">
      {/* Revenue & Orders + Status donut */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-5">
        {/* Main chart */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 px-6 pt-5 pb-3">
            <div>
              <h3 className="text-sm font-bold text-gray-800">Revenue &amp; Orders</h3>
              <div className="flex items-center gap-4 mt-1.5">
                <span className="flex items-center gap-1.5 text-xs text-gray-500">
                  <span className="w-2.5 h-2.5 rounded-sm bg-gray-900/75 inline-block" />
                  <span className="font-semibold text-gray-700">{totalOrders.toLocaleString()}</span> orders
                </span>
                <span className="flex items-center gap-1.5 text-xs text-gray-500">
                  <span className="w-3 h-0.5 bg-gray-900 inline-block rounded-full" />
                  <span className="font-semibold text-gray-700">{fmtMoney(totalRevenue)}</span> revenue
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 self-start">
              {(["daily", "weekly", "monthly"] as Period[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all capitalize ${
                    period === p
                      ? "bg-white text-gray-800 shadow-sm"
                      : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="px-2 pb-4">
            <OrdersRevenueChart data={charts[period]} />
          </div>
        </div>

        {/* Status donut */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col">
          <h3 className="text-sm font-bold text-gray-800">Order Status</h3>
          <p className="text-xs text-gray-400 mt-0.5 mb-4">Last 12 months</p>
          <div className="flex-1 flex flex-col justify-center">
            <StatusDonut data={charts.statusBreakdown} />
          </div>
        </div>
      </div>

      {/* Commission split */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-5">
        <div className="mb-4">
          <h3 className="text-sm font-bold text-gray-800">Commission Split</h3>
          <p className="text-xs text-gray-400 mt-0.5">Medical Rep vs Physician · last 12 months</p>
        </div>
        <CommissionDonut data={charts.commissionBreakdown} />
      </div>
    </div>
  );
}

export { DashboardChartsPanel as DashboardCharts };
