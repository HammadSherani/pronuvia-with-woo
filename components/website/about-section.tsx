
import aboutImage from "@/public/assets/one.jpg"
import Image from "next/image";

export function AboutSection() {
  return (
    <section className=" px-6 py-20 bg-gray-50">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">

        {/* ── Left: Image ── */}
        <div className="rounded-2xl overflow-hidden aspect-[4/4.5] bg-gray-100">
          <Image
            src={aboutImage}
            alt="Product"
            className="w-full h-full object-cover"
            height={500}
            width={500}
          />
        </div>

        {/* ── Right: Content ── */}
        <div>
          {/* Heading */}
          <h2
            className="text-4xl lg:text-5xl font-normal text-gray-900 leading-tight mb-5"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            SAC®: A Leader in Bone Health.
            Unparalleled Absorbency &amp; Function.
          </h2>

          {/* Description */}
          <p className="text-sm text-gray-500 leading-relaxed mb-8">
            A global network of doctors, scientists, and researchers developed and tested Marah
            Natural&apos;s proprietary science, SAC® formula. SAC® formula ensures more than 95%
            ionic calcium absorption, bypassing the need for stomach acid and is a revolutionary
            bone health supplement.
          </p>

          {/* About label */}
          <div className="mb-6">
            <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase mb-3">
              About Section
            </p>
            <hr className="border-gray-200" />
          </div>

          {/* Stats row 1 */}
          <div className="grid grid-cols-2 gap-6 mb-2">
            <div>
              <p
                className="text-5xl font-light text-gray-900"
                style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
              >
                200k
              </p>
              <p className="text-xs text-gray-500 mt-1 uppercase tracking-wide">More absorbent</p>
            </div>
            <div>
              <p
                className="text-5xl font-light text-gray-900"
                style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
              >
                3X
              </p>
              <p className="text-xs text-gray-500 mt-1 uppercase tracking-wide">More Reactive</p>
            </div>
          </div>
          <div className="mb-6">
            <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase mt-3 mb-3">
              Customer Trial
            </p>
            <hr className="border-gray-200" />
          </div>

          {/* Stats row 2 */}
          <div className="grid grid-cols-2 gap-6 mb-2">
            <div>
              <p
                className="text-5xl font-light text-gray-900"
                style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
              >
                200k
              </p>
              <p className="text-xs text-gray-500 mt-1 uppercase tracking-wide">More absorbent</p>
            </div>
            <div>
              <p
                className="text-5xl font-light text-gray-900"
                style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
              >
                74%
              </p>
              <p className="text-xs text-gray-500 mt-1 uppercase tracking-wide">Improvement in Bone Density</p>
            </div>
          </div>
          <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase mt-3">
            Customer Trial
          </p>
        </div>

      </div>
    </section>
  );
}
