import Image from "next/image";
import alpineEmpowerIcon from "@/public/assets/alpine-empower.png";
import brands from "@/public/assets/brands.png";

export function PartnersSection() {
  return (
    <section
      className="relative w-full py-24 px-6 lg:px-16 overflow-hidden"
      style={{
        backgroundImage: alpineEmpowerIcon ? `url(${alpineEmpowerIcon.src})` : "none",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* Blue teal overlay - Design ke mutabiq transparency adjust ki gayi hai */}
      <div className="absolute inset-0 bg-[#5bbfd4]/90" />

      <div className="relative z-10 max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-12">

        {/* Left — heading */}
        <div className="shrink-0 md:w-64">
          <h2
            className="text-4xl font-normal text-white leading-tight"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            Our Global<br />Research Partners
          </h2>
        </div>

        {/* Divider */}
        <div className="hidden md:block w-px h-20 bg-white/30" />

        {/* Right — logos grid */}
        {/* Yahan 'flex-1' aur 'flex items-center' use kiya taake image center mein rahe */}
        <div className="flex-1 flex items-center justify-center">
          <Image
            src={brands}
            alt="Research Partners"
            className="w-full max-w-3xl h-auto object-contain"
            width={800}
            height={400}
            priority
          />
        </div>

      </div>
    </section>
  );
}