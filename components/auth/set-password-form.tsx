"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import type { SetPasswordState } from "@/actions/auth/set-password";

type Props = {
  action: (state: SetPasswordState, formData: FormData) => Promise<SetPasswordState>;
};

export function SetPasswordForm({ action }: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const router = useRouter();
  const [showPass, setShowPass]       = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (!state) return;
    if (state.success) {
      toast.success(state.message ?? "Password set!");
      setTimeout(() => router.push("/login"), 1500);
    } else if (state.message && !state.errors) {
      toast.error(state.message);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const e = state?.errors ?? {};
  const base  = "w-full border rounded-lg px-3.5 py-2.5 pr-11 text-sm text-gray-700 placeholder:text-gray-400 outline-none focus:ring-1 transition bg-white";
  const ok    = "border-gray-200 focus:border-gray-900 focus:ring-gray-900";
  const err   = "border-red-300 focus:border-red-400 focus:ring-red-300";
  const icls  = (hasErr?: string) => `${base} ${hasErr ? err : ok}`;
  const lbl   = "block text-sm font-medium text-gray-700 mb-1.5";

  const eyeOff = (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  );
  const eyeOn = (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );

  return (
    <form action={formAction} noValidate className="space-y-4">
      <div>
        <label className={lbl}>New Password</label>
        <div className="relative">
          <input
            name="password"
            type={showPass ? "text" : "password"}
            className={icls(e.password?.[0])}
            placeholder="Min 8 chars, letter, number, symbol"
            autoFocus
          />
          <button type="button" onClick={() => setShowPass((p) => !p)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer">
            {showPass ? eyeOff : eyeOn}
          </button>
        </div>
        {e.password?.[0] && <p className="text-xs text-red-500 mt-1">{e.password[0]}</p>}
      </div>

      <div>
        <label className={lbl}>Confirm Password</label>
        <div className="relative">
          <input
            name="confirmPassword"
            type={showConfirm ? "text" : "password"}
            className={icls(e.confirmPassword?.[0])}
            placeholder="Repeat password"
          />
          <button type="button" onClick={() => setShowConfirm((p) => !p)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer">
            {showConfirm ? eyeOff : eyeOn}
          </button>
        </div>
        {e.confirmPassword?.[0] && <p className="text-xs text-red-500 mt-1">{e.confirmPassword[0]}</p>}
      </div>

      <p className="text-xs text-gray-400">
        Min 8 characters · at least one letter, one number, and one special character.
      </p>

      <button
        type="submit"
        disabled={pending}
        className="w-full py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors cursor-pointer flex items-center justify-center gap-2 mt-2"
      >
        {pending && <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
        {pending ? "Saving…" : "Save New Password"}
      </button>
    </form>
  );
}
