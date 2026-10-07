export function PractitionersSection() {
  return (
    <section id="for-practitioners" className="mx-auto max-w-7xl px-6 py-20 lg:px-10 lg:py-28">
      <div className="relative overflow-hidden rounded-[2.5rem] bg-ink px-8 py-16 text-white lg:px-16 lg:py-20">

        {/* Blobs */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -right-20 -top-20 h-96 w-96 rounded-full bg-ion/20 blur-3xl" />
          <div className="absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-ion/10 blur-3xl" />
        </div>

        <div className="relative grid grid-cols-1 gap-10 lg:grid-cols-12 lg:items-end">

          {/* Left */}
          <div className="lg:col-span-8">
            <p className="eyebrow text-white" 
            
            // style={{ color: "var(--color-ion)" }}
            >
              For practitioners
            </p>
            <h2
              className="mt-5 text-[clamp(2rem,4.5vw,3.6rem)] leading-[1.02] text-white"
              style={{ fontFamily: "var(--font-display), Georgia, serif", fontWeight: 400, letterSpacing: "-0.02em" }}
            >
              Offer AIC
              <br />
              <em className="font-normal italic text-ion" style={{ fontFamily: "var(--font-display), Georgia, serif" }}>
                in your practice.
              </em>
            </h2>
            <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-white/70">
             Pronuvia AIC reaches patients only through partnering practitioners. Join the network to order for your practice.
            </p>
          </div>

          {/* Right: buttons */}
          <div className="lg:col-span-4 flex flex-wrap gap-3 lg:justify-end">
            <a href="/account"
              className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-medium text-ink transition-transform hover:-translate-y-0.5">
              Become a partner
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M4 10h12M11 5l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
            {/* <a href="#"
              className="inline-flex items-center rounded-full border border-white/30 px-6 py-3.5 text-sm font-medium text-white transition-colors hover:bg-white/10">
              Find a Practitioner
            </a> */}
          </div>

        </div>

        {/* Pathway */}
        <div className="relative mt-12 border-t border-white/10 pt-10 grid grid-cols-3 gap-6 max-w-lg">
          {[
            { label: "Pronuvia", sub: "AIC formulation" },
            { label: "Practitioner", sub: "guides therapy", highlight: true },
            { label: "Patient", sub: "daily routine" },
          ].map((step, i) => (
            <div key={step.label} className="relative">
              {i > 0 && (
                <div className="absolute -left-3 top-1/2 flex -translate-y-1/2 items-center">
                  <div className="h-px w-3 bg-white/20" />
                  <div className="h-1.5 w-1.5 rounded-full bg-white/20" />
                </div>
              )}
              <div className={`rounded-xl border px-4 py-3 text-center ${step.highlight ? "border-white/50" : "border-white/20"}`}>
                <p className="text-[13px] font-semibold text-white">{step.label}</p>
                <p className="text-[11px] text-white/45 mt-0.5">{step.sub}</p>
              </div>
            </div>
          ))}
        </div>
        <p
          className="relative mt-4 text-sm italic "
          style={{ fontFamily: "var(--font-display), Georgia, serif" }}
        >
          Mixed into water. Taken daily.
        </p>

      </div>
    </section>
  );
}
