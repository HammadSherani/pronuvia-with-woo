"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { login } from "@/actions/auth/login";
import { PronuviaLogo } from "@/components/pronuvia-logo";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={action} className="flex flex-col items-center w-full">
      {/* Logo */}
      {/* <div className="mb-7">
        <PronuviaLogo size={34} />
      </div> */}

      <h1 className="text-[22px] font-bold text-gray-800 mb-1">
        Login to your account
      </h1>
      <p className="text-sm text-gray-400 mb-8">
        Create your account to get started
      </p>

      {/* Error message */}
      {state?.message && (
        <div className="w-full mb-4 px-4 py-2 bg-red-50 border border-red-200 rounded text-red-600 text-sm">
          {state.message}
        </div>
      )}

      {/* Email or Login ID */}
      <div className="w-full mb-4">
        <input
          name="email"
          type="text"
          placeholder="Email or Login ID"
          autoComplete="username"
          className="w-full border border-gray-200 rounded-md bg-white px-4 py-3 text-sm text-gray-700 placeholder:text-gray-400 outline-none focus:border-[#5BB8D4] focus:ring-1 focus:ring-[#5BB8D4] transition"
        />
        {state?.errors?.email && (
          <p className="text-xs text-red-500 mt-1">{state.errors.email[0]}</p>
        )}
      </div>

      {/* Password */}
      <div className="w-full mb-4">
        <div className="relative">
          <input
            name="password"
            type={showPassword ? "text" : "password"}
            placeholder="Password"
            autoComplete="current-password"
            className="w-full border border-gray-200 rounded-md bg-white px-4 py-3 pr-11 text-sm text-gray-700 placeholder:text-gray-400 outline-none focus:border-[#5BB8D4] focus:ring-1 focus:ring-[#5BB8D4] transition"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute inset-y-0 right-0 flex items-center px-3.5 text-gray-400 hover:text-gray-600 transition-colors"
            tabIndex={-1}
          >
            {showPassword ? (
              <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
            ) : (
              <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
        </div>
        {state?.errors?.password && (
          <p className="text-xs text-red-500 mt-1">
            {state.errors.password[0]}
          </p>
        )}
      </div>

      {/* Remember me + Forgot password */}
      <div className="w-full flex items-center justify-between mb-6">
        <label className="flex items-center gap-2 text-sm text-gray-500 cursor-pointer select-none">
          <input
            type="checkbox"
            name="rememberMe"
            className="w-4 h-4 accent-[#3DBFA4] cursor-pointer"
          />
          Remember me
        </label>
        <Link
          href="/forgot-password"
          className="text-sm text-ink hover:underline"
        >
          Forget Password?
        </Link>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={pending}
        className="w-full bg-ink hover:bg-[#131d30] disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-md text-sm transition-colors cursor-pointer"
      >
        {pending ? "Logging in…" : "Login"}
      </button>

      {/* <p className="mt-6 text-sm text-gray-400">
        Not registered yet?{" "}
        <Link href="#" className="text-[#5BB8D4] hover:underline font-medium">
          Create an account
        </Link>
      </p> */}
    </form>
  );
}
