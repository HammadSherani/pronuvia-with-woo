import Image from "next/image";
import Link from "next/link";
import { LoginForm } from "./_components/login-form";
import logo from "@/public/assets/logo-white.png"

export const metadata = {
  title: "Login – Pronuvia",
};

export default function LoginPage() {
  return (
    <div className="w-full  rounded-xl overflow-hidden  flex min-h-screen">
      {/* ── Left panel — branded (no external image needed) ── */}
      <div className="relative hidden md:flex md:w-1/2 flex-col items-center justify-center bg-ink text-white">
        {/* Decorative circles */}
        <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-white/10 -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-36 h-36 rounded-full bg-white/10 translate-y-1/2 -translate-x-1/2" />

        <div className="relative z-10 text-center ">
          {/* <div className="w-20 h-20 rounded-2xl bg-white/20 flex items-center justify-center mx-auto mb-6 backdrop-blur-sm border border-white/30"> */}
            <Image
              src={logo}
              alt={"logo"}
              width={500}
              height={500}
              className="w-60 h-auto"
            />
          {/* </div> */}

          {/* <h2 className="text-3xl font-black tracking-tight mb-2">PRONUVIA</h2> */}
          <p className="text-white/80 text-sm mt-3 leading-relaxed">
            Health &amp; Wellness Products
          </p>

          {/* <div className="mt-8 space-y-3 text-left">
            {["Manage Orders & Commissions", "Track Physician Partnerships", "Real-time Wallet & Payouts"].map((item) => (
              <div key={item} className="flex items-center gap-3 text-sm text-white/90">
                <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                {item}
              </div>
            ))}
          </div> */}
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="flex-1 bg-[#f7f8f9] flex flex-col items-center justify-center px-10 py-12">
        <div className="w-full max-w-[340px]">
          <LoginForm />
        </div>
        
        <Link
          href="/account"
          className="mt-3 inline-flex items-center gap-1.5 text-sm text-gray-400 text-ink transition-colors"
        >
          {/* <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg> */}
          Sign up
        </Link>
        <Link
          href="/"
          className="mt-4 inline-flex items-center gap-1.5 px-5 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-md hover:border-gray-400 hover:text-gray-800 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Website
        </Link>
      </div>
    </div>
  );
}
