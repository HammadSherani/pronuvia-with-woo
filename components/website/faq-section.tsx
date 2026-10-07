"use client";

import { useState } from "react";
import { FAQS } from "@/constants/faqs";
import Image from "next/image";
import faqImage from "@/public/assets/faq-img.jpg";

export function FaqSection() {
  const [openId, setOpenId] = useState<number | null>(null);

  const toggle = (id: number) => setOpenId((prev) => (prev === id ? null : id));

  return (
    <section className="w-full bg-[#33AE9766] py-10 px-6 lg:px-10">
      <div className="max-w-6xl mx-auto">

        {/* FAQ title badge */}
        <div className="inline-block  rounded-lg px-6 py-2 mb-6">
          <h2 className="text-3xl font-bold text-gray-900 tracking-wide">FAQ</h2>
        </div>

        {/* Main content box */}
        <div className=" rounded-2xl p-6 md:p-8">
          <div className="flex flex-col lg:flex-row gap-6">

            {/* Left — accordion */}
            <div className="flex-1 flex flex-col gap-3 min-w-0">
              {FAQS.map((faq) => (
                <div key={faq.id} className="rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggle(faq.id)}
                    className="w-full flex items-center justify-between gap-3 bg-[#1b3b6f] hover:bg-[#142d54] text-white text-sm font-semibold text-left px-5 py-4 transition-colors duration-200"
                  >
                    <span className="leading-snug">{faq.question}</span>
                    <svg
                      className={`w-5 h-5 flex-shrink-0 transition-transform duration-300 ${openId === faq.id ? "rotate-180" : ""}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  <div
                    className={`overflow-hidden transition-all duration-300 ${openId === faq.id ? "max-h-60" : "max-h-0"}`}
                  >
                    <div className="bg-white/80 text-gray-700 text-sm leading-relaxed px-5 py-4">
                      {faq.answer}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Right — image */}
            <div className="w-full lg:w-[380px] xl:w-[420px] flex-shrink-0 rounded-xl overflow-hidden bg-gray-100 min-h-[360px] lg:min-h-0">
              <Image
                src={faqImage}
                alt="Pronuvia product"
                className="w-full h-full object-cover"
                width={1000}
                height={1000}
                style={{ minHeight: "360px" }}
              />
            </div>

          </div>
        </div>

      </div>
    </section>
  );
}
