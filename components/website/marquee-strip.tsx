const LOGOS = Array.from({ length: 10 }, (_, i) =>
  `/assets/test-img/${String(i + 1).padStart(2, "0")}.png`
);

export function MarqueeStrip() {
  return (
    <section className="bg-ink py-10 overflow-hidden">
      <div className="flex w-max animate-marquee items-center gap-20">
        {[...LOGOS, ...LOGOS].map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            src={src}
            alt=""
            className="h-12 w-auto max-w-[160px] shrink-0 object-contain opacity-80"
          />
        ))}
      </div>
    </section>
  );
}
