"use client";

import { useRef } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import type { Swiper as SwiperInstance } from "swiper";
import { Autoplay, Pagination, Navigation } from "swiper/modules";
import "swiper/css";
import "swiper/css/pagination";
import "swiper/css/navigation";

interface Banner {
  id:       string;
  title:    string;
  imageUrl: string;
  linkUrl:  string | null;
}

/** Banner size recommended on the admin page; the shop shows any size in full. */
export const BANNER_RECOMMENDED = { width: 1600, height: 400 };

/**
 * The promotional banners above the shop. Every image is shown whole: it
 * scales to the full width at its own proportions, so text on it is never cut.
 * A very tall image is capped in height and centred, with a blurred copy of
 * itself filling the sides. With several banners the carousel follows each
 * slide's height.
 */
export function BannerCarousel({ banners }: { banners: Banner[] }) {
  const swiperRef = useRef<SwiperInstance | null>(null);
  if (!banners.length) return null;

  // A slide's height is known once its image has loaded
  const refit = () => swiperRef.current?.updateAutoHeight(0);
  const many = banners.length > 1;

  return (
    <div className="mb-8 rounded-xl overflow-hidden shadow-sm border border-gray-100 bg-gray-100 banner-carousel">
      <style>{`
        .banner-carousel .swiper-button-next,
        .banner-carousel .swiper-button-prev {
          color: white;
          background: rgba(0,0,0,0.35);
          border-radius: 50%;
          width: 36px;
          height: 36px;
        }
        .banner-carousel .swiper-button-next::after,
        .banner-carousel .swiper-button-prev::after {
          font-size: 13px;
          font-weight: 700;
        }
        .banner-carousel .swiper-pagination-bullet-active {
          background: #3DBFA4;
        }
        .banner-carousel .swiper-pagination-bullet {
          background: white;
          opacity: 0.7;
        }
        @media (max-width: 639px) {
          .banner-carousel .swiper-button-next,
          .banner-carousel .swiper-button-prev { display: none; }
        }
      `}</style>
      <Swiper
        modules={[Autoplay, Pagination, Navigation]}
        onSwiper={(s) => { swiperRef.current = s; }}
        spaceBetween={0}
        slidesPerView={1}
        autoHeight
        autoplay={many ? { delay: 5000, disableOnInteraction: false, pauseOnMouseEnter: true } : false}
        pagination={many ? { clickable: true } : false}
        navigation={many}
        loop={many}
      >
        {banners.map((banner, i) => {
          const slide = <BannerImage banner={banner} first={i === 0} onLoad={refit} />;
          return (
            <SwiperSlide key={banner.id}>
              {banner.linkUrl ? (
                <a href={banner.linkUrl} target="_blank" rel="noopener noreferrer" className="block" aria-label={banner.title}>
                  {slide}
                </a>
              ) : slide}
            </SwiperSlide>
          );
        })}
      </Swiper>
    </div>
  );
}

function BannerImage({ banner, first, onLoad }: { banner: Banner; first: boolean; onLoad: () => void }) {
  return (
    <div className="relative overflow-hidden bg-gray-100">
      {/* Fills the sides when a tall image is capped in height */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={banner.imageUrl}
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-2xl"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={banner.imageUrl}
        alt={banner.title}
        fetchPriority={first ? "high" : "auto"}
        decoding="async"
        onLoad={onLoad}
        className="relative block h-auto max-h-[420px] w-full object-contain"
      />
    </div>
  );
}
