"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import toast from "react-hot-toast";

export function CommissionEditor({
  value: initial,
  label,
  onSave,
  badgeColor = "violet",
}: {
  value:        number;
  label:        string;
  onSave:       (v: number) => Promise<void>;
  badgeColor?:  "violet" | "emerald" | "blue";
}) {
  const [editing, setEditing]        = useState(false);
  const [val, setVal]                = useState(String(initial));
  const [isPending, startTransition] = useTransition();
  const inputRef                     = useRef<HTMLInputElement>(null);

  useEffect(() => { if (!editing) setVal(String(initial)); }, [initial, editing]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const save = () => {
    const n = parseFloat(val);
    if (isNaN(n) || n < 0 || n > 100) { toast.error("Must be between 0 and 100"); return; }
    startTransition(async () => {
      await onSave(n);
      setEditing(false);
    });
  };

  const badgeCls =
    badgeColor === "emerald" ? "bg-emerald-50 text-emerald-700 group-hover:bg-emerald-100" :
    badgeColor === "blue"    ? "bg-gray-900/10 text-[#5BB8D4] group-hover:bg-gray-900/20" :
                               "bg-violet-50 text-violet-700 group-hover:bg-violet-100";

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        title={`Edit ${label}`}
        className="group flex items-center gap-1 transition-colors"
      >
        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${badgeCls}`}>
          {initial}%
        </span>
        <svg className="w-3 h-3 text-gray-300 group-hover:text-[#3DBFA4]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 2.828L11.828 15.828a4 4 0 01-1.414.828L8 17l.343-2.414A4 4 0 019 13z" />
        </svg>
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      <input
        ref={inputRef}
        type="number"
        min={0}
        max={100}
        step={0.5}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
        className="w-16 px-2 py-1 text-xs border border-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/30 font-semibold text-center"
      />
      <span className="text-xs text-gray-400">%</span>
      <button
        type="button"
        onClick={save}
        disabled={isPending}
        className="w-6 h-6 flex items-center justify-center bg-gray-900 text-white rounded-md hover:bg-gray-700 disabled:opacity-50"
      >
        {isPending
          ? <span className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
          : <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
        }
      </button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        className="w-6 h-6 flex items-center justify-center bg-gray-100 text-gray-500 rounded-md hover:bg-gray-200"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
      </button>
    </span>
  );
}
