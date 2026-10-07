"use client";

import { useActionState } from "react";
import { changeSalesRepPassword } from "@/actions/sales-rep/profile";

export function SalesPasswordForm() {
  const [state, action, pending] = useActionState(changeSalesRepPassword, undefined);

  if (state?.success) {
    return (
      <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
        <svg className="w-5 h-5 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-sm font-medium text-emerald-700">Password updated successfully.</p>
      </div>
    );
  }

  const fields = [
    { name: "currentPassword" as const, label: "Current Password" },
    { name: "newPassword"     as const, label: "New Password" },
    { name: "confirmPassword" as const, label: "Confirm New Password" },
  ];

  return (
    <form action={action} className="space-y-4">
      {state?.message && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          {state.message}
        </div>
      )}
      {fields.map(({ name, label }) => (
        <div key={name}>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">{label}</label>
          <input
            type="password" name={name}
            autoComplete={name === "currentPassword" ? "current-password" : "new-password"}
            className={`w-full px-3.5 py-2.5 text-sm border rounded-xl outline-none transition-colors ${
              state?.errors?.[name]
                ? "border-red-300 bg-red-50"
                : "border-gray-200 bg-gray-50 focus:border-gray-900 focus:bg-white"
            }`}
          />
          {state?.errors?.[name] && (
            <p className="text-xs text-red-500 mt-1">{state.errors[name]![0]}</p>
          )}
        </div>
      ))}
      <button
        type="submit" disabled={pending}
        className="w-full py-2.5 bg-gray-900 hover:bg-gray-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors"
      >
        {pending ? "Updating…" : "Update Password"}
      </button>
    </form>
  );
}
