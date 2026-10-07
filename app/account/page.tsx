import { getCurrentSession }       from "@/lib/auth/dal";
import { prisma }                  from "@/lib/db/prisma";
import { SiteHeaderWrapper as SiteHeader } from "@/components/website/site-header-wrapper";
import { SiteFooter }              from "@/components/website/site-footer";
import { PhysicianRegisterForm }   from "@/components/website/physician-register-form";
import { logout }                  from "@/actions/auth/logout";
import { formatDateLong }          from "@/lib/utils/timezone";

export const metadata = { title: "Account – Pronuvia" };

function Row({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="py-3 border-b border-gray-100 last:border-0 flex flex-col sm:flex-row sm:items-center gap-1">
      <dt className="text-xs font-semibold text-gray-400 uppercase tracking-wider sm:w-44 shrink-0">{label}</dt>
      <dd className="text-sm text-gray-800">
        {value !== null && value !== undefined && value !== ""
          ? String(value)
          : <span className="text-gray-300 italic">Not provided</span>}
      </dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/60">
        <h2 className="text-sm font-semibold text-gray-700">{title}</h2>
      </div>
      <dl className="px-6 py-2">{children}</dl>
    </div>
  );
}

const statusStyle = {
  APPROVED: { cls: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "Approved" },
  PENDING:  { cls: "bg-amber-50  text-amber-700  border-amber-200",  label: "Pending Approval" },
  REJECTED: { cls: "bg-red-50    text-red-700    border-red-200",    label: "Rejected" },
};

export default async function AccountPage() {
  const session = await getCurrentSession();

  // ── Logged-in physician: show account details ──────────────────────────────
  if (session?.role === "PHYSICIAN") {
    const physician = await prisma.partneringPhysician.findUnique({
      where: { id: session.userId },
      include: {
        salesRep: { select: { firstName: true, lastName: true, email: true, phone: true } },
      },
    });

    if (physician) {
      const status = statusStyle[physician.isApproved];
      const fullAddress = [
        physician.addressOne, physician.addressTwo,
        physician.city, physician.state, physician.zipCode,
      ].filter(Boolean).join(", ");

      const memberSince = formatDateLong(physician.createdAt);

      return (
        <>
          <SiteHeader variant="solid" />
          <main className="bg-gray-50 min-h-screen py-14 px-6">
            <div className="max-w-3xl mx-auto space-y-6">

              <div>
                <p className="text-xs font-semibold tracking-[0.3em] text-[#3DBFA4] uppercase mb-1">My Account</p>
                <h1 className="text-4xl font-normal text-gray-900" style={{ fontFamily: "Georgia, serif" }}>
                  Account Details
                </h1>
              </div>

              {/* Avatar card */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex items-center gap-5">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#3DBFA4] to-[#2a9fd6] flex items-center justify-center shrink-0 text-white text-2xl font-black select-none">
                  {physician.firstName.charAt(0)}{physician.lastName.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-lg font-semibold text-gray-900">
                     {physician.firstName} {physician.lastName}
                  </p>
                  <p className="text-sm text-gray-400">{physician.email}</p>
                  {physician.nameOfPractice && (
                    <p className="text-xs text-gray-400 mt-0.5">{physician.nameOfPractice}</p>
                  )}
                  <p className="text-xs text-gray-300 mt-0.5">Member since {memberSince}</p>
                </div>
                <div className="shrink-0 flex flex-col items-end gap-2">
                  <span className={`inline-flex px-3 py-1 border rounded-full text-xs font-semibold ${status.cls}`}>
                    {status.label}
                  </span>
                  <form action={logout}>
                    <button type="submit" className="text-xs text-gray-400 hover:text-red-500 transition-colors">
                      Log out
                    </button>
                  </form>
                </div>
              </div>

              {physician.isApproved === "PENDING" && (
                <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-5 py-4">
                  <svg className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="text-sm font-semibold text-amber-800">Account Pending Approval</p>
                    <p className="text-xs text-amber-600 mt-0.5">
                      Your registration is under review. We will notify you once your account is approved.
                    </p>
                  </div>
                </div>
              )}

              <Section title="Personal Information">
                <Row label="First Name"     value={physician.firstName} />
                <Row label="Last Name"      value={physician.lastName} />
                <Row label="Email"          value={physician.email} />
                <Row label="Phone"          value={physician.phone} />
                <Row label="Office Contact" value={physician.officeContactNumber} />
                <Row label="Fax"            value={physician.fax} />
              </Section>

              <Section title="Practice Information">
                <Row label="Practice Name"     value={physician.nameOfPractice} />
                <Row label="License Number"    value={physician.license} />
                <Row label="Years in Practice" value={physician.yearsInPractice} />
                <Row label="Website"           value={physician.websiteLink} />
                <Row label="How did you hear about AIC Therapy?" value={physician.aictherapy} />
                <Row label="Specialties"       value={physician.fieldsOfSpeciality?.join(", ")} />
                <Row label="Address"           value={fullAddress || null} />
              </Section>

              {physician.salesRep && (
                <Section title="Upline Medical Representative">
                  <Row label="Name"  value={`${physician.salesRep.firstName} ${physician.salesRep.lastName}`} />
                  <Row label="Email" value={physician.salesRep.email} />
                  <Row label="Phone" value={physician.salesRep.phone} />
                </Section>
              )}

            </div>
          </main>
          <SiteFooter />
        </>
      );
    }
  }

  // ── Not logged in (or non-physician): show registration form ───────────────
  return (
    <>
      <SiteHeader variant="solid" />
      <main className="bg-gray-50 py-14 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            {/* <p className="text-xs font-semibold tracking-[0.3em] text-[#3DBFA4] uppercase mb-3">
              Physician Program
            </p> */}
            <h1
              className="text-4xl lg:text-5xl font-normal text-gray-900 mb-4"
              style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
            >
              Partner Program Application
            </h1>
            <p className="text-sm text-gray-500 max-w-lg mx-auto leading-relaxed">
              Complete the form below to apply. Our team will review your application
              and notify you once your account is approved.
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
            <PhysicianRegisterForm />
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
