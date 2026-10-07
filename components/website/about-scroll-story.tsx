"use client";

import { useEffect, useRef, useState } from "react";
import Image, { StaticImageData } from "next/image";

import img1 from "@/public/assets/banner-1.jpg";
import img2 from "@/public/assets/t-two.jpg";
import img3 from "@/public/assets/science-img.png";
import img4 from "@/public/assets/inside-image.jpg";

const SECTIONS = [
  {
    image: img1,
    label: "OUR STORY",
    title: "Watch Marah Natural Story",
    text: "It is a point where the sun kisses the ocean, connects the land, and helps create breakthrough discoveries. It is here, in the place of healing powers of the ocean that you find the purest water you need — where you can purchase the most powerful formula. It is the best study. The founders of MARAH NATURAL studied for over 30 years before launching the breakthrough formula to help you. Together — Marah — Nature.",
  },
  {
    image: img2,
    label: "THE DISCOVERY",
    title: "A Breakthrough Discovery",
    text: "Marah Natural's ionic calcium liquid supplement SAC® emerged from over 30 years of dedicated research. Our scientists discovered a unique way to deliver bio-available calcium directly to your cells — bypassing traditional absorption barriers and achieving more than 95% ionic absorption, a rate unmatched by any other supplement on the market.",
  },
  {
    image: img3,
    label: "INGREDIENTS",
    title: "Naturally Sourced",
    text: "Marah Natural sources only the finest oyster shells from South Korea's fresh and pristine glacial coastal waters. Our proprietary process converts the calcium into ionic form, allowing it to dissolve instantly and absorb seamlessly into your bloodstream — nourishing bones, joints, and cells at the deepest level.",
  },
  {
    image: img4,
    label: "OUR MISSION",
    title: "A Revitalized Future",
    text: "Backed by leading research institutions including UAMS, CBHI, and Hope 4 Cancer Treatment Center, Marah Natural is committed to transforming global health. Our SAC® formula helps repair cells damaged by oxidative stress, improve mobility, and restore vitality — giving people the energy and confidence to live life to the fullest.",
  },
];

export function AboutScrollStory() {
  const [active, setActive] = useState(0);
  const [fading, setFading] = useState(false);
  const blockRefs = useRef<(HTMLDivElement | null)[]>([]);
  const prevActive = useRef(0);

  useEffect(() => {
    const observers: IntersectionObserver[] = [];

    blockRefs.current.forEach((el, i) => {
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            if (prevActive.current !== i) {
              setFading(true);
              setTimeout(() => {
                setActive(i);
                prevActive.current = i;
                setFading(false);
              }, 300);
            }
          }
        },
        { threshold: 0.5 }
      );
      obs.observe(el);
      observers.push(obs);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, []);

  return (
    <section className="relative">
      {/* ── Desktop: sticky-scroll layout ── */}
      <div className="hidden lg:flex">

        {/* Left — sticky image panel */}
        <div className="w-1/2 sticky top-0 h-screen shrink-0 overflow-hidden">
          {SECTIONS.map((s, i) => (
            <div
              key={i}
              className="absolute inset-0 transition-opacity duration-500"
              style={{ opacity: active === i && !fading ? 1 : 0 }}
            >
              <Image
                src={s.image as StaticImageData}
                alt={s.title}
                fill
                className="object-cover object-center"
                priority={i === 0}
              />
              <div className="absolute inset-0 bg-black/30" />
            </div>
          ))}
        </div>

        {/* Right — scrollable content */}
        <div className="w-1/2">
          {SECTIONS.map((s, i) => (
            <div
              key={i}
              ref={(el) => { blockRefs.current[i] = el; }}
              className="min-h-screen flex flex-col justify-center px-14 py-20 border-b border-gray-100 last:border-0"
            >
              <p className="text-xs font-semibold tracking-[0.3em] text-[#1b3b6f] uppercase mb-4">
                {s.label}
              </p>
              <h2
                className="text-4xl lg:text-5xl font-normal text-gray-900 leading-tight mb-7"
                style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
              >
                {s.title}
              </h2>
              <p className="text-base text-gray-500 leading-relaxed max-w-lg">
                {s.text}
              </p>

              {/* Progress indicator */}
              <div className="flex gap-2 mt-12">
                {SECTIONS.map((_, j) => (
                  <div
                    key={j}
                    className={`h-0.5 rounded-full transition-all duration-500 ${
                      j === i ? "w-10 bg-[#1b3b6f]" : "w-4 bg-gray-300"
                    }`}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Mobile: stacked full-screen sections ── */}
      <div className="lg:hidden">
        {SECTIONS.map((s, i) => (
          <div
            key={i}
            className="relative min-h-screen flex flex-col justify-end"
          >
            <Image
              src={s.image as StaticImageData}
              alt={s.title}
              fill
              className="object-cover object-center"
              priority={i === 0}
            />
            <div className="absolute inset-0 bg-black/50" />
            <div className="relative z-10 px-7 py-12">
              <p className="text-xs font-semibold tracking-[0.3em] text-[#1b3b6f] uppercase mb-3">
                {s.label}
              </p>
              <h2
                className="text-3xl font-normal text-white leading-tight mb-5"
                style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
              >
                {s.title}
              </h2>
              <p className="text-sm text-white/80 leading-relaxed">
                {s.text}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
