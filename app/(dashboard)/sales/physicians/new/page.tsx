import Link from "next/link";
import { requireSalesRep } from "@/lib/auth/dal";
import { salesRepAddPhysician } from "@/actions/sales-rep/add-physician";
import { PhysicianForm } from "@/components/admin/physician-form";

export const metadata = { title: "Add Physician – Pronuvia" };

export default async function SalesRepNewPhysicianPage() {
  await requireSalesRep();

  return (
    <div className="">
      <Link
        href="/sales/physicians"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-5 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to Physicians
      </Link>

      <div className="flex items-start gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Add Partnering Physician</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Your request will be sent to admin for approval.
          </p>
        </div>
        {/* <span className="ml-auto shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-xs font-medium">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Pending Admin Approval
        </span> */}
      </div>

      <PhysicianForm
        action={salesRepAddPhysician}
        submitLabel="Submit for Approval"
        backHref="/sales/physicians"
        successRedirect="/sales/physicians"
        hideCommission
        requirePracticeFields
      />
    </div>
  );
}
