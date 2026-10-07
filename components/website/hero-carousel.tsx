"use client";

import { useState, useEffect, useCallback } from "react";

type Banner = {
  id:       string;
  imageUrl: string;
};

interface Props {
  banners: Banner[];
}

export function HeroCarousel({ banners }: Props) {
  const [current, setCurrent] = useState(0);
  const [animating, setAnimating] = useState(false);

  const goTo = useCallback((idx: number) => {
    if (animating || idx === current) return;
    setAnimating(true);
    setTimeout(() => {
      setCurrent(idx);
      setAnimating(false);
    }, 300);
  }, [animating, current]);

  useEffect(() => {
    if (banners.length <= 1) return;
    const id = setInterval(() => {
      setCurrent((p) => (p + 1) % banners.length);
    }, 5000);
    return () => clearInterval(id);
  }, [banners.length]);

  if (banners.length === 0) {
    return <div className="h-screen bg-gradient-to-br from-[#1a3a3a] to-[#0d2020]" />;
  }

  return (
    <div className="relative h-screen min-h-[560px] overflow-hidden select-none">

      {/* Slides */}
      {banners.map((b, i) => (
        <div key={b.id}
          className={`absolute inset-0 transition-opacity duration-700 ${i === current ? "opacity-100" : "opacity-0"}`}>
          <img src={b.imageUrl} alt="" className="w-full h-full object-cover object-center" />
        </div>
      ))}

      {/* Pagination dots */}
      {banners.length > 1 && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2.5">
          {banners.map((_, i) => (
            <button key={i} type="button" onClick={() => goTo(i)} aria-label={`Slide ${i + 1}`}
              className={`rounded-full transition-all duration-300 ${
                i === current ? "w-7 h-2.5 bg-[#1b3b6f]" : "w-2.5 h-2.5 bg-white/50 hover:bg-white/80"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
