"use client";

import { useActionState, useEffect, useState } from "react";
import toast from "react-hot-toast";
import type { AdminPasswordState } from "@/actions/admin/reset-password";

type BoundAction = (state: AdminPasswordState, formData: FormData) => Promise<AdminPasswordState>;

type Props = {
  setPasswordAction:   BoundAction;
  sendResetLinkAction: BoundAction;
};

const base = "w-full border rounded-lg px-3.5 py-2.5 text-sm text-gray-700 placeholder:text-gray-400 outline-none focus:ring-1 transition bg-white border-gray-200 focus:border-gray-900 focus:ring-gray-900";

export function AdminPasswordReset({ setPasswordAction, sendResetLinkAction }: Props) {
  const [tab, setTab] = useState<"set" | "link">("set");
  const [showPw,  setShowPw]  = useState(false);
  const [showCpw, setShowCpw] = useState(false);

  const [setState,  setAction,  setPending]  = useActionState(setPasswordAction,   undefined);
  const [linkState, linkAction, linkPending] = useActionState(sendResetLinkAction, undefined);

  useEffect(() => {
    if (!setState) return;
    if (setState.success) toast.success(setState.message ?? "Password updated.");
    else if (setState.message) toast.error(setState.message);
  }, [setState]);

  useEffect(() => {
    if (!linkState) return;
    if (linkState.success) toast.success(linkState.message ?? "Reset link sent.");
    else if (linkState.message) toast.error(linkState.message);
  }, [linkState]);

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-5">
      <p className="text-sm font-semibold text-gray-700 mb-4 pb-3 border-b border-gray-100">
        Password Management
      </p>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          type="button"
          onClick={() => setTab("set")}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
            tab === "set" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Set New Password
        </button>
        <button
          type="button"
          onClick={() => setTab("link")}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
            tab === "link" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Send Reset Link
        </button>
      </div>

      {tab === "set" ? (
        <form action={setAction} key="set-form">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                New Password <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <input
                  name="password"
                  type={showPw ? "text" : "password"}
                  placeholder="Min 8 chars, letter, number, symbol"
                  className={base}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showPw ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Confirm Password <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <input
                  name="confirmPassword"
                  type={showCpw ? "text" : "password"}
                  placeholder="Re-enter new password"
                  className={base}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowCpw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showCpw ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>

          {setState && !setState.success && setState.message && (
            <p className="text-xs text-red-500 mb-3">{setState.message}</p>
          )}

          <button
            type="submit"
            disabled={setPending}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-900 hover:bg-gray-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {setPending ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving…
              </>
            ) : "Update Password"}
          </button>
        </form>
      ) : (
        <form action={linkAction} key="link-form">
          <p className="text-sm text-gray-500 mb-4">
            Sends a password-reset email to the user with a secure link valid for&nbsp;1&nbsp;hour.
            The user sets their own new password through that link.
          </p>

          {linkState && !linkState.success && linkState.message && (
            <p className="text-xs text-red-500 mb-3">{linkState.message}</p>
          )}

          {linkState?.success && (
            <p className="text-xs text-emerald-600 bg-emerald-50 border border-emerald-100 rounded px-3 py-2 mb-3">
              {linkState.message}
            </p>
          )}

          <button
            type="submit"
            disabled={linkPending}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {linkPending ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Sending…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Send Reset Link
              </>
            )}
          </button>
        </form>
      )}
    </div>
  );
}
