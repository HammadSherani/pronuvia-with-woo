"use client";

import { useState } from "react";
import { REVIEWS } from "@/constants/reviews";

function StarRating({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg
          key={i}
          className={`w-4 h-4 ${i < count ? "text-yellow-400" : "text-gray-300"}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

const PER_PAGE = 4;

export function ReviewsSection() {
  const [current, setCurrent] = useState(0);

  const total = REVIEWS.length;
  const maxIndex = Math.max(0, total - PER_PAGE);

  const prev = () => setCurrent((p) => Math.max(0, p - 1));
  const next = () => setCurrent((p) => Math.min(maxIndex, p + 1));

  const visible = REVIEWS.slice(current, current + PER_PAGE);

  return (
    <section className="bg-gray-100/60 py-20">
      <div className="max-w-6xl mx-auto px-6">

        {/* Header */}
        <div className="text-center mb-4">
          <h2
            className="text-5xl font-normal text-gray-900 mb-4"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            Reviews
          </h2>
          <div className="inline-block  rounded px-6 py-2">
            <p className="text-sm text-gray-500">
              Discover why thousands of customers trust our serum for healthier, glowing skin.
            </p>
          </div>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-12">
          {visible.map((review) => (
            <div
              key={review.id}
              className="border border-dashed border-gray-300 rounded-xl p-5 flex flex-col gap-3"
            >
              {/* Avatar + Name */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
                  <img
                    src={review.avatar}
                    alt={review.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.currentTarget;
                      target.style.display = "none";
                      const parent = target.parentElement;
                      if (parent) {
                        parent.innerHTML = `<span class="w-full h-full flex items-center justify-center text-gray-500 font-semibold text-sm">${review.name[0]}</span>`;
                      }
                    }}
                  />
                </div>
                <span className="text-sm font-bold text-gray-800 tracking-wide">
                  {review.name}
                </span>
              </div>

              {/* Stars */}
              <StarRating count={review.stars} />

              {/* Review text */}
              <p className="text-sm text-gray-600 leading-relaxed flex-1">
                {review.text}
              </p>

              {/* Date */}
              <p className="text-xs text-gray-400 mt-auto">{review.date}</p>
            </div>
          ))}
        </div>

        {/* Navigation */}
        {total > PER_PAGE && (
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
                    i === current
                      ? "w-6 h-2.5 bg-[#1b3b6f]"
                      : "w-2.5 h-2.5 bg-gray-300 hover:bg-gray-400"
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
        )}

      </div>
    </section>
  );
}
