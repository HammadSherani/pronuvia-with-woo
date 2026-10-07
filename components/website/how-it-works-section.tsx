export function HowItWorksSection() {
  const steps = [
    { n: "01", t: "Delivers ionic calcium",   d: "Antiorbital bonding releases calcium in its active Ca²⁺ form the moment it's absorbed — no conversion required." },
    { n: "02", t: "Sustains elevated levels", d: "Rather than a brief spike, AIC is designed to keep serum ionic calcium elevated over many hours." },
    { n: "03", t: "Restores homeostasis",     d: "Sustained ionic calcium supports the body's effort to maintain healthy calcium homeostasis — its natural balance." },
    { n: "04", t: "Cells respond",            d: "Balanced ionic calcium supports normal cell signaling and mitochondrial function — the body's own responses do the rest." },
  ];

  return (
    <section id="how-it-works" className="border-y border-border bg-cream">
      <div className="mx-auto max-w-7xl px-6 py-20 lg:px-10 lg:py-28">

        {/* Header */}
        <div className="max-w-3xl">
          <p className="eyebrow">How AIC works</p>
          <h2
            className="mt-4 text-[clamp(2rem,4.5vw,3.4rem)] leading-[1.02] text-ink"
            style={{ fontFamily: "var(--font-display), Georgia, serif", fontWeight: 400, letterSpacing: "-0.02em" }}
          >
            A delivery system,
            <br />
            <em className="font-normal italic text-ion" style={{ fontFamily: "var(--font-display), Georgia, serif" }}>
              not just another calcium.
            </em>
          </h2>
          <p className="mt-5 text-[17px] leading-relaxed text-foreground/70">
            Pronuvia's approach is built around one idea: give the body sustained access to
            ionic calcium, then let the body do what it naturally does with it.
          </p>
        </div>

        {/* Steps grid */}
        <ol className="mt-14 grid grid-cols-1 gap-px overflow-hidden rounded-3xl border border-border bg-border md:grid-cols-2 lg:grid-cols-4">
          {steps.map(s => (
            <li key={s.n} className="flex flex-col bg-white p-8 lg:p-9">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-ion">Step {s.n}</span>
                <span className="h-px flex-1 bg-border" />
              </div>
              <h3
                className="mt-7 text-[1.35rem] leading-snug text-ink"
                style={{ fontFamily: "var(--font-display), Georgia, serif", fontWeight: 400 }}
              >
                {s.t}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-foreground/65">{s.d}</p>
            </li>
          ))}
        </ol>

        {/* Quote */}
        <div className="mt-12 pl-5 border-l-2 border-ion/40 max-w-2xl">
          <p
            className="text-[1rem] text-ink/75 leading-relaxed italic"
            style={{ fontFamily: "var(--font-display), Georgia, serif" }}
          >
            "We do not push the body toward an outcome. We restore a signal it already knows how to read."
          </p>
          <p className="mt-2 font-mono text-[10px] tracking-[0.15em] uppercase text-muted-foreground">
            The Pronuvia approach
          </p>
        </div>

      </div>
    </section>
  );
}
