import Link from "next/link";
import { requireAdmin } from "@/lib/auth/dal";
import { adminCreatePhysician } from "@/actions/admin/manage-physicians";
import { listSalesReps } from "@/actions/admin/manage-sales-reps";
import { PhysicianForm } from "@/components/admin/physician-form";

export const metadata = { title: "Add Physician – Pronuvia Admin" };

export default async function NewPhysicianPage() {
  await requireAdmin();
  const { reps } = await listSalesReps();

  return (
    <div className="">
      <Link href="/admin/physicians"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-5 transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to Physicians
      </Link>

      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-800">Add Partnering Physician</h1>
        <p className="text-sm text-gray-500 mt-0.5">Choose to approve immediately or place in pending for later review.</p>
      </div>

      <PhysicianForm
        action={adminCreatePhysician}
        submitLabel="Create"
        showDualCreate
        backHref="/admin/physicians"
        successRedirect="/admin/physicians"
        salesReps={reps.map((r) => ({ id: r.id, name: r.name, email: r.email }))}
      />
    </div>
  );
}
