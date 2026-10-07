"use client";

import { Swiper, SwiperSlide } from "swiper/react";
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

export function BannerCarousel({ banners }: { banners: Banner[] }) {
  if (!banners.length) return null;

  return (
    <div className="mb-8 rounded-xl overflow-hidden shadow-sm border border-gray-100 banner-carousel">
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
      `}</style>
      <Swiper
        modules={[Autoplay, Pagination, Navigation]}
        spaceBetween={0}
        slidesPerView={1}
        autoplay={{ delay: 5000, disableOnInteraction: false }}
        pagination={{ clickable: true }}
        navigation={banners.length > 1}
        loop={banners.length > 1}
      >
        {banners.map((banner) =>
          banner.linkUrl ? (
            <SwiperSlide key={banner.id}>
              <a href={banner.linkUrl} target="_blank" rel="noopener noreferrer" className="block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={banner.imageUrl}
                  alt={banner.title}
                  className="w-full h-44 sm:h-60 object-cover"
                />
              </a>
            </SwiperSlide>
          ) : (
            <SwiperSlide key={banner.id}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={banner.imageUrl}
                alt={banner.title}
                className="w-full h-44 sm:h-60 object-cover"
              />
            </SwiperSlide>
          )
        )}
      </Swiper>
    </div>
  );
}
