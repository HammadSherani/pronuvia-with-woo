import sImgOne from "@/public/assets/c-one.jpg";
import sImgTwo from "@/public/assets/c-two.jpg";
import Image from "next/image";

export function WhyChooseSection() {
  return (
    <section className="bg-gray-50 py-20">
      <div className=" mx-auto px-6">

        {/* Heading */}
        <h2
          className="text-4xl lg:text-5xl font-normal text-gray-900 text-center mb-14"
          style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
        >
          Why Choose us ?
        </h2>

        {/* Two columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">

          {/* Left — Marah Natural */}
          <div className="flex flex-col items-center text-center">
            <div className="w-full rounded-2xl overflow-hidden bg-gray-200 mb-7">
              <div className="aspect-[4/3.5]">
                <Image
                  src={sImgOne}
                  alt="Marah Natural SAC Liquid Supplements"
                  className="w-full h-full object-cover"
                  width={1000}
                  height={1333}
                />
              </div>
            </div>
            <h3
              className="text-2xl font-normal text-gray-900 mb-4 leading-snug"
              style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
            >
              Marah Natural&apos;s SAC<br />Liquid Supplements
            </h3>
            <p className="text-sm text-gray-500 leading-relaxed max-w-sm">
              Experience revitalization with SAC® liquid ionic calcium—designed for effortless
              absorption that bypasses the stomach, delivers nutrients directly to cells, boosts
              energy and rejuvenation, and safely eliminates excess minerals without calcification
              risk.
            </p>
          </div>

          {/* Right — Traditional */}
          <div className="flex flex-col items-center text-center">
            <div className="w-full rounded-2xl overflow-hidden bg-gray-200 mb-7">
              <div className="aspect-[4/3.5]">
                <Image
                  src={sImgTwo}
                  alt="Traditional Supplements"
                  className="w-full h-full object-cover"
                  width={1000}
                  height={1333}
                />
              </div>
            </div>
            <h3
              className="text-2xl font-normal text-gray-900 mb-4 leading-snug"
              style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
            >
              Traditional Supplements:<br />A Disappointment
            </h3>
            <p className="text-sm text-gray-500 leading-relaxed max-w-sm">
              Traditional supplements often disappoint—filled with additives and contaminants that
              may harm your health over time, while calcium carbonate can build up causing kidney
              stones and heart issues, and pills and powders are slow to absorb and hard to swallow,
              so choose Marah Natural&apos;s SAC® for a pure, fast, and easy alternative.
            </p>
          </div>

        </div>
      </div>
    </section>
  );
}
