"use client";

import { useState } from "react";

export function EmailLogDetail({
  errorMessage,
  responsePayload,
}: {
  errorMessage:    string | null;
  responsePayload: Record<string, unknown> | null;
}) {
  const [open, setOpen] = useState(false);

  if (!errorMessage && !responsePayload) {
    return <span className="text-xs text-gray-300">—</span>;
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs font-medium text-[#3DBFA4] hover:underline cursor-pointer"
      >
        {open ? "Hide" : "View"}
      </button>
      {open && (
        <div className="mt-2 max-w-xs">
          {errorMessage && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded px-2 py-1.5 mb-1.5 whitespace-pre-wrap break-words">
              {errorMessage}
            </p>
          )}
          {responsePayload && (
            <pre className="text-[10px] text-gray-500 bg-gray-50 border border-gray-100 rounded px-2 py-1.5 overflow-x-auto whitespace-pre-wrap break-words">
              {JSON.stringify(responsePayload, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
