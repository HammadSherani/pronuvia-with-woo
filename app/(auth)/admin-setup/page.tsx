import { redirect } from "next/navigation";
import Image from "next/image";
import { AdminRegisterForm } from "./_components/admin-register-form";

export const metadata = {
  title: "Admin Setup – Pronuvia",
};

type Props = {
  searchParams: Promise<{ token?: string }>;
};

export default async function AdminSetupPage({ searchParams }: Props) {
  const { token } = await searchParams;

  // Guard: token must be present (middleware also checks, but belt-and-suspenders)
  if (!token || token !== process.env.ADMIN_SETUP_TOKEN) {
    redirect("/unauthorized");
  }

  return (
    <div className="w-full max-w-[900px] rounded-xl overflow-hidden border-2 border-[#5BB8D4] shadow-2xl flex min-h-[560px]">
      {/* ── Left panel ── */}
      <div className="relative hidden md:flex md:w-1/2 flex-col bg-gradient-to-br from-[#d4f0eb] to-[#a8ddd5]">
        {/* Page label */}
        <span className="absolute top-5 left-6 text-xs font-bold tracking-[0.18em] text-[#5BB8D4] uppercase">
          Admin Setup
        </span>

        {/* Product image */}
        <div className="flex flex-1 items-center justify-center p-8">
          <Image
            src="/product-bottle.png"
            alt="Pronuvia Maragen Dietary Supplement"
            width={280}
            height={380}
            className="object-contain drop-shadow-xl"
            priority
          />
        </div>

        {/* Bottom notice */}
        <div className="px-6 pb-6">
          <p className="text-xs text-[#3DBFA4] bg-white/40 backdrop-blur-sm rounded-lg px-4 py-3 text-center leading-relaxed">
            This is a one-time setup page.
            <br />
            Only one admin account can be created.
          </p>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="flex-1 bg-[#f7f8f9] flex items-center justify-center px-10 py-12">
        <div className="w-full max-w-[340px]">
          <AdminRegisterForm setupToken={token} />
        </div>
      </div>
    </div>
  );
}
