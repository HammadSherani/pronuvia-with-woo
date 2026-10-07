"use client";

import { useActionState } from "react";
import { adminRegister } from "@/actions/auth/admin-register";
import { PronuviaLogo } from "@/components/pronuvia-logo";

export function AdminRegisterForm({ setupToken }: { setupToken: string }) {
  const [state, action, pending] = useActionState(adminRegister, undefined);

  return (
    <form action={action} className="flex flex-col items-center w-full">
      {/* Hidden token passed from URL */}
      <input type="hidden" name="setupToken" value={setupToken} />

      {/* Logo */}
      <div className="mb-7">
        <PronuviaLogo size={34} />
      </div>

      <h1 className="text-[22px] font-bold text-gray-800 mb-1">
        Create Admin Account
      </h1>
      <p className="text-sm text-gray-400 mb-8">
        One-time admin registration
      </p>

      {/* Global error / success */}
      {state?.message && (
        <div className="w-full mb-4 px-4 py-2 bg-red-50 border border-red-200 rounded text-red-600 text-sm">
          {state.message}
        </div>
      )}

      {/* Email */}
      <div className="w-full mb-4">
        <input
          name="email"
          type="email"
          placeholder="Email Address"
          autoComplete="email"
          className="w-full border border-gray-200 rounded-md bg-white px-4 py-3 text-sm text-gray-700 placeholder:text-gray-400 outline-none focus:border-[#5BB8D4] focus:ring-1 focus:ring-[#5BB8D4] transition"
        />
        {state?.errors?.email && (
          <p className="text-xs text-red-500 mt-1">{state.errors.email[0]}</p>
        )}
      </div>

      {/* Password */}
      <div className="w-full mb-4">
        <input
          name="password"
          type="password"
          placeholder="Password"
          autoComplete="new-password"
          className="w-full border border-gray-200 rounded-md bg-white px-4 py-3 text-sm text-gray-700 placeholder:text-gray-400 outline-none focus:border-[#5BB8D4] focus:ring-1 focus:ring-[#5BB8D4] transition"
        />
        {state?.errors?.password && (
          <ul className="mt-1 space-y-0.5">
            {state.errors.password.map((e) => (
              <li key={e} className="text-xs text-red-500">
                {e}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Setup token hint */}
      <div className="w-full mb-6">
        <div className="w-full border border-dashed border-[#5BB8D4] rounded-md bg-[#f0faf8] px-4 py-3 text-sm text-[#3DBFA4] font-medium flex items-center gap-2">
          <svg
            className="w-4 h-4 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
            />
          </svg>
          Setup token verified from URL
        </div>
        {state?.errors?.setupToken && (
          <p className="text-xs text-red-500 mt-1">
            {state.errors.setupToken[0]}
          </p>
        )}
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={pending}
        className="w-full bg-[#3DBFA4] hover:bg-[#35ab93] disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-md text-sm transition-colors cursor-pointer"
      >
        {pending ? "Creating account…" : "Create Admin Account"}
      </button>

      <p className="mt-6 text-xs text-gray-400 text-center">
        This page is only accessible with a valid setup token.
        <br />
        Contact your system administrator if you need access.
      </p>
    </form>
  );
}
