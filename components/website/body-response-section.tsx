export function BodyResponseSection() {
  const pillars = [
    {
      icon: (
        <svg viewBox="0 0 40 40" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.2">
          <circle cx="20" cy="20" r="4" fill="currentColor" />
          <circle cx="20" cy="20" r="10" />
          <circle cx="20" cy="20" r="17" opacity="0.45" />
        </svg>
      ),
      t: "Cell signaling",
      d: "Ionic calcium is a primary messenger inside cells. Sustained, balanced levels help support normal calcium-driven cell signaling.*",
    },
    {
      icon: (
        <svg viewBox="0 0 40 40" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.2">
          <ellipse cx="20" cy="20" rx="14" ry="7" />
          <path d="M8 20c3-4 6-4 8 0s5 4 8 0 5-4 8 0" />
        </svg>
      ),
      t: "Mitochondrial function",
      d: "Healthy calcium balance supports normal mitochondrial function — part of how cells maintain their everyday energy and resilience.*",
    },
    {
      icon: (
        <svg viewBox="0 0 40 40" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.2">
          <path d="M6 30h28M20 8v20M12 22l8-8 8 8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      t: "Calcium homeostasis",
      d: "By supplying calcium in its active form, AIC supports the body's effort to maintain healthy calcium homeostasis.*",
    },
  ];

  return (
    <section className="relative overflow-hidden border-t border-border bg-white">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-[-10%] top-1/2 h-[480px] w-[480px] -translate-y-1/2 rounded-full bg-ion/8 blur-3xl" />
      </div>

      <div className="mx-auto max-w-7xl px-6 py-20 lg:px-10 lg:py-28">
        <div className="max-w-3xl">
          <p className="eyebrow">The body does the work</p>
          <h2
            className="mt-4 text-[clamp(2rem,4.5vw,3.4rem)] leading-[1.02] text-ink"
            style={{ fontFamily: "var(--font-display), Georgia, serif", fontWeight: 400, letterSpacing: "-0.02em" }}
          >
            We deliver the signal.{" "}
            <em className="font-normal italic text-ion" style={{ fontFamily: "var(--font-display), Georgia, serif" }}>
              Your body responds.
            </em>
          </h2>
          <p className="mt-5 text-[17px] leading-relaxed text-foreground/70">
            Pronuvia doesn&apos;t force an outcome. By restoring sustained ionic calcium, AIC
            supports the conditions your body needs — and the body&apos;s own natural responses follow.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-3">
          {pillars.map((p, i) => (
            <div key={p.t}
              className="group relative rounded-3xl border border-border bg-card p-8 transition-colors hover:border-ion/40">
              <div className="flex items-center justify-between">
                <span className="text-ion">{p.icon}</span>
                <span className="font-mono text-xs text-muted-foreground">0{i + 1}</span>
              </div>
              <h3
                className="mt-7 text-[1.3rem] text-ink"
                style={{ fontFamily: "var(--font-display), Georgia, serif", fontWeight: 400 }}
              >
                {p.t}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-foreground/65">{p.d}</p>
            </div>
          ))}
        </div>

        <p className="mt-6 text-xs text-muted-foreground">
          * These statements have not been evaluated by the Food and Drug Administration.
          This product is not intended to diagnose, treat, cure, or prevent any disease.
        </p>
      </div>
    </section>
  );
}
