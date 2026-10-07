"use client";

import Link from "next/link";
import Image from "next/image";
import logo from "@/public/assets/logo.png";
import { useState } from "react";

const NAV = [
  { label: "How It Works",      href: "#how-it-works" },
  { label: "The Science",       href: "#the-science" },
  // { label: "Research",          href: "#research" },
  { label: "For Practitioners", href: "#for-practitioners" },
];

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
}


export function SiteHeader({ dashboardHref }: { variant?: string; dashboardHref?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-10">

        {/* Logo */}
        <Link href="/" className="flex items-center">
          <Image src={logo} alt="Pronuvia" width={160} height={50} className="w-auto h-9" />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-8 md:flex">
          {NAV.map(n => (
            <a key={n.label} href={n.href}
              onClick={e => { e.preventDefault(); scrollTo(n.href.replace("#", "")); }}
              className="text-sm text-foreground/70 transition-colors hover:text-ink">
              {n.label}
            </a>
          ))}
        </nav>

        {/* CTA */}
        <div className="flex items-center gap-3">
          {dashboardHref ? (
            <Link href={dashboardHref}
              className="hidden md:inline-flex items-center rounded-full bg-ink px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-ink/80">
              Dashboard
            </Link>
          ) : (
            <Link href="/login"
              className="hidden md:inline-flex items-center rounded-full border border-ink/15 px-5 py-2 text-sm font-medium text-ink transition-colors hover:bg-ink hover:text-white">
               Login
            </Link>
          )}

          {/* Mobile hamburger */}
          <button type="button" onClick={() => setOpen(v => !v)}
            className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-full border border-border text-ink">
            <span className={`block h-px w-4 bg-current transition-all ${open ? "rotate-45 translate-y-px shadow-none" : "shadow-[0_-4px_0_currentColor,0_4px_0_currentColor]"}`} />
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-t border-border bg-white px-6 py-5">
          <div className="flex flex-col gap-4">
            {NAV.map(n => (
              <a key={n.label} href={n.href}
                onClick={e => { e.preventDefault(); setOpen(false); scrollTo(n.href.replace("#", "")); }}
                className="text-base text-foreground/80 hover:text-ink">
                {n.label}
              </a>
            ))}
            {dashboardHref ? (
              <Link href={dashboardHref} onClick={() => setOpen(false)}
                className="mt-2 w-fit inline-flex items-center rounded-full bg-ink px-5 py-2 text-sm font-medium text-white">
                Dashboard
              </Link>
            ) : (
              <Link href="/login" onClick={() => setOpen(false)}
                className="mt-2 w-fit inline-flex items-center rounded-full bg-ink px-5 py-2 text-sm font-medium text-white">
                 Login
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
