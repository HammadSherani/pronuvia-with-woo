"use client";

import { useRouter } from "next/navigation";
import { useRef, useTransition } from "react";

export function OrderSearchInput({
  current,
  status,
}: {
  current?: string;
  status?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const ref = useRef<HTMLInputElement>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = ref.current?.value.trim() ?? "";
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    params.set("page", "1");
    startTransition(() => router.push(`?${params.toString()}`));
  }

  function clear() {
    if (ref.current) ref.current.value = "";
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    params.set("page", "1");
    startTransition(() => router.push(`?${params.toString()}`));
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-1.5">
      <div className="relative">
        <svg
          className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          ref={ref}
          type="text"
          defaultValue={current ?? ""}
          placeholder="Search order #..."
          className="pl-8 pr-7 py-1.5 text-xs border border-gray-200 rounded-lg bg-white shadow-sm outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-200 w-44 transition-all placeholder:text-gray-400"
        />
        {current && (
          <button
            type="button"
            onClick={clear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="px-3 py-1.5 text-xs font-semibold text-white bg-gray-800 hover:bg-gray-900 disabled:opacity-50 rounded-lg transition-colors shadow-sm"
      >
        {isPending ? "…" : "Search"}
      </button>
    </form>
  );
}
