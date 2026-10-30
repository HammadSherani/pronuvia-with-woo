"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { OrdersRange } from "@/lib/orders/date-range";

const LABELS: Record<OrdersRange, string> = {
  "all":        "All",
  "today":      "Today",
  "week":       "This week",
  "month":      "This month",
  "last-month": "Last month",
  "6-months":   "Last 6 months",
  "custom":     "Custom",
};
const DEFAULT_PRESETS: OrdersRange[] = ["all", "today", "month", "last-month", "custom"];

/** Orders date filter: presets, or a custom from–to range (kept in the URL). */
export function OrdersDateFilter({ range, from, to, presets = DEFAULT_PRESETS }: {
  range: OrdersRange; from: string; to: string;
  presets?: OrdersRange[];
}) {
  const router   = useRouter();
  const pathname = usePathname();
  const sp       = useSearchParams();
  const [custom,  setCustom]  = useState(range === "custom");
  const [fromVal, setFromVal] = useState(from);
  const [toVal,   setToVal]   = useState(to);

  const go = (next: Record<string, string>) => {
    const params = new URLSearchParams(sp.toString());
    for (const k of ["range", "from", "to", "page"]) params.delete(k);
    for (const [k, v] of Object.entries(next)) if (v) params.set(k, v);
    const q = params.toString();
    router.push(q ? `${pathname}?${q}` : pathname);
  };

  const active = custom ? "custom" : range;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex flex-wrap bg-white border border-gray-200 rounded-xl p-1 shadow-sm">
        {presets.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              if (value === "custom") { setCustom(true); return; }
              setCustom(false);
              go(value === "all" ? {} : { range: value });
            }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              active === value ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            {LABELS[value]}
          </button>
        ))}
      </div>

      {custom && (
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-1.5 shadow-sm">
          <input
            type="date"
            value={fromVal}
            max={toVal || undefined}
            onChange={(e) => setFromVal(e.target.value)}
            className="text-xs text-gray-600 border-none outline-none bg-transparent cursor-pointer"
            aria-label="From"
          />
          <span className="text-gray-300 text-xs">→</span>
          <input
            type="date"
            value={toVal}
            min={fromVal || undefined}
            onChange={(e) => setToVal(e.target.value)}
            className="text-xs text-gray-600 border-none outline-none bg-transparent cursor-pointer"
            aria-label="To"
          />
          <button
            type="button"
            onClick={() => go({ range: "custom", from: fromVal, to: toVal })}
            disabled={!fromVal && !toVal}
            className="px-2.5 py-1 text-[11px] font-semibold text-white bg-[#3DBFA4] hover:bg-[#35aa92] disabled:opacity-40 rounded-lg transition-colors"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
}
