export function ProblemSection() {
  return (
    <section id="the-problem" className="mx-auto max-w-7xl px-6 py-20 lg:px-10 lg:py-28">

      {/* Header */}
      <div className="max-w-3xl">
        <p className="eyebrow">The calcium problem</p>
        <h2
          className="mt-4 text-[clamp(2rem,4.5vw,3.4rem)] leading-[1.02] text-ink"
          style={{ fontFamily: "var(--font-display), Georgia, serif", fontWeight: 400, letterSpacing: "-0.02em" }}
        >
          Not all calcium
          <br />
          <em className="font-normal italic text-ion" style={{ fontFamily: "var(--font-display), Georgia, serif" }}>
            works the same way.
          </em>
        </h2>
        <p className="mt-5 text-[17px] leading-relaxed text-foreground/70">
          Calcium is only active in its free ionic state (Ca²⁺). Yet nearly all dietary and
          supplemental calcium ends up protein-bound — a slow-release "standby" form the body
          converts only gradually.
        </p>
      </div>

      {/* Cards */}
      <div className="mt-12 grid grid-cols-1 gap-5 lg:grid-cols-2">

        {/* Card 1 — Conventional */}
        <article className="relative overflow-hidden rounded-3xl border border-border bg-card p-8 lg:p-10">
          <div className="flex items-center justify-between">
            <span className="eyebrow">Conventional calcium</span>
            <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
              Locked in standby
            </span>
          </div>
          <h3
            className="mt-8 text-3xl leading-tight text-ink"
            style={{ fontFamily: "var(--font-display), Georgia, serif", fontWeight: 400 }}
          >
            Slow to arrive.<br />Slow to convert.
          </h3>
          <p className="mt-4 text-[15px] leading-relaxed text-foreground/65">
            Tablets and food-based calcium arrive protein-bound. Only a small fraction is
            absorbed, and the body must slowly convert it — a process that depends on
            stomach acid, Vitamin D, and healthy digestion that many people lack.
          </p>
          {/* Bar chart visual */}
          <div className="mt-8 flex items-end gap-1.5">
            {[3, 5, 4, 6, 4, 7, 5, 6, 4, 5].map((h, i) => (
              <span key={i} className="w-3 rounded-t bg-muted-foreground/25"
                style={{ height: `${h * 7}px` }} />
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Rises slowly · Fades quickly</p>
        </article>

        {/* Card 2 — AIC */}
        <article className="relative overflow-hidden rounded-3xl border border-ion/20 bg-gradient-to-br from-ion/5 via-card to-card p-8 lg:p-10">
          <div className="flex items-center justify-between">
            <span className="eyebrow" style={{ color: "var(--color-ion)" }}>Pronuvia AIC</span>
            <span className="rounded-full bg-ion/15 px-3 py-1 text-xs font-medium text-ion">
              Ready to act
            </span>
          </div>
          <h3
            className="mt-8 text-3xl leading-tight text-ink"
            style={{ fontFamily: "var(--font-display), Georgia, serif", fontWeight: 400 }}
          >
            Active on arrival.<br />Sustained for hours.
          </h3>
          <p className="mt-4 text-[15px] leading-relaxed text-foreground/65">
            Antiorbital Ionic Calcium is delivered already in the ionic Ca²⁺ form and stays
            elevated for hours — so the calcium signal your cells rely on is present and
            sustained, not fleeting.
          </p>
          {/* Bar chart visual */}
          <div className="mt-8 flex items-end gap-1.5">
            {[4, 8, 10, 11, 11, 10, 11, 10, 11, 10].map((h, i) => (
              <span key={i} className="w-3 rounded-t bg-ion"
                style={{ height: `${h * 7}px`, opacity: 0.3 + i * 0.07 }} />
            ))}
          </div>
          <p className="mt-2 text-xs text-ion/70">Rises quickly · Stays elevated</p>
        </article>

      </div>
    </section>
  );
}
