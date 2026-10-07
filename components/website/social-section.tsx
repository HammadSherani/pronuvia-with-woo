"use client";

import { useRef, useState } from "react";
import sOneImage from "@/public/assets/s-one.jpg";
import sTwoImage from "@/public/assets/s-two.jpg";
import Image from "next/image";

const IMAGES = [
  sOneImage,
  sTwoImage,
  sOneImage,
  sTwoImage,
  sOneImage,
  sTwoImage,
];

export function SocialSection() {
  const ref       = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const startX    = useRef(0);
  const scrollLeft = useRef(0);

  const onMouseDown = (e: React.MouseEvent) => {
    setDragging(true);
    startX.current    = e.pageX - (ref.current?.offsetLeft ?? 0);
    scrollLeft.current = ref.current?.scrollLeft ?? 0;
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging || !ref.current) return;
    e.preventDefault();
    const x    = e.pageX - ref.current.offsetLeft;
    const walk = (x - startX.current) * 1.5;
    ref.current.scrollLeft = scrollLeft.current - walk;
  };

  const stopDrag = () => setDragging(false);

  return (
    <section className="py-16 bg-white">

      {/* Header */}
      <div className="text-center mb-10">
        <p className="text-xs font-semibold tracking-[0.25em] text-gray-400 uppercase mb-3">
          Find Us On Social
        </p>
        <h2
          className="text-4xl lg:text-5xl font-bold text-gray-900 tracking-widest uppercase"
          style={{ fontFamily: "'Courier New', Courier, monospace" }}
        >
          @PronovianaturalOfficial
        </h2>
      </div>

      {/* Scrollable strip */}
      <div
        ref={ref}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={stopDrag}
        onMouseLeave={stopDrag}
        className="flex gap-4 overflow-x-auto px-6 pb-2 snap-x snap-mandatory select-none"
        style={{
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          cursor: dragging ? "grabbing" : "grab",
          WebkitOverflowScrolling: "touch",
        } as React.CSSProperties}
      >
        {IMAGES.map((src, i) => (
          <div
            key={i}
            className="shrink-0 snap-start rounded-2xl overflow-hidden bg-gray-100 w-[75vw] sm:w-[40vw] lg:w-[28vw]"
          >
            <div className="aspect-[3/4]">
              <Image
              width={1000}
              height={1333}
                src={src}
                alt={`Social post ${i + 1}`}
                className="w-full h-full object-cover pointer-events-none"
                draggable={false}
              />
            </div>
          </div>
        ))}
      </div>

    </section>
  );
}
