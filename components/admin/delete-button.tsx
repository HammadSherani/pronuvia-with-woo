"use client";

import { useTransition, useState } from "react";
import toast from "react-hot-toast";

interface DeleteButtonProps {
  action: () => Promise<{ success?: boolean; message?: string } | undefined>;
  label?: string;
  modalTitle?: string;
  modalDescription?: string;
}

export function DeleteButton({
  action,
  label = "Delete",
  modalTitle = "Delete this item?",
  modalDescription = "This action is permanent and cannot be undone.",
}: DeleteButtonProps) {
  const [open, setOpen]             = useState(false);
  const [pending, startTransition]  = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      const result = await action();
      setOpen(false);
      if (result?.success) {
        toast.success("Deleted successfully");
      } else {
        toast.error(result?.message ?? "Failed to delete");
      }
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs font-medium text-red-500 hover:text-red-700 transition-colors cursor-pointer"
      >
        {label}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />

          {/* Modal card */}
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 flex flex-col items-center text-center">
            {/* Warning icon */}
            <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mb-4">
              <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>

            <h2 className="text-base font-semibold text-gray-900 mb-1.5">{modalTitle}</h2>
            <p className="text-sm text-gray-500 mb-6">{modalDescription}</p>

            <div className="flex gap-3 w-full">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={pending}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {pending && (
                  <div className="w-3.5 h-3.5 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                )}
                {pending ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
