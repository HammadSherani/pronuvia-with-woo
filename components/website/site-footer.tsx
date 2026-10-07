"use client";

import Link from "next/link";
import Image from "next/image";
import logo from "@/public/assets/logo.png";

const NAV = [
  { label: "How It Works",      href: "#how-it-works" },
  { label: "The Science",       href: "#the-science" },
  { label: "Research",          href: "#research" },
  { label: "For Practitioners", href: "#for-practitioners" },
];


function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
}

export function SiteFooter() {
  return (
    <footer className="bg-ink text-white/75">
      <div className="mx-auto max-w-7xl px-6 py-16 lg:px-10">

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">

          {/* Brand */}
          <div className="lg:col-span-5">
            <div className="flex items-center">
              <Image src={logo} alt="Pronuvia" width={140} height={44} className="w-auto h-8 brightness-0 invert" />
            </div>
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-white/55">
              A liquid ionic-calcium delivery system. Antiorbital Ionic Calcium (AIC) —
              available through healthcare practitioners.
            </p>
          </div>

          {/* Explore + Company */}
          <div className="lg:col-span-4 grid grid-cols-2 gap-8 text-sm">
            <div>
              <p className="text-white/40 uppercase tracking-widest text-[11px] font-medium">Explore</p>
              <ul className="mt-4 space-y-3">
                {NAV.map(n => (
                  <li key={n.label}>
                    <a href={n.href}
                      onClick={e => { e.preventDefault(); scrollTo(n.href.replace("#", "")); }}
                      className="hover:text-white transition-colors">
                      {n.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-white/40 uppercase tracking-widest text-[11px] font-medium">Company</p>
              <ul className="mt-4 space-y-3">
                <li><Link href="/contact" className="hover:text-white transition-colors">Contact</Link></li>
                {/* <li><a href="#" className="hover:text-white transition-colors">Privacy</a></li> */}
                <li><Link href="/terms" className="hover:text-white transition-colors">Terms</Link></li>
              </ul>
            </div>
          </div>

          {/* Practitioners */}
          <div className="lg:col-span-3">
            <p className="text-white/40 uppercase tracking-widest text-[11px] font-medium">Practitioners</p>
            <div className="mt-4 flex flex-col gap-3">
              <Link href="/account"
                className="w-fit inline-flex items-center rounded-full border border-white/20 px-5 py-2.5 text-sm text-white hover:bg-white/10 transition-colors">
                Sign up
              </Link>
              <Link href="/login"
                className="w-fit inline-flex items-center rounded-full border border-white/20 px-5 py-2.5 text-sm text-white hover:bg-white/10 transition-colors">
                Partner Login
              </Link>
            </div>
          </div>
        </div>

        {/* FDA disclaimer */}
        <div className="mt-14 rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-xs leading-relaxed text-white/50">
          <p className="font-mono uppercase tracking-widest text-white mb-3 text-[0.65rem]">* Disclaimer</p>
          <p>
            These statements have not been evaluated by the Food and Drug Administration.
            This product is not intended to diagnose, treat, cure, or prevent any disease.
            Pronuvia products are dietary supplements and are not a substitute for professional
            medical advice, diagnosis, or treatment. Always consult a qualified healthcare
            practitioner before beginning any supplement. Individual experiences vary.
          </p>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-white/10 pt-6 text-xs text-white/40 sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} Pronuvia. All rights reserved.</p>
          <p className="font-mono tracking-widest uppercase">AIC · Ca²⁺</p>
        </div>

      </div>
    </footer>
  );
}
