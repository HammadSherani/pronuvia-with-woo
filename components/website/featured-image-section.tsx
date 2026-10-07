
import featuredImage from "@/public/assets/featured-banner.png";
import Image from "next/image";

export function FeaturedImageSection() {
  return (
    <section className="w-full py-16 bg-white">
      <div className="max-w-6xl mx-auto px-6">

        {/* Header */}
        <div className="text-center mb-10">
          <p className="text-xs font-semibold tracking-[0.25em] text-gray-400 uppercase mb-3">
            Our Story
          </p>
          <h2
            className="text-4xl font-normal text-gray-900"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            Rooted in Science, Driven by Nature
          </h2>
          <p className="mt-4 text-sm text-gray-500 max-w-xl mx-auto leading-relaxed">
            From our laboratory to your doorstep — every product is crafted with precision,
            backed by research, and made with the finest natural ingredients.
          </p>
        </div>

        {/* Image */}
        <div className="rounded-2xl overflow-hidden  w-full aspect-[13/6] bg-gray-100">
          <Image
            src={featuredImage}
            alt="Pronuvia featured"
            className="w-full h-full object-cover"
            width={1000}
            height={1000}
          />
        </div>

      </div>
    </section>
  );
}
