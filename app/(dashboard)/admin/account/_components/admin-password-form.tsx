"use client";

import { useActionState } from "react";
import { changeAdminPassword } from "@/actions/admin/account";

export function AdminPasswordForm() {
  const [state, action, pending] = useActionState(changeAdminPassword, undefined);

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

  return (
    <form action={action} className="space-y-4">
      {state?.message && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          {state.message}
        </div>
      )}

      {(["currentPassword", "newPassword", "confirmPassword"] as const).map((field) => {
        const labels = {
          currentPassword: "Current Password",
          newPassword:     "New Password",
          confirmPassword: "Confirm New Password",
        };
        const errs = state?.errors?.[field];
        return (
          <div key={field}>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              {labels[field]}
            </label>
            <input
              type="password"
              name={field}
              autoComplete={field === "currentPassword" ? "current-password" : "new-password"}
              className={`w-full px-3.5 py-2.5 text-sm border rounded-xl outline-none transition-colors ${
                errs ? "border-red-300 bg-red-50" : "border-gray-200 bg-gray-50 focus:border-gray-900 focus:bg-white"
              }`}
            />
            {errs && <p className="text-xs text-red-500 mt-1">{errs[0]}</p>}
          </div>
        );
      })}

      <button
        type="submit"
        disabled={pending}
        className="w-full py-2.5 bg-gray-900 hover:bg-gray-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors"
      >
        {pending ? "Updating…" : "Update Password"}
      </button>
    </form>
  );
}
