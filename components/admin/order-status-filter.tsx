"use client";

import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";

const STATUSES = [
  { key: "PENDING",    label: "Pending",    dot: "bg-amber-400"   },
  { key: "PROCESSING", label: "Processing", dot: "bg-blue-400"    },
  { key: "SHIPPED",    label: "Shipped",    dot: "bg-indigo-400"  },
  { key: "DELIVERED",  label: "Delivered",  dot: "bg-emerald-400" },
  { key: "COMPLETED",  label: "Completed",  dot: "bg-teal-400"    },
  { key: "CANCELLED",  label: "Cancelled",  dot: "bg-red-400"     },
  { key: "REFUNDED",   label: "Refunded",   dot: "bg-orange-400"  },
];

export function OrderStatusFilter({
  current,
  counts,
}: {
  current?: string;
  counts: Record<string, number>;
}) {
  const router  = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const active = STATUSES.find(s => s.key === current);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function select(key?: string) {
    setOpen(false);
    const params = new URLSearchParams();
    if (key) params.set("status", key);
    params.set("page", "1");
    router.push(`?${params.toString()}`);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-colors shadow-sm"
      >
        {active ? (
          <>
            <span className={`w-2 h-2 rounded-full shrink-0 ${active.dot}`} />
            {active.label}
          </>
        ) : (
          <>
            <span className="w-2 h-2 rounded-full shrink-0 bg-gray-300" />
            All Statuses
          </>
        )}
        <svg
          className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-44 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden py-1">
          {/* All option */}
          <button
            onClick={() => select(undefined)}
            className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-xs font-semibold hover:bg-gray-50 transition-colors ${
              !current ? "text-gray-900" : "text-gray-500"
            }`}
          >
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-gray-300" />
              All Statuses
            </span>
            <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
              {Object.values(counts).reduce((a, b) => a + b, 0)}
            </span>
          </button>

          <div className="h-px bg-gray-100 mx-2 my-1" />

          {STATUSES.map(s => {
            const count = counts[s.key] ?? 0;
            const isActive = current === s.key;
            return (
              <button
                key={s.key}
                onClick={() => select(s.key)}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-xs font-semibold hover:bg-gray-50 transition-colors ${
                  isActive ? "text-gray-900" : "text-gray-500"
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${s.dot}`} />
                  {s.label}
                </span>
                {count > 0 && (
                  <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
