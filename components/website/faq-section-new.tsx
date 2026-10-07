"use client";

import { useState } from "react";

const FAQS = [
  { q: `What is "ionic" calcium, and why does it matter?`,
    a: `Calcium is only physiologically active in its free ionic state (Ca²⁺). Most dietary and supplemental calcium arrives protein-bound and must be slowly converted. AIC delivers calcium already in the ionic form, so it's ready for the body to use.` },
  { q: "Does more calcium mean more benefit?",
    a: "Not necessarily. What matters is the form and how long ionic calcium stays available. AIC is designed for sustained ionic calcium rather than a large dose in a slow-release form." },
  { q: "How is AIC taken?",
    a: "AIC is a liquid that is simply mixed into water and consumed. It's designed to be a convenient, non-invasive part of a daily routine, used under the guidance of your practitioner." },
  { q: "Where does the benefit come from?",
    a: "Pronuvia's role is to deliver and sustain ionic calcium. The responses that follow come from your body's own natural processes as it works to maintain healthy calcium homeostasis." },
  { q: "How do I get AIC?",
    a: `AIC is offered exclusively through partnering practitioners. Contact us to connect with a provider in our network.` },
];

export function FaqSectionNew() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section className="border-t border-border">
      <div className="mx-auto max-w-7xl px-6 py-20 lg:px-10 lg:py-28">
        <div className="grid grid-cols-1 gap-14 lg:grid-cols-12">

          {/* Left: header */}
          <div className="lg:col-span-4">
            <p className="eyebrow">FAQ</p>
            <h2
              className="mt-4 text-[clamp(2rem,4.5vw,3.4rem)] leading-[1.02] text-ink"
              style={{ fontFamily: "var(--font-display), Georgia, serif", fontWeight: 400, letterSpacing: "-0.02em" }}
            >
              Questions,
              <br />
              <em className="font-normal italic text-ion" style={{ fontFamily: "var(--font-display), Georgia, serif" }}>
                answered.
              </em>
            </h2>
          </div>

          {/* Right: accordion */}
          <div className="lg:col-span-8">
            <ul className="divide-y divide-border border-y border-border">
              {FAQS.map((it, i) => {
                const isOpen = open === i;
                return (
                  <li key={it.q}>
                    <button
                      type="button"
                      onClick={() => setOpen(isOpen ? null : i)}
                      className="flex w-full items-start justify-between gap-6 py-6 text-left"
                    >
                      <span className="flex items-start gap-5">
                        <span className="font-mono text-xs text-ion pt-1.5">0{i + 1}</span>
                        <span
                          className="text-lg text-ink lg:text-xl"
                          style={{ fontFamily: "var(--font-display), Georgia, serif", fontWeight: 400 }}
                        >
                          {it.q}
                        </span>
                      </span>
                      <span
                        className={`mt-1.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border transition-all duration-200 ${
                          isOpen ? "rotate-45 bg-ink text-white border-ink" : "bg-white text-ink"
                        }`}
                      >
                        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M8 3v10M3 8h10" strokeLinecap="round" />
                        </svg>
                      </span>
                    </button>

                    <div
                      className={`grid overflow-hidden pl-10 transition-[grid-template-rows] duration-300 ${
                        isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                      }`}
                    >
                      <div className="min-h-0">
                        <p className="max-w-2xl pb-7 text-[15px] leading-relaxed text-foreground/65">
                          {it.a}
                        </p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

        </div>
      </div>
    </section>
  );
}
