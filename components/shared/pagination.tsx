"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

interface PaginationProps {
  total:    number;
  page:     number;
  pageSize: number;
}

const PAGE_SIZES = [10, 25, 50, 100];

export function Pagination({ total, page, pageSize }: PaginationProps) {
  const pathname    = usePathname();
  const searchParams = useSearchParams();
  const totalPages  = Math.ceil(total / pageSize);

  function buildUrl(p: number, ps?: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(p));
    if (ps) params.set("pageSize", String(ps));
    return `${pathname}?${params.toString()}`;
  }

  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end   = Math.min(page * pageSize, total);

  // Page window: show up to 5 pages around current
  const pages: (number | "…")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push("…");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push("…");
    pages.push(totalPages);
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-gray-100 bg-white">
      {/* Left: count + page size */}
      <div className="flex items-center gap-3 text-sm text-gray-500">
        <span>
          {total === 0 ? "No results" : `${start}–${end} of ${total}`}
        </span>
        <span className="text-gray-300">|</span>
        <span className="flex items-center gap-1.5">
          Rows:
          <select
            value={pageSize}
            onChange={e => {
              window.location.href = buildUrl(1, Number(e.target.value));
            }}
            className="border border-gray-200 rounded px-1.5 py-0.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-1 focus:ring-gray-300"
          >
            {PAGE_SIZES.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </span>
      </div>

      {/* Right: page buttons */}
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <Link
            href={buildUrl(page - 1)}
            aria-disabled={page <= 1}
            className={`px-2.5 py-1.5 rounded text-sm font-medium transition-colors ${
              page <= 1
                ? "text-gray-300 pointer-events-none"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            ‹
          </Link>
          {pages.map((p, i) =>
            p === "…" ? (
              <span key={`ellipsis-${i}`} className="px-2 py-1.5 text-sm text-gray-400">…</span>
            ) : (
              <Link
                key={p}
                href={buildUrl(p)}
                className={`min-w-[32px] px-2.5 py-1.5 rounded text-sm font-medium text-center transition-colors ${
                  p === page
                    ? "bg-gray-900 text-white"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {p}
              </Link>
            )
          )}
          <Link
            href={buildUrl(page + 1)}
            aria-disabled={page >= totalPages}
            className={`px-2.5 py-1.5 rounded text-sm font-medium transition-colors ${
              page >= totalPages
                ? "text-gray-300 pointer-events-none"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            ›
          </Link>
        </div>
      )}
    </div>
  );
}

/** Client-side pagination controls (for tables that filter in-memory) */
export function ClientPagination({
  total, page, pageSize, onPage, onPageSize,
}: {
  total: number; page: number; pageSize: number;
  onPage: (p: number) => void; onPageSize: (ps: number) => void;
}) {
  const totalPages = Math.ceil(total / pageSize);
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end   = Math.min(page * pageSize, total);

  const pages: (number | "…")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push("…");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push("…");
    pages.push(totalPages);
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-gray-100 bg-white">
      <div className="flex items-center gap-3 text-sm text-gray-500">
        <span>{total === 0 ? "No results" : `${start}–${end} of ${total}`}</span>
        <span className="text-gray-300">|</span>
        <span className="flex items-center gap-1.5">
          Rows:
          <select
            value={pageSize}
            onChange={e => { onPageSize(Number(e.target.value)); onPage(1); }}
            className="border border-gray-200 rounded px-1.5 py-0.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-1 focus:ring-gray-300"
          >
            {PAGE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </span>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPage(page - 1)} disabled={page <= 1}
            className={`px-2.5 py-1.5 rounded text-sm font-medium transition-colors ${page <= 1 ? "text-gray-300" : "text-gray-600 hover:bg-gray-100"}`}
          >‹</button>
          {pages.map((p, i) =>
            p === "…" ? (
              <span key={`e-${i}`} className="px-2 py-1.5 text-sm text-gray-400">…</span>
            ) : (
              <button
                key={p} onClick={() => onPage(p as number)}
                className={`min-w-[32px] px-2.5 py-1.5 rounded text-sm font-medium text-center transition-colors ${p === page ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"}`}
              >{p}</button>
            )
          )}
          <button
            onClick={() => onPage(page + 1)} disabled={page >= totalPages}
            className={`px-2.5 py-1.5 rounded text-sm font-medium transition-colors ${page >= totalPages ? "text-gray-300" : "text-gray-600 hover:bg-gray-100"}`}
          >›</button>
        </div>
      )}
    </div>
  );
}
