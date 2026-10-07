import { SiteHeaderWrapper as SiteHeader } from "@/components/website/site-header-wrapper";
import { SiteFooter }            from "@/components/website/site-footer";
import { PhysicianRegisterForm } from "@/components/website/physician-register-form";

export const metadata = { title: "Join Our Partnering Physician Program – Pronuvia" };

export default function PartneringPhysicianPage() {
  return (
    <>
      <SiteHeader variant="solid" />
      <main className="bg-gray-50 py-14 px-6">
        <div className="max-w-3xl mx-auto">

          {/* Header */}
          <div className="text-center mb-10">
            <p className="text-xs font-semibold tracking-[0.3em] text-[#3DBFA4] uppercase mb-3">
              Physician Program
            </p>
            <h1
              className="text-4xl lg:text-5xl font-normal text-gray-900 mb-4"
              style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
            >
              Join Our Partnering Physician Program
            </h1>
            <p className="text-sm text-gray-500 max-w-lg mx-auto leading-relaxed">
              Complete the registration form below. Our team will review your application
              and notify you once your account is approved.
            </p>
          </div>

          {/* Form card */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
            <PhysicianRegisterForm />
          </div>

        </div>
      </main>
      <SiteFooter />
    </>
  );
}
