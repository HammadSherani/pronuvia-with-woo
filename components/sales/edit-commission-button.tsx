"use client";

import { useState, useRef } from "react";
import toast from "react-hot-toast";
import { updatePhysicianCommission } from "@/actions/sales-rep/update-physician-commission";

export function EditCommissionButton({
  physicianId,
  currentCommission,
  physicianName,
}: {
  physicianId:       string;
  currentCommission: number;
  physicianName:     string;
}) {
  const [open,    setOpen]    = useState(false);
  const [value,   setValue]   = useState(String(currentCommission));
  const [saving,  setSaving]  = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const openEdit = () => {
    setValue(String(currentCommission));
    setOpen(true);
    setTimeout(() => inputRef.current?.select(), 50);
  };

  const cancel = () => {
    setOpen(false);
    setValue(String(currentCommission));
  };

  const save = async () => {
    const num = parseFloat(value);
    if (isNaN(num) || num < 0 || num > 100) {
      toast.error("Enter a value between 0 and 100.");
      return;
    }
    setSaving(true);
    const result = await updatePhysicianCommission(physicianId, num);
    setSaving(false);
    if (result.success) {
      toast.success(`${physicianName}'s commission updated to ${num}%.`);
      setOpen(false);
    } else {
      toast.error(result.message);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter")  save();
    if (e.key === "Escape") cancel();
  };

  if (!open) {
    return (
      <div className="flex items-center gap-1.5 group">
        <span className="inline-flex px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-xs font-medium">
          {currentCommission}%
        </span>
        <button
          type="button"
          onClick={openEdit}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600"
          title="Edit commission"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center border border-gray-900 rounded-lg overflow-hidden shadow-sm">
        <input
          ref={inputRef}
          type="number"
          min={0}
          max={100}
          step={0.5}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          className="w-16 px-2 py-1 text-xs font-medium text-gray-800 outline-none bg-white"
        />
        <span className="pr-2 text-xs text-gray-400 bg-white">%</span>
      </div>

      {/* Save */}
      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="w-6 h-6 flex items-center justify-center rounded-md bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-50 transition-colors"
        title="Save"
      >
        {saving ? (
          <span className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />
        ) : (
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>

      {/* Cancel */}
      <button
        type="button"
        onClick={cancel}
        className="w-6 h-6 flex items-center justify-center rounded-md bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
        title="Cancel"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
