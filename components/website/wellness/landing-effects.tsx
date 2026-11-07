"use client";

import { useEffect, useState } from "react";

/**
 * The landing page's moving parts: sections fade in as they scroll into view,
 * the top menu highlights the section on screen, and in-page links scroll
 * smoothly. Runs once on the page root (`.wl`).
 */
export function LandingEffects() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".wl");
    if (!root) return;
    root.dataset.js = "1";
    const html = document.documentElement;
    const prevScroll = html.style.scrollBehavior;
    html.style.scrollBehavior = "smooth";

    const reveal = new IntersectionObserver(
      (es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); reveal.unobserve(e.target); } }),
      { threshold: 0.12 },
    );
    root.querySelectorAll(".reveal").forEach((el) => reveal.observe(el));

    const links = [...root.querySelectorAll<HTMLAnchorElement>(".nav ul a")];
    const spy = new IntersectionObserver(
      (es) => es.forEach((e) => {
        if (e.isIntersecting) links.forEach((l) => l.classList.toggle("active", l.getAttribute("href") === `#${e.target.id}`));
      }),
      { rootMargin: "-40% 0px -55% 0px" },
    );
    links.forEach((a) => { const s = root.querySelector(a.getAttribute("href") ?? ""); if (s) spy.observe(s); });

    return () => { reveal.disconnect(); spy.disconnect(); html.style.scrollBehavior = prevScroll; };
  }, []);
  return null;
}

// The visible box of each partner logo in /assets/test-img/NN.png:
// [natural width, natural height, x0, y0, x1, y1], so every logo gets the same visual weight
const LOGOS = [
  [1449, 736, 0, 0, 1448, 734], [1698, 608, 0, 4, 1696, 606], [2030, 512, 6, 4, 2028, 508],
  [2032, 512, 74, 48, 1968, 466], [1200, 894, 6, 2, 1198, 892], [1488, 720, 0, 6, 1482, 718],
  [1328, 784, 284, 16, 1042, 770], [1024, 1024, 34, 208, 990, 816], [1306, 816, 50, 200, 1254, 618],
  [1385, 768, 26, 304, 1360, 464],
];
const BLEND = new Set([5, 7]);   // logos on a white background: blended into the band

/** The partner logos, scrolling endlessly (the list twice for a seamless loop). */
export function LogoMarquee() {
  const [area, setArea] = useState(9500);   // visible area per logo, px²
  useEffect(() => {
    const fit = () => setArea(window.innerWidth < 560 ? 5000 : 9500);
    fit();
    let t: ReturnType<typeof setTimeout>;
    const onResize = () => { clearTimeout(t); t = setTimeout(fit, 200); };
    window.addEventListener("resize", onResize);
    return () => { window.removeEventListener("resize", onResize); clearTimeout(t); };
  }, []);

  const items = LOGOS.map((b, i) => {
    const bw = b[4] - b[2], bh = b[5] - b[3], r = bw / bh;
    const w = Math.sqrt(area * r), h = Math.sqrt(area / r), s = w / bw;
    return { i, w, h, img: { width: b[0] * s, left: -b[2] * s, top: -b[3] * s } };
  });

  return (
    <div className="marquee">
      <div className="track">
        {[...items, ...items].map((l, k) => (
          <div key={k} className={`lg${BLEND.has(l.i) ? " blend" : ""}`} style={{ width: Math.round(l.w), height: Math.round(l.h) }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt="" src={`/assets/test-img/${String(l.i + 1).padStart(2, "0")}.png`}
              style={{ width: l.img.width, left: l.img.left, top: l.img.top }} />
          </div>
        ))}
      </div>
    </div>
  );
}
