"use client";

import { usePathname, useRouter } from "next/navigation";

// Month selector for monthly views: puts ?month=YYYY-MM in the URL
export function MonthPicker({ months, value }: { months: { key: string; label: string }[]; value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <select
      value={value}
      onChange={(e) => router.push(`${pathname}?month=${e.target.value}`)}
      aria-label="Month"
      className="text-sm font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900/20"
    >
      {months.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
    </select>
  );
}
