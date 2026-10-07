"use client";
import imgOne from "@/public/assets/t-one.jpg";
import imgTwo from "@/public/assets/t-two.jpg";
import imgThree from "@/public/assets/t-three.jpg";

import { useState } from "react";
import Image from "next/image";

const TESTIMONIALS = [
  {
    id: 1,
    image: imgOne,
    quote: '"I would recommend taking Marah-Cel in addition to the cancer therapies that are out there"',
    stars: 4,
    name: "Jim",
  },
  {
    id: 2,
    image: imgTwo,
    quote: '"I can do more things around the house...I don\'t seem to hurt as much."',
    stars: 4,
    name: "Donna",
  },
  {
    id: 3,
    image: imgThree,
    quote: '"Marah Natural gave me a life, after a bad fall and three bone fractures"',
    stars: 4,
    name: "Alicia",
  },
  {
    id: 4,
    image: imgOne,
    quote: '"The difference in my mobility after 3 months was incredible. I feel like myself again."',
    stars: 5,
    name: "Robert",
  },
  {
    id: 5,
    image: imgTwo,
    quote: '"My doctor was amazed at the improvement in my bone density scan results."',
    stars: 5,
    name: "Sarah",
  },
];

function Stars({ count }: { count: number }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} className={`w-4 h-4 ${i < count ? "text-gray-800" : "text-gray-300"}`} fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

export function TestimonialsSection() {
  const [current, setCurrent] = useState(0);
  const perPage = 3;
  const total = TESTIMONIALS.length;
  const maxIndex = total - perPage;

  const prev = () => setCurrent((p) => Math.max(0, p - 1));
  const next = () => setCurrent((p) => Math.min(maxIndex, p + 1));

  const visible = TESTIMONIALS.slice(current, current + perPage);

  return (
    <section className="bg-gray-50 py-20">
      <div className="max-w-6xl mx-auto px-6">

        {/* Header */}
        <div className="text-center mb-12">
          <p className="text-xs font-semibold tracking-[0.25em] text-gray-400 uppercase mb-4">
            Hear From Our Customers
          </p>
          <h2
            className="text-5xl font-normal text-gray-900"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            Over 600,000 Lives Changed
          </h2>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {visible.map((t) => (
            <div key={t.id} className="bg-white rounded-2xl overflow-hidden shadow-sm">
              {/* Image + play button */}
              <div className="relative aspect-[4/3] bg-gray-100 group cursor-pointer">
                <Image
                width={1000}
                  height={750}
                  src={t.image}
                  alt={t.name}
                  className="w-full h-full object-cover object-top"
                />
                {/* <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-14 h-14 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center shadow-md group-hover:bg-white transition-colors">
                    <svg className="w-6 h-6 text-gray-800 ml-1" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                </div> */}
              </div>

              {/* Text */}
              <div className="p-5">
                <p className="text-sm text-gray-600 leading-relaxed mb-4 min-h-[60px]">
                  {t.quote}
                </p>
                <Stars count={t.stars} />
                <p className="text-sm font-semibold text-gray-800 mt-2">{t.name}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-center gap-4 mt-10">
          <button
            type="button"
            onClick={prev}
            disabled={current === 0}
            className="w-10 h-10 rounded-full border border-gray-300 flex items-center justify-center text-gray-500 hover:border-[#1b3b6f] hover:text-[#1b3b6f] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="flex gap-2">
            {Array.from({ length: maxIndex + 1 }).map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setCurrent(i)}
                className={`rounded-full transition-all duration-300 ${
                  i === current ? "w-6 h-2.5 bg-[#1b3b6f]" : "w-2.5 h-2.5 bg-gray-300 hover:bg-gray-400"
                }`}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={next}
            disabled={current === maxIndex}
            className="w-10 h-10 rounded-full border border-gray-300 flex items-center justify-center text-gray-500 hover:border-[#1b3b6f] hover:text-[#1b3b6f] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

      </div>
    </section>
  );
}
