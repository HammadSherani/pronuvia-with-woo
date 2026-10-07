import { notFound } from "next/navigation";
import { validateResetToken, setPassword } from "@/actions/auth/set-password";
import { SetPasswordForm } from "@/components/auth/set-password-form";

export const metadata = { title: "Set Password – Pronuvia" };

type Props = { params: Promise<{ token: string }> };

export default async function ResetPasswordPage({ params }: Props) {
  const { token } = await params;

  const userType = await validateResetToken(token);
  if (!userType) notFound();

  const boundAction = setPassword.bind(null, token);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#3DBFA4] mb-4">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Set Your Password</h1>
          <p className="text-sm text-gray-500 mt-1">
            Choose a secure password to activate your account
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
          <SetPasswordForm action={boundAction} />
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Pronuvia Partner Portal · This link expires in 72 hours
        </p>
      </div>
    </div>
  );
}
