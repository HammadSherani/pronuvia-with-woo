"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface Props {
  from?: string; // YYYY-MM-DD
  to?:   string; // YYYY-MM-DD
}

export function DashboardDateFilter({ from, to }: Props) {
  const router = useRouter();
  const [fromVal, setFromVal] = useState(from ?? "");
  const [toVal,   setToVal]   = useState(to   ?? "");

  const hasFilter = !!(from || to);

  function apply() {
    const params = new URLSearchParams();
    if (fromVal) params.set("from", fromVal);
    if (toVal)   params.set("to",   toVal);
    router.push(`?${params.toString()}`);
  }

  function reset() {
    setFromVal("");
    setToVal("");
    router.push("?");
  }

  return (
    <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
      <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>

      <input
        type="date"
        value={fromVal}
        onChange={e => setFromVal(e.target.value)}
        className="text-xs text-gray-600 border-none outline-none bg-transparent w-32 cursor-pointer"
        placeholder="From"
      />

      <span className="text-gray-300 text-xs">→</span>

      <input
        type="date"
        value={toVal}
        onChange={e => setToVal(e.target.value)}
        min={fromVal || undefined}
        className="text-xs text-gray-600 border-none outline-none bg-transparent w-32 cursor-pointer"
        placeholder="To"
      />

      <button
        onClick={apply}
        disabled={!fromVal && !toVal}
        className="ml-1 px-2.5 py-1 text-[11px] font-semibold text-white bg-[#3DBFA4] hover:bg-[#35aa92] disabled:opacity-40 rounded-lg transition-colors"
      >
        Apply
      </button>

      {hasFilter && (
        <button
          onClick={reset}
          className="text-[11px] font-medium text-gray-400 hover:text-gray-600 transition-colors"
        >
          Reset
        </button>
      )}
    </div>
  );
}
