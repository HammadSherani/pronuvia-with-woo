"use client";

import Image from "next/image";
import img4 from "@/public/assets/inside-image.jpg";

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
}

export function HeroSection() {
  return (
    <section id="top" className="relative overflow-hidden bg-white">
      {/* Gradient blobs */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[-10%] h-[480px] w-[480px] -translate-x-1/2 rounded-full bg-ion/10 blur-3xl" />
        <div className="absolute -right-40 top-40 h-[380px] w-[380px] rounded-full bg-cream blur-3xl" />
      </div>

      <div className="mx-auto max-w-7xl px-6 pb-20 pt-14 lg:px-10 lg:pb-28 lg:pt-20">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-10 items-center">

          {/* ── Left ── */}
          <div className="lg:col-span-7">
            <p className="eyebrow flex items-center gap-3">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-ion animate-ion-pulse" />
              Antiorbital Ionic Calcium · AIC
            </p>

            <h1
              className="mt-5 leading-[0.97] text-ink text-[clamp(2.5rem,6vw,4.8rem)]"
              style={{ fontFamily: "var(--font-display), Georgia, serif", fontWeight: 400, letterSpacing: "-0.03em" }}
            >
              Calcium{" "}
              <em className="font-normal italic text-ion" style={{ fontFamily: "var(--font-display), Georgia, serif" }}>
                your cells
              </em>
              <br />
              can actually use.
            </h1>

            <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-foreground/70">
              Most calcium never reaches the form your body can put to work. Pronuvia
              delivers calcium in its active ionic form — and keeps ionic calcium elevated
              for hours, giving your cells the signal they were designed to respond to.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a href="#how-it-works"
                onClick={e => { e.preventDefault(); scrollTo("how-it-works"); }}
                className="group inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3.5 text-sm font-medium text-white transition-transform hover:-translate-y-0.5">
                See how AIC works
                <svg viewBox="0 0 20 20" className="h-4 w-4 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M4 10h12M11 5l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
              {/* <a href="#for-practitioners"
                onClick={e => { e.preventDefault(); scrollTo("for-practitioners"); }}
                className="inline-flex items-center rounded-full border border-ink/15 px-6 py-3.5 text-sm font-medium text-ink transition-colors hover:bg-ink/5">
                Find a practitioner
              </a> */}
            </div>

            <p className="mt-7 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span>A liquid ionic-calcium delivery system</span>
              <span className="text-ion/60">·</span>
              <span>Available through healthcare practitioners</span>
            </p>

            {/* Value props */}
            <div className="mt-10 grid grid-cols-3 gap-5 border-t border-border pt-8">
              {[
                { num: "01", h: "Ionic",           p: "Active Ca²⁺ form — the only physiologically active form of calcium." },
                { num: "02", h: "Hours",            p: "Sustained elevation — designed to maintain the signal, not spike and fade." },
                { num: "03", h: "No stomach acid", p: "Absorption that bypasses digestion — no dependence on Vitamin D." },
              ].map(it => (
                <div key={it.num}>
                  <span className="font-mono text-[11px] text-ion">{it.num}</span>
                  <p className="mt-2 text-[13px] font-semibold text-ink">{it.h}</p>
                  <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{it.p}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Right: Image ── */}
          <div className="relative lg:col-span-5 hidden lg:block">
            <div className="relative mx-auto aspect-[4/5] max-w-md overflow-hidden rounded-[2rem] border border-border shadow-[0_40px_80px_-30px_rgba(11,18,32,0.2)]">
              <Image
                src={img4}
                alt="Pronuvia AIC ionic calcium"
                fill
                className="object-cover"
                priority
              />
              {/* Orbit animation */}
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute left-1/2 top-1/2 h-52 w-52 -translate-x-1/2 -translate-y-1/2 animate-ion-orbit">
                  <span className="absolute -left-2 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-ion shadow-[0_0_20px_theme(colors.ion/50)]" />
                </div>
              </div>
              <span className="absolute bottom-4 left-4 rounded-full bg-white/80 px-3 py-1 text-xs font-mono tracking-wide text-ink backdrop-blur">
                Ca²⁺ · ionic
              </span>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
