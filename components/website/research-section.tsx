export function ResearchSection() {
  const chips = [
    "Calcium & Bone Health Institute",
    "University Research Partners",
    // "Presented at AACR 2025",
    // "Collaborative Clinical Studies",
  ];

  return (
    <section id="research" className="border-t border-border bg-cream">
      <div className="mx-auto max-w-7xl px-6 py-20 lg:px-10 lg:py-28">
        <div className="grid grid-cols-1 gap-14 lg:grid-cols-12">

          {/* Left */}
          <div className="lg:col-span-5">
            <p className="eyebrow">Research</p>
            <h2
              className="mt-4 text-[clamp(2rem,4.5vw,3.4rem)] leading-[1.02] text-ink"
              style={{ fontFamily: "var(--font-display), Georgia, serif", fontWeight: 400, letterSpacing: "-0.02em" }}
            >
              Developed and{" "}
              <em className="font-normal italic text-ion" style={{ fontFamily: "var(--font-display), Georgia, serif" }}>
                studied
              </em>{" "}
              in collaboration.
            </h2>
            <p className="mt-5 text-[17px] leading-relaxed text-foreground/70">
              Antiorbital Ionic Calcium was developed through collaborative research and
              continues to be studied with universities, research institutes, and clinicians.
              Our marketing is grounded in that science — not in promises.
            </p>
            {/* <a href="/research"
              className="mt-8 inline-flex items-center gap-2 rounded-full border border-ink/20 px-6 py-3 text-sm font-medium text-ink transition-colors hover:bg-ink/5">
              Read the Research
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M4 10h12M11 5l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a> */}
          </div>

          {/* Right: chips */}
          <div className="lg:col-span-7">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {chips.map(c => (
                <div key={c}
                  className="flex items-center gap-4 rounded-2xl border border-border bg-white px-5 py-5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ion/10 text-ion">
                    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M4 11l4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <span className="text-sm text-ink">{c}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
