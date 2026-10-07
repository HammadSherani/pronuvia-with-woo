import insiderImage from "@/public/assets/inside-image.jpg";
import Image from "next/image";


export function InsiderSection() {
  return (
    <section className="">
      <div className="grid grid-cols-1 md:grid-cols-2 rounded-2xl overflow-hidden shadow-sm">

        {/* Left — image */}
        <div className="bg-[#e8d5b7] aspect-[4/3] md:aspect-auto">
          <Image
          width={1000}
          height={1000}
            src={insiderImage}  
            alt="Pronuvia Insider"
            className="w-full h-full object-cover"
          />
        </div>

        {/* Right — content */}
        <div className="bg-[#f5f0e8] flex flex-col items-center justify-center text-center px-10 py-14">
          <p className="text-xs font-semibold tracking-[0.25em] text-gray-400 uppercase mb-4">
            Get The Latest
          </p>
          <h2
            className="text-4xl font-normal text-gray-900 leading-snug mb-8"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            Become a<br />Pronuvia Insider
          </h2>
          <a
            href="/login"
            className="inline-flex items-center px-7 py-2.5 bg-[#1b3b6f] hover:bg-[#162f5c] text-white text-sm font-semibold rounded-full transition-colors shadow-sm"
          >
            Join Now
          </a>
        </div>

      </div>
    </section>
  );
}
