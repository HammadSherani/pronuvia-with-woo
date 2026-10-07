import sImg from "@/public/assets/science-img.png";

export function ScienceSection() {
  return (
    <section
      className="relative w-full py-20 px-6 lg:px-16 overflow-hidden"
      style={{
        backgroundImage: sImg ? `url(${sImg.src})` : "none",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/65" />

      <div className="relative z-10 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">

        {/* ── Left ── */}
        <div className="text-white">
          <h2
            className="text-4xl lg:text-5xl font-bold leading-tight mb-6"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            Secure Your Health Secure Your Future
          </h2>
          <p className="text-sm text-white/80 leading-relaxed mb-4">
            Recognizing the challenges of nutrient absorption, SACR offers a unique ionic calcium
            delivery system, optimizing absorption and utilization.
          </p>
          <p className="text-sm text-white/80 leading-relaxed mb-10">
            SACR formula changes the game by ensuring more than 95% ionic calcium absorption,
            bypassing the need for Vitamin D or peptides.
          </p>

          <p className="text-sm font-bold text-white tracking-wide mb-5">Research Source</p>

          <div className="flex items-center gap-8 flex-wrap">
            {/* UAMS */}
            <div className="text-white text-center">
              <p className="text-xl font-black tracking-widest leading-none">UAMS</p>
              <p className="text-[9px] text-white/60 uppercase tracking-wider mt-1 max-w-[80px] leading-tight">University of Arkansas Biomedical Sciences</p>
            </div>

            {/* CBHI */}
            <div className="text-white text-center">
              <p className="text-xl font-black tracking-wider leading-none">CBHI <span className="text-lg">✦</span></p>
              <p className="text-[9px] text-white/60 uppercase tracking-wider mt-1 max-w-[100px] leading-tight">Calcium &amp; Bone Health Institute</p>
            </div>

            {/* Hope 4 Cancer */}
            <div className="text-white text-center">
              <p className="text-base font-bold leading-tight">HOPE <span className="font-black text-lg">4</span> CANCER</p>
              <p className="text-[9px] text-white/60 uppercase tracking-wider mt-1">Treatment Center</p>
            </div>
          </div>
        </div>

        {/* ── Right ── */}
        <div className="text-white">

          {/* Comparison header */}
          <div className="grid grid-cols-2 gap-6 mb-4">
            <div>
              <p className="text-sm font-semibold text-white mb-2">Other Calcium Source</p>
              <p className="text-xs text-white/70 leading-relaxed">
                Only 5-20% of other calcium supplements and foods are absorbed
              </p>
            </div>
            <div>
              <p className="text-sm font-semibold text-white mb-2">SAC® Formula</p>
              <p className="text-xs text-white/70 leading-relaxed">
                Weak bonding helps SAC dissolve quickly and absorb easily into cells
              </p>
            </div>
          </div>

          {/* Absorption diagram */}
          <div className="relative mb-6">
            {/* Arrows row */}
            <div className="grid grid-cols-2 gap-6 mb-3">
              {/* Other Calcium - fewer arrows */}
              <div className="flex items-end gap-1.5 h-14">
                {[1, 2].map((i) => (
                  <div key={i} className="flex flex-col items-center gap-0.5 opacity-60">
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 10 10">
                      <path d="M5 0l3 5H6v5H4V5H2z" />
                    </svg>
                    <div className="w-px h-10 bg-white/50" />
                  </div>
                ))}
              </div>
              {/* SAC Formula - more arrows */}
              <div className="flex items-end gap-1.5 h-14">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex flex-col items-center gap-0.5">
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 10 10">
                      <path d="M5 0l3 5H6v5H4V5H2z" />
                    </svg>
                    <div className="w-px h-10 bg-white/80" />
                  </div>
                ))}
              </div>
            </div>

            {/* Stage rows */}
            {["STOMACH", "BLOOD STREAM", "BONE CELLS"].map((stage) => (
              <div key={stage} className="border-t border-white/30 py-2.5">
                <p className="text-xs font-semibold tracking-widest text-white/80">{stage}</p>
              </div>
            ))}
          </div>

          {/* Bottom comparison */}
          <div className="border-t border-white/30 pt-6 grid grid-cols-2 gap-6">
            <div>
              <p className="text-sm font-semibold text-white mb-2">Epigenetic Innovation</p>
              <p className="text-xs text-white/70 leading-relaxed">
                Most supplements don&apos;t nourish cells deeply—but Marah Natural&apos;s SAC
                technology helps repair cells damaged by oxidative stress.
              </p>
            </div>
            <div>
              <p className="text-sm font-semibold text-white mb-2">The One-Stop Solution</p>
              <p className="text-xs text-white/70 leading-relaxed">
                SAC provides a precise health solution by directly repairing cells—without conflicts
                from multiple ingredients.*
              </p>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
