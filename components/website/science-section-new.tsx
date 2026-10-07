export function TheScienceSection() {
  const cons = [
    "Arrive protein-bound, in a slow-release standby form",
    "Only a fraction is absorbed and converted",
    "Depend on stomach acid, Vitamin D and peptides",
    "Levels rise and fall quickly",
    "Excess may contribute to unwanted build-up",
  ];
  const pros = [
    "Delivered already in the active ionic Ca²⁺ form",
    "Absorbs directly, bypassing the need for digestion",
    "No reliance on stomach acid or Vitamin D",
    "Ionic calcium stays elevated for hours",
    "Supports the body's natural calcium balance",
  ];

  return (
    <section id="the-science" className="mx-auto max-w-7xl px-6 py-20 lg:px-10 lg:py-28">
      <div className="grid grid-cols-1 gap-14 lg:grid-cols-12 lg:gap-16">

        {/* Left: header */}
        <div className="lg:col-span-5">
          <p className="eyebrow">Why ionic matters</p>
          <h2
            className="mt-4 text-[clamp(2rem,4.5vw,3.4rem)] leading-[1.02] text-ink"
            style={{ fontFamily: "var(--font-display), Georgia, serif", fontWeight: 400, letterSpacing: "-0.02em" }}
          >
            Absorption isn&apos;t the whole story —{" "}
            <em className="font-normal italic text-ion" style={{ fontFamily: "var(--font-display), Georgia, serif" }}>
              form is.
            </em>
          </h2>
          <p className="mt-5 text-[17px] leading-relaxed text-foreground/70">
            What sets AIC apart isn't simply how much calcium is absorbed, but that it
            arrives active and stays active long enough to matter.
          </p>
        </div>

        {/* Right: comparison panels */}
        <div className="lg:col-span-7">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

            {/* Other calcium */}
            <div className="rounded-3xl border border-border bg-card p-7">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <span className="eyebrow">Other calcium sources</span>
                <span className="h-2 w-2 rounded-full bg-muted-foreground/35" />
              </div>
              <ul className="mt-5 space-y-4">
                {cons.map(x => (
                  <li key={x} className="flex gap-3 text-sm text-foreground/70">
                    <span className="mt-2 h-px w-4 shrink-0 bg-muted-foreground/35" />
                    <span>{x}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* AIC */}
            <div className="rounded-3xl border border-ink bg-ink p-7 text-white">
              <div className="flex items-center justify-between border-b border-white/15 pb-4">
                <span className="eyebrow" style={{ color: "#93C5FD" }}>Pronuvia AIC</span>
                <span className="h-2 w-2 rounded-full bg-blue-300 animate-ion-pulse" />
              </div>
              <ul className="mt-5 space-y-4">
                {pros.map(x => (
                  <li key={x} className="flex gap-3 text-sm text-white/80">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-300" />
                    <span>{x}</span>
                  </li>
                ))}
              </ul>
            </div>

          </div>
        </div>
      </div>
    </section>
  );
}
