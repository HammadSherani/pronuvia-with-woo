"use client";

import { useActionState } from "react";
import Link from "next/link";
import { forgotPassword, type ForgotPasswordState } from "@/actions/auth/forgot-password";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState<ForgotPasswordState, FormData>(forgotPassword, undefined);

  if (state?.success) {
    return (
      <div className="text-center py-4">
        <div className="w-14 h-14 rounded-full bg-gray-900/10 flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-[#3DBFA4]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-gray-800 mb-2">Check your inbox</h2>
        <p className="text-sm text-gray-500 leading-relaxed">
          If an account with that email or Login ID exists, we&apos;ve sent a password reset link to the registered email. It expires in <strong>1 hour</strong>.
        </p>
        <Link href="/login" className="mt-5 inline-block text-sm text-[#3DBFA4] hover:underline font-medium">
          ← Back to Login
        </Link>
      </div>
    );
  }

  const inp    = "w-full border border-gray-200 rounded-md bg-white px-4 py-3 text-sm text-gray-700 placeholder:text-gray-400 outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition";
  const inpErr = "w-full border border-red-300 rounded-md bg-white px-4 py-3 text-sm text-gray-700 placeholder:text-gray-400 outline-none focus:border-red-400 focus:ring-1 focus:ring-red-300 transition";

  return (
    <form action={action} className="space-y-4">
      <div>
        <input
          name="email"
          type="text"
          placeholder="Email or Login ID"
          autoComplete="username"
          autoFocus
          className={state?.errors?.email ? inpErr : inp}
        />
        {state?.errors?.email && (
          <p className="text-xs text-red-500 mt-1">{state.errors.email[0]}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full bg-gray-900 hover:bg-gray-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-md text-sm transition-colors flex items-center justify-center gap-2"
      >
        {pending && <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
        {pending ? "Sending…" : "Send Reset Link"}
      </button>

      <p className="text-center text-sm text-gray-400">
        Remember your password?{" "}
        <Link href="/login" className="text-[#3DBFA4] hover:underline font-medium">
          Log in
        </Link>
      </p>
    </form>
  );
}
